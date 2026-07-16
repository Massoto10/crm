import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const now = new Date("2026-06-03T10:30:00-03:00");

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed bloqueado: defina ALLOW_DESTRUCTIVE_SEED=true para confirmar a limpeza dos dados.");
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres.");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.task.deleteMany();
  await prisma.endCustomerLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.endCustomer.deleteMany();
  await prisma.clientChannel.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.crmClient.deleteMany();

  const studio = await prisma.crmClient.create({
    data: {
      id: "cli_studio_rocha",
      legalName: "Studio Rocha Arquitetura Ltda",
      tradeName: "Studio Rocha",
      documentNumber: "12.345.678/0001-90",
      segment: "Arquitetura",
      planName: "Professional",
      status: "active",
      classification: "strategic",
      ownerName: "Camila",
      createdAt: now
    }
  });

  const almeida = await prisma.crmClient.create({
    data: {
      id: "cli_almeida_foods",
      legalName: "Almeida Foods Comercio de Alimentos Ltda",
      tradeName: "Almeida Foods",
      documentNumber: "98.765.432/0001-11",
      segment: "Restaurante",
      planName: "Growth",
      status: "trial",
      classification: "growth",
      ownerName: "Rafael",
      createdAt: now
    }
  });

  const nina = await prisma.crmClient.create({
    data: {
      id: "cli_nina_store",
      legalName: "Nina Prado Store Ltda",
      tradeName: "Nina Prado Store",
      documentNumber: "31.222.333/0001-77",
      segment: "E-commerce",
      planName: "Growth",
      status: "trial",
      classification: "growth",
      ownerName: "Joao",
      createdAt: now
    }
  });

  await prisma.agent.createMany({
    data: [
      { crmClientId: studio.id, name: "Administrador Studio", email: "admin@studio.local", passwordHash, role: "admin" },
      { crmClientId: almeida.id, name: "Administrador Almeida", email: "admin@almeida.local", passwordHash, role: "admin" },
      { crmClientId: nina.id, name: "Administrador Nina", email: "admin@nina.local", passwordHash, role: "admin" }
    ]
  });

  await prisma.label.createMany({
    data: [
      { id: "lab_hot", name: "Lead quente", color: "#b94343", category: "deal" },
      { id: "lab_proposal", name: "Proposta", color: "#206d6f", category: "deal" },
      { id: "lab_architecture", crmClientId: studio.id, name: "Arquitetura", color: "#7961d4", category: "profile" },
      { id: "lab_multiunit", crmClientId: almeida.id, name: "Multiunidade", color: "#bd6a18", category: "profile" },
      { id: "lab_restaurant", crmClientId: almeida.id, name: "Restaurante", color: "#24875d", category: "profile" },
      { id: "lab_ecommerce", crmClientId: nina.id, name: "E-commerce", color: "#2f6ecb", category: "profile" },
      { id: "lab_direct", name: "Direct", color: "#c23a78", category: "channel" },
      { id: "lab_urgent", name: "Urgente", color: "#b94343", category: "risk" }
    ]
  });

  const mariana = await prisma.endCustomer.create({
    data: {
      id: "end_mariana_rocha",
      crmClientId: studio.id,
      fullName: "Mariana Rocha",
      companyName: "Studio Rocha",
      phone: "+55 11 98888-1010",
      email: "mariana@studiorocha.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "proposal",
      leadTemperature: "hot",
      priority: "high",
      score: 92,
      estimatedValueCents: 840000,
      assignedTo: "Camila",
      lastContactAt: new Date("2026-06-03T10:18:00-03:00"),
      labels: {
        createMany: {
          data: [{ labelId: "lab_hot" }, { labelId: "lab_proposal" }, { labelId: "lab_architecture" }]
        }
      }
    }
  });

  const lucas = await prisma.endCustomer.create({
    data: {
      id: "end_lucas_almeida",
      crmClientId: almeida.id,
      fullName: "Lucas Almeida",
      companyName: "Almeida Foods",
      phone: "+55 21 97777-2020",
      email: "lucas@almeidafoods.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "qualified",
      leadTemperature: "warm",
      priority: "medium",
      score: 74,
      estimatedValueCents: 320000,
      assignedTo: "Rafael",
      lastContactAt: new Date("2026-06-03T10:03:00-03:00"),
      labels: {
        createMany: {
          data: [{ labelId: "lab_multiunit" }, { labelId: "lab_restaurant" }]
        }
      }
    }
  });

  const ninaCustomer = await prisma.endCustomer.create({
    data: {
      id: "end_nina_prado",
      crmClientId: nina.id,
      fullName: "Nina Prado",
      companyName: "Nina Prado Store",
      phone: "+55 31 96666-3030",
      email: "nina@ninaprado.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "new",
      leadTemperature: "hot",
      priority: "high",
      score: 81,
      estimatedValueCents: 260000,
      assignedTo: "Joao",
      lastContactAt: new Date("2026-06-03T10:24:00-03:00"),
      labels: {
        createMany: {
          data: [{ labelId: "lab_ecommerce" }, { labelId: "lab_direct" }, { labelId: "lab_urgent" }]
        }
      }
    }
  });

  await createConversation("conv_mariana_wpp", studio.id, mariana.id, "whatsapp", "Proposta comercial", [
    ["end_customer", "Cliente", "Oi, recebi a apresentacao. Gostei bastante do fluxo de atendimento.", "2026-06-03T10:12:00-03:00"],
    ["agent", "Agente", "Perfeito, Mariana. Separei uma proposta com implantacao assistida e treinamento para sua equipe.", "2026-06-03T10:14:00-03:00"],
    ["end_customer", "Cliente", "Consigo fechar ainda hoje se a proposta incluir treinamento da equipe.", "2026-06-03T10:18:00-03:00"]
  ]);

  await createConversation("conv_lucas_wpp", almeida.id, lucas.id, "whatsapp", "Qualificacao", [
    ["end_customer", "Cliente", "Tenho duas lojas e quero organizar atendimento e pedidos.", "2026-06-03T09:55:00-03:00"],
    ["agent", "Agente", "Consigo mapear isso com voce. As lojas usam o mesmo cardapio?", "2026-06-03T09:58:00-03:00"],
    ["end_customer", "Cliente", "Quase o mesmo, mas os responsaveis sao diferentes.", "2026-06-03T10:03:00-03:00"]
  ]);

  await createConversation("conv_nina_wa", nina.id, ninaCustomer.id, "whatsapp", "Primeiro contato", [
    ["end_customer", "Cliente", "Ola! Vi o post e queria entender como funciona para loja online.", "2026-06-03T10:21:00-03:00"],
    ["agent", "Agente", "Oi, Nina. Voce quer centralizar o atendimento em uma unica fila?", "2026-06-03T10:22:00-03:00"],
    ["end_customer", "Cliente", "Sim, principalmente para nao perder pergunta sobre produto.", "2026-06-03T10:24:00-03:00"]
  ]);

  await prisma.task.createMany({
    data: [
      { id: "task_1", crmClientId: studio.id, endCustomerId: mariana.id, title: "Enviar proposta revisada", status: "open", ownerName: "Camila", createdAt: now },
      { id: "task_2", crmClientId: studio.id, endCustomerId: mariana.id, title: "Qualificar orcamento", status: "done", ownerName: "Camila", createdAt: now },
      { id: "task_3", crmClientId: studio.id, endCustomerId: mariana.id, title: "Agendar follow-up", status: "open", ownerName: "Camila", createdAt: now }
    ]
  });
}

async function createConversation(
  id: string,
  crmClientId: string,
  endCustomerId: string,
  channelType: "whatsapp",
  stage: string,
  messages: Array<[senderType: "agent" | "end_customer", senderName: string, body: string, sentAt: string]>
) {
  const last = messages[messages.length - 1];
  await prisma.conversation.create({
    data: {
      id,
      crmClientId,
      endCustomerId,
      channelType,
      status: "waiting_agent",
      stage,
      slaStatus: "on_time",
      lastMessagePreview: last[2],
      lastMessageAt: new Date(last[3]),
      unreadCount: 1,
      messages: {
        create: messages.map(([senderType, senderName, body, sentAt], index) => ({
          id: `${id}_msg_${index + 1}`,
          senderType,
          senderName,
          body,
          sentAt: new Date(sentAt)
        }))
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
