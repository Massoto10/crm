import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JwtPayload } from "../../apps/api/src/auth/decorators";
import { ConversationsService } from "../../apps/api/src/conversations/conversations.service";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.service";
import type { WhatsappService } from "../../apps/api/src/whatsapp/whatsapp.service";
import { PipelineStageService } from "../../apps/api/src/pipeline/pipeline-stage.service";
import {
  CRM_CLIENT_ID,
  prisma,
  resetDb,
  seedAgent,
  seedConversation,
  seedCustomer,
  seedTenant
} from "./helpers";

let service: ConversationsService;

function actor(over: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: "agent_admin",
    email: "admin@teste.crm",
    name: "Admin",
    role: "admin",
    crmClientId: CRM_CLIENT_ID,
    ...over
  };
}

beforeAll(() => {
  service = new ConversationsService(
    prisma as unknown as PrismaService,
    { sendText: vi.fn(), sendAudio: vi.fn(), sendMedia: vi.fn() } as unknown as WhatsappService,
    new PipelineStageService(prisma as unknown as PrismaService)
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  await seedTenant();
});

describe("markRead — badge de não lidas", () => {
  it("zera o unreadCount", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 7 });

    const res = await service.markRead(conv.id, actor());

    expect(res).toEqual({ id: conv.id, unreadCount: 0 });
    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(0);
  });

  it("é idempotente — chamar duas vezes não quebra", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 3 });

    await service.markRead(conv.id, actor());
    await service.markRead(conv.id, actor());

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(0);
  });

  it("NÃO muda o status da conversa — ler não é atender", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 2 });

    await service.markRead(conv.id, actor());

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.status).toBe("pending");
  });

  it("conversa inexistente devolve 404", async () => {
    await expect(service.markRead("nao-existe", actor())).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("markRead — controle de acesso", () => {
  it("agente com escopo 'own' NÃO lê conversa de outro agente", async () => {
    const dono = await seedAgent({ id: "agente_dono", role: "agent" });
    const intruso = await seedAgent({ id: "agente_intruso", role: "agent" });
    const cliente = await seedCustomer();
    const conv = await seedConversation({
      endCustomerId: cliente.id,
      status: "pending",
      unreadCount: 5,
      assignedAgentId: dono.id
    });

    await expect(
      service.markRead(
        conv.id,
        actor({ sub: intruso.id, role: "agent", permissions: { scope: "own" } as never })
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    // contador intacto — não vazou nem escrita nem informação
    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(5);
  });

  it("agente com escopo 'own' lê a própria conversa", async () => {
    const dono = await seedAgent({ id: "agente_dono2", role: "agent" });
    const cliente = await seedCustomer();
    const conv = await seedConversation({
      endCustomerId: cliente.id,
      status: "pending",
      unreadCount: 4,
      assignedAgentId: dono.id
    });

    await service.markRead(
      conv.id,
      actor({ sub: dono.id, role: "agent", permissions: { scope: "own" } as never })
    );

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(0);
  });

  it("agente com escopo 'all' lê conversa de qualquer um", async () => {
    const dono = await seedAgent({ id: "agente_dono3", role: "agent" });
    const outro = await seedAgent({ id: "agente_outro3", role: "agent" });
    const cliente = await seedCustomer();
    const conv = await seedConversation({
      endCustomerId: cliente.id,
      status: "pending",
      unreadCount: 6,
      assignedAgentId: dono.id
    });

    await service.markRead(
      conv.id,
      actor({ sub: outro.id, role: "agent", permissions: { scope: "all" } as never })
    );

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(0);
  });

  it("admin lê conversa não atribuída", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 9 });

    await service.markRead(conv.id, actor());

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(0);
  });

  it("não atravessa tenant — conversa de outro crmClient é 404", async () => {
    const cliente = await seedCustomer();
    const conv = await seedConversation({ endCustomerId: cliente.id, status: "pending", unreadCount: 3 });

    await expect(
      service.markRead(conv.id, actor({ crmClientId: "cli_outro" }))
    ).rejects.toBeInstanceOf(NotFoundException);

    expect((await prisma.conversation.findUnique({ where: { id: conv.id } }))?.unreadCount).toBe(3);
  });
});
