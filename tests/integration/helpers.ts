import { PrismaClient } from "@prisma/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:55432/crm_test?schema=public";

export const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

export const CRM_CLIENT_ID = "cli_test";

/** Zera as tabelas que os testes tocam, respeitando as FKs. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE messages, conversations, end_customers, settings, agents,
                   pipeline_stages, crm_clients
    RESTART IDENTITY CASCADE
  `);
}

/** Cria o tenant + o setting que liga a instância do Evolution ao crmClient. */
export async function seedTenant(instanceName = "crm-cli_test") {
  await prisma.crmClient.create({
    data: {
      id: CRM_CLIENT_ID,
      legalName: "Teste LTDA",
      tradeName: "Teste",
      segment: "teste",
      planName: "basico",
      status: "active",
      classification: "standard",
      ownerName: "Dono Teste"
    }
  });
  await prisma.setting.create({
    data: { crmClientId: CRM_CLIENT_ID, key: "wa_instance_name", value: instanceName }
  });
}

export async function seedAgent(opts: { id: string; role: "admin" | "agent" }) {
  return prisma.agent.create({
    data: {
      id: opts.id,
      crmClientId: CRM_CLIENT_ID,
      name: opts.id,
      email: `${opts.id}@teste.crm`,
      role: opts.role
    }
  });
}

export async function seedCustomer(phone = "5521999998888") {
  return prisma.endCustomer.create({
    data: {
      crmClientId: CRM_CLIENT_ID,
      fullName: "Cliente Teste",
      phone,
      whatsappJid: `${phone}@s.whatsapp.net`,
      originChannel: "whatsapp",
      lifecycleStage: "new",
      leadTemperature: "warm",
      priority: "medium"
    }
  });
}

export async function seedConversation(opts: {
  endCustomerId: string;
  status: "pending" | "open" | "waiting_customer" | "closed";
  unreadCount?: number;
  assignedAgentId?: string | null;
}) {
  return prisma.conversation.create({
    data: {
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: opts.endCustomerId,
      channelType: "whatsapp",
      status: opts.status,
      stage: "Primeiro contato",
      slaStatus: "on_time",
      lastMessagePreview: "...",
      lastMessageAt: new Date(),
      unreadCount: opts.unreadCount ?? 0,
      assignedAgentId: opts.assignedAgentId ?? null
    }
  });
}

/** Mensagem de agente com data de envio controlada (pra testar a janela de carência). */
export async function seedAgentMessage(conversationId: string, sentAt: Date) {
  return prisma.message.create({
    data: {
      conversationId,
      senderType: "agent",
      senderName: "Agente",
      body: "resposta",
      sentAt
    }
  });
}

/** Payload messages.upsert do Evolution, no formato que o webhook espera. */
export function upsertEvent(opts: {
  instance?: string;
  phone?: string;
  waMessageId: string;
  message: Record<string, unknown>;
  fromMe?: boolean;
}) {
  const phone = opts.phone ?? "5521999998888";
  return {
    event: "messages.upsert" as const,
    instance: opts.instance ?? "crm-cli_test",
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: opts.fromMe ?? false,
        id: opts.waMessageId
      },
      pushName: "Cliente Teste",
      message: opts.message
    }
  };
}
