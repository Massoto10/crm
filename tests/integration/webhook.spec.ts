import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.service";
import type { WhatsappService } from "../../apps/api/src/whatsapp/whatsapp.service";
import { PipelineStageService } from "../../apps/api/src/pipeline/pipeline-stage.service";
import {
  AGENT_REPLY_GRACE_MS,
  WhatsappWebhookService
} from "../../apps/api/src/whatsapp/whatsapp-webhook.service";
import {
  CRM_CLIENT_ID,
  prisma,
  resetDb,
  seedAgentMessage,
  seedConversation,
  seedCustomer,
  seedTenant,
  upsertEvent
} from "./helpers";

// Mock do WhatsappService: o webhook chama getMediaBase64 contra o Evolution,
// que não existe nos testes. Cada teste controla o que ele devolve.
const getMediaBase64 = vi.fn();

let webhook: WhatsappWebhookService;

beforeAll(() => {
  // Instanciação direta: o service só precisa de prisma + whatsapp, não vale
  // subir o container de DI do Nest só pra isso.
  webhook = new WhatsappWebhookService(
    prisma as unknown as PrismaService,
    { getMediaBase64 } as unknown as WhatsappService,
    new PipelineStageService(prisma as unknown as PrismaService)
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  getMediaBase64.mockReset();
  await resetDb();
  await seedTenant();
});

describe("webhook inbound — status volta pra pendente com janela de carência", () => {
  it("conversa nova nasce pendente", async () => {
    const cliente = await seedCustomer();
    await webhook.handle(
      upsertEvent({ waMessageId: "m1", message: { conversation: "oi" } }) as never
    );

    const conv = await prisma.conversation.findFirst({ where: { endCustomerId: cliente.id } });
    expect(conv?.status).toBe("pending");
    expect(conv?.unreadCount).toBe(1);
  });

  it("operador respondeu AGORA: conversa ativa continua ativa", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "waiting_customer" });
    await seedAgentMessage(conv.id, new Date()); // dentro da carência

    await webhook.handle(
      upsertEvent({ waMessageId: "m2", message: { conversation: "responde ai" } }) as never
    );

    const depois = await prisma.conversation.findUnique({ where: { id: conv.id } });
    expect(depois?.status).toBe("waiting_customer");
    expect(depois?.unreadCount).toBe(1);
  });

  it("operador respondeu além da carência: volta pra pendente", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "waiting_customer" });
    await seedAgentMessage(conv.id, new Date(Date.now() - AGENT_REPLY_GRACE_MS - 60_000));

    await webhook.handle(
      upsertEvent({ waMessageId: "m3", message: { conversation: "alo?" } }) as never
    );

    const depois = await prisma.conversation.findUnique({ where: { id: conv.id } });
    expect(depois?.status).toBe("pending");
  });

  it("conversa ativa sem nenhuma resposta de agente volta pra pendente", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "open" });

    await webhook.handle(
      upsertEvent({ waMessageId: "m4", message: { conversation: "oi de novo" } }) as never
    );

    const depois = await prisma.conversation.findUnique({ where: { id: conv.id } });
    expect(depois?.status).toBe("pending");
  });

  it("na borda exata da carência, volta pra pendente", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "waiting_customer" });
    await seedAgentMessage(conv.id, new Date(Date.now() - AGENT_REPLY_GRACE_MS - 1000));

    await webhook.handle(
      upsertEvent({ waMessageId: "m5", message: { conversation: "borda" } }) as never
    );

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.status).toBe("pending");
  });

  it("unreadCount acumula a cada mensagem do cliente", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 2 });

    await webhook.handle(upsertEvent({ waMessageId: "m6", message: { conversation: "a" } }) as never);
    await webhook.handle(upsertEvent({ waMessageId: "m7", message: { conversation: "b" } }) as never);

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(4);
  });

  it("conversa fechada não é reaberta — cria uma nova", async () => {
    const cliente = await seedCustomer();
    const fechada = await seedConversation({ endCustomerId: cliente.id, status: "closed" });

    await webhook.handle(upsertEvent({ waMessageId: "m8", message: { conversation: "oi" } }) as never);

    expect((await prisma.conversation.findUnique({ where: { id: fechada.id } }))?.status).toBe("closed");
    const todas = await prisma.conversation.findMany({ where: { endCustomerId: cliente.id } });
    expect(todas).toHaveLength(2);
  });
});

