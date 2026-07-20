/**
 * Popula o banco de e2e com o mínimo pros testes de tela: um admin com senha e
 * conversas cobrindo os estados das 7 features.
 *
 * Exporta `seedE2E()` porque os testes re-semeiam antes de CADA caso — navegar
 * pra aba Chats auto-seleciona a primeira conversa, e isso dispara o mark-as-read
 * no banco. Sem reset, um teste zera o badge que o seguinte espera encontrar.
 *
 * Usa o banco `crm_e2e`, separado do `crm_test` da integração (ver tests/README.md).
 */
import * as zlib from "zlib";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** PNG RGBA gerado na hora. Grande de proposito (1600x1200): com imagem pequena
 *  o lightbox sempre "cabe" e o teste nao pegaria o bug de corte. */
function pngDataUri(w = 1600, h = 1200): string {
  const tabela: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c;
  }
  const crc32 = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = tabela[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(tipo), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };

  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filtro none
    for (let x = 0; x < w; x++) {
      raw[o++] = Math.floor((x * 255) / w);
      raw[o++] = Math.floor((y * 255) / h);
      raw[o++] = 160;
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export const E2E = {
  crmClientId: "cli_e2e",
  email: "admin@e2e.crm",
  senha: "e2e-senha-123",
  instancia: "crm-cli_e2e",
  legenda: "Legenda que precisa aparecer",
  pdf: "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCg=="
};

export async function seedE2E() {
  const imagem = pngDataUri();

  // Limpa só o tenant de e2e (cascade leva conversas, mensagens e agentes).
  await prisma.crmClient.deleteMany({ where: { id: E2E.crmClientId } });

  await prisma.crmClient.create({
    data: {
      id: E2E.crmClientId,
      legalName: "E2E LTDA",
      tradeName: "E2E",
      segment: "teste",
      planName: "basico",
      status: "active",
      classification: "standard",
      ownerName: "Dono E2E"
    }
  });

  await prisma.setting.createMany({
    data: [
      { crmClientId: E2E.crmClientId, key: "wa_instance_name", value: E2E.instancia },
      { crmClientId: E2E.crmClientId, key: "wa_status", value: "connected" }
    ]
  });

  await prisma.agent.create({
    data: {
      id: "agent_e2e_admin",
      crmClientId: E2E.crmClientId,
      name: "Admin E2E",
      email: E2E.email,
      role: "admin",
      passwordHash: await bcrypt.hash(E2E.senha, 10)
    }
  });

  const cliente = (nome: string, telefone: string) =>
    prisma.endCustomer.create({
      data: {
        crmClientId: E2E.crmClientId,
        fullName: nome,
        phone: telefone,
        whatsappJid: `${telefone}@s.whatsapp.net`,
        originChannel: "whatsapp",
        lifecycleStage: "new",
        leadTemperature: "warm",
        priority: "medium"
      }
    });

  const conversa = (opts: {
    endCustomerId: string;
    status: "pending" | "open" | "closed";
    unreadCount: number;
    preview: string;
    minutosAtras: number;
  }) =>
    prisma.conversation.create({
      data: {
        crmClientId: E2E.crmClientId,
        endCustomerId: opts.endCustomerId,
        channelType: "whatsapp",
        status: opts.status,
        stage: "Primeiro contato",
        slaStatus: "on_time",
        lastMessagePreview: opts.preview,
        lastMessageAt: new Date(Date.now() - opts.minutosAtras * 60_000),
        unreadCount: opts.unreadCount
      }
    });

  // 1) PENDENTE com não lidas + imagem com legenda + imagem sem legenda + documento
  const c1 = await cliente("Cliente Pendente", "5521900000001");
  const conv1 = await conversa({
    endCustomerId: c1.id,
    status: "pending",
    unreadCount: 3,
    preview: "tem anexo aqui",
    minutosAtras: 1
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: conv1.id,
        senderType: "end_customer",
        senderName: "Cliente Pendente",
        body: "bom dia",
        sentAt: new Date(Date.now() - 5 * 60_000)
      },
      {
        conversationId: conv1.id,
        senderType: "end_customer",
        senderName: "Cliente Pendente",
        body: E2E.legenda,
        mediaType: "image",
        mediaUrl: imagem,
        sentAt: new Date(Date.now() - 4 * 60_000)
      },
      {
        conversationId: conv1.id,
        senderType: "end_customer",
        senderName: "Cliente Pendente",
        // sem legenda: o placeholder NÃO pode aparecer como texto na tela
        body: "[Imagem]",
        mediaType: "image",
        mediaUrl: imagem,
        sentAt: new Date(Date.now() - 3 * 60_000)
      },
      {
        conversationId: conv1.id,
        senderType: "end_customer",
        senderName: "Cliente Pendente",
        body: "[Documento] contrato.pdf",
        mediaType: "document",
        mediaUrl: E2E.pdf,
        sentAt: new Date(Date.now() - 2 * 60_000)
      }
    ]
  });

  // 2) ATIVA, sem não lidas
  const c2 = await cliente("Cliente Ativo", "5521900000002");
  await conversa({
    endCustomerId: c2.id,
    status: "open",
    unreadCount: 0,
    preview: "ja respondi",
    minutosAtras: 10
  });

  // 3) FECHADA
  const c3 = await cliente("Cliente Fechado", "5521900000003");
  await conversa({
    endCustomerId: c3.id,
    status: "closed",
    unreadCount: 0,
    preview: "resolvido",
    minutosAtras: 60
  });
}

// Execução direta: npx tsx tests/e2e/seed.ts
if (require.main === module) {
  seedE2E()
    .then(() => console.log("seed e2e pronto"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