describe("webhook inbound — mídia nasce completa e com mimetype certo", () => {
  it("mensagem de imagem já é criada COM mediaUrl (sem estado de anexo quebrado)", async () => {
    await seedCustomer();
    getMediaBase64.mockResolvedValue({ base64: "QUJD", mimetype: "image/png" });

    await webhook.handle(
      upsertEvent({
        waMessageId: "img1",
        message: { imageMessage: { caption: "olha isso", mimetype: "image/png" } }
      }) as never
    );

    const msg = await prisma.message.findUnique({ where: { waMessageId: "img1" } });
    expect(msg?.mediaType).toBe("image");
    expect(msg?.mediaUrl).toBe("data:image/png;base64,QUJD");
    expect(msg?.body).toBe("olha isso");
  });

  it("o mimetype do payload é repassado como fallback pro download", async () => {
    await seedCustomer();
    getMediaBase64.mockResolvedValue({ base64: "UERG", mimetype: "application/pdf" });

    await webhook.handle(
      upsertEvent({
        waMessageId: "doc1",
        message: { documentMessage: { fileName: "contrato.pdf", mimetype: "application/pdf" } }
      }) as never
    );

    expect(getMediaBase64).toHaveBeenCalledWith("crm-cli_test", "doc1", "application/pdf");
    const msg = await prisma.message.findUnique({ where: { waMessageId: "doc1" } });
    expect(msg?.mediaUrl?.startsWith("data:application/pdf;base64,")).toBe(true);
  });

  it("documento sem mimetype no payload NÃO vira audio/ogg — regressão do arquivo que não abria", async () => {
    await seedCustomer();
    // Evolution devolve sem mimetype: o service usa o fallback que recebeu.
    getMediaBase64.mockImplementation(
      async (_i: string, _id: string, fallback: string) => ({ base64: "UERG", mimetype: fallback })
    );

    await webhook.handle(
      upsertEvent({
        waMessageId: "doc2",
        message: { documentMessage: { fileName: "nota.pdf" } }
      }) as never
    );

    const msg = await prisma.message.findUnique({ where: { waMessageId: "doc2" } });
    expect(msg?.mediaUrl).not.toContain("audio/ogg");
    expect(msg?.mediaUrl?.startsWith("data:application/octet-stream;base64,")).toBe(true);
  });

  it("imagem sem legenda guarda o placeholder no body", async () => {
    await seedCustomer();
    getMediaBase64.mockResolvedValue({ base64: "QUJD", mimetype: "image/jpeg" });

    await webhook.handle(
      upsertEvent({ waMessageId: "img2", message: { imageMessage: {} } }) as never
    );

    expect((await prisma.message.findUnique({ where: { waMessageId: "img2" } }))?.body).toBe("[Imagem]");
  });

  it("falha no download grava a mensagem sem mediaUrl, sem derrubar o webhook", async () => {
    await seedCustomer();
    getMediaBase64.mockResolvedValue(null);

    await webhook.handle(
      upsertEvent({ waMessageId: "img3", message: { imageMessage: { caption: "x" } } }) as never
    );

    const msg = await prisma.message.findUnique({ where: { waMessageId: "img3" } });
    expect(msg).not.toBeNull();
    expect(msg?.mediaUrl).toBeNull();
    expect(msg?.mediaType).toBe("image");
  });
});

describe("webhook — idempotência", () => {
  it("reenvio do mesmo waMessageId não duplica mensagem nem contador", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending" });

    const ev = upsertEvent({ waMessageId: "dup1", message: { conversation: "oi" } });
    await webhook.handle(ev as never);
    await webhook.handle(ev as never);

    const msgs = await prisma.message.findMany({ where: { conversationId: conv.id } });
    expect(msgs).toHaveLength(1);
    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(1);
  });

  it("reação e evento de protocolo não viram mensagem", async () => {
    await seedCustomer();
    await webhook.handle(upsertEvent({ waMessageId: "r1", message: { reactionMessage: {} } }) as never);
    await webhook.handle(upsertEvent({ waMessageId: "p1", message: { protocolMessage: {} } }) as never);

    expect(await prisma.message.count()).toBe(0);
  });

  it("instância desconhecida é ignorada", async () => {
    await seedCustomer();
    await webhook.handle(
      upsertEvent({ instance: "instancia-fantasma", waMessageId: "x1", message: { conversation: "oi" } }) as never
    );
    expect(await prisma.message.count()).toBe(0);
  });
});

describe("webhook — mensagem enviada pelo celular do operador", () => {
  it("é gravada como agente e segura a janela de carência", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "waiting_customer" });

    // Operador responde pelo celular.
    await webhook.handle(
      upsertEvent({ waMessageId: "fm1", fromMe: true, message: { conversation: "ja te respondo" } }) as never
    );
    const msg = await prisma.message.findUnique({ where: { waMessageId: "fm1" } });
    expect(msg?.senderType).toBe("agent");

    // Cliente responde logo depois: continua ativa por causa da carência.
    await webhook.handle(
      upsertEvent({ waMessageId: "fm2", message: { conversation: "ok" } }) as never
    );
    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.status).toBe("waiting_customer");
  });
});

describe("multi-tenant", () => {
  it("a conversa criada pertence ao crmClient da instância", async () => {
    await seedCustomer();
    await webhook.handle(upsertEvent({ waMessageId: "t1", message: { conversation: "oi" } }) as never);
    const conv = await prisma.conversation.findFirst();
    expect(conv?.crmClientId).toBe(CRM_CLIENT_ID);
  });
});
