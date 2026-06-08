const CRM_DATABASE_VERSION = 1;

const CRM_DATABASE_SEED = {
  crmClients: [
    {
      id: "cli_studio_rocha",
      legalName: "Studio Rocha Arquitetura Ltda",
      tradeName: "Studio Rocha",
      documentNumber: "12.345.678/0001-90",
      segment: "Arquitetura",
      planName: "Professional",
      status: "active",
      classification: "strategic",
      ownerName: "Camila",
      createdAt: "2026-06-01T09:00:00-03:00",
      updatedAt: "2026-06-03T10:18:00-03:00"
    },
    {
      id: "cli_almeida_foods",
      legalName: "Almeida Foods Comercio de Alimentos Ltda",
      tradeName: "Almeida Foods",
      documentNumber: "98.765.432/0001-11",
      segment: "Restaurante",
      planName: "Growth",
      status: "trial",
      classification: "growth",
      ownerName: "Rafael",
      createdAt: "2026-06-02T08:30:00-03:00",
      updatedAt: "2026-06-03T10:03:00-03:00"
    },
    {
      id: "cli_bia_beauty",
      legalName: "Bia Beauty Estetica Ltda",
      tradeName: "Bia Beauty",
      documentNumber: "44.555.666/0001-22",
      segment: "Beleza",
      planName: "Starter",
      status: "active",
      classification: "standard",
      ownerName: "Camila",
      createdAt: "2026-05-28T11:20:00-03:00",
      updatedAt: "2026-06-03T09:30:00-03:00"
    },
    {
      id: "cli_nina_store",
      legalName: "Nina Prado Store Ltda",
      tradeName: "Nina Prado Store",
      documentNumber: "31.222.333/0001-77",
      segment: "E-commerce",
      planName: "Growth",
      status: "trial",
      classification: "growth",
      ownerName: "Joao",
      createdAt: "2026-06-03T10:15:00-03:00",
      updatedAt: "2026-06-03T10:24:00-03:00"
    },
    {
      id: "cli_casa_vitta",
      legalName: "Casa Vitta Moveis Planejados Ltda",
      tradeName: "Casa Vitta",
      documentNumber: "71.888.999/0001-45",
      segment: "Moveis",
      planName: "Professional",
      status: "active",
      classification: "strategic",
      ownerName: "Rafael",
      createdAt: "2026-05-30T14:00:00-03:00",
      updatedAt: "2026-06-03T10:11:00-03:00"
    }
  ],
  labels: [
    { id: "lab_hot", crmClientId: null, name: "Lead quente", color: "#b94343", category: "deal" },
    { id: "lab_proposal", crmClientId: null, name: "Proposta", color: "#206d6f", category: "deal" },
    { id: "lab_architecture", crmClientId: "cli_studio_rocha", name: "Arquitetura", color: "#7961d4", category: "profile" },
    { id: "lab_multiunit", crmClientId: "cli_almeida_foods", name: "Multiunidade", color: "#bd6a18", category: "profile" },
    { id: "lab_restaurant", crmClientId: "cli_almeida_foods", name: "Restaurante", color: "#24875d", category: "profile" },
    { id: "lab_new", crmClientId: null, name: "Novo", color: "#49616f", category: "behavior" },
    { id: "lab_beauty", crmClientId: "cli_bia_beauty", name: "Beleza", color: "#c23a78", category: "profile" },
    { id: "lab_instagram", crmClientId: null, name: "Instagram", color: "#c23a78", category: "channel" },
    { id: "lab_ecommerce", crmClientId: "cli_nina_store", name: "E-commerce", color: "#2f6ecb", category: "profile" },
    { id: "lab_direct", crmClientId: null, name: "Direct", color: "#c23a78", category: "channel" },
    { id: "lab_urgent", crmClientId: null, name: "Urgente", color: "#b94343", category: "risk" },
    { id: "lab_budget", crmClientId: "cli_casa_vitta", name: "Orcamento", color: "#bd6a18", category: "deal" },
    { id: "lab_support", crmClientId: "cli_casa_vitta", name: "Suporte", color: "#49616f", category: "behavior" }
  ],
  endCustomers: [
    {
      id: "end_mariana_rocha",
      crmClientId: "cli_studio_rocha",
      fullName: "Mariana Rocha",
      companyName: "Studio Rocha",
      phone: "+55 11 98888-1010",
      instagramHandle: "@studio.rocha",
      email: "mariana@studiorocha.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "proposal",
      leadTemperature: "hot",
      priority: "high",
      score: 92,
      estimatedValueCents: 840000,
      assignedTo: "Camila",
      lastContactAt: "2026-06-03T10:18:00-03:00",
      labelIds: ["lab_hot", "lab_proposal", "lab_architecture"]
    },
    {
      id: "end_lucas_almeida",
      crmClientId: "cli_almeida_foods",
      fullName: "Lucas Almeida",
      companyName: "Almeida Foods",
      phone: "+55 21 97777-2020",
      instagramHandle: "@almeidafoods",
      email: "lucas@almeidafoods.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "qualified",
      leadTemperature: "warm",
      priority: "medium",
      score: 74,
      estimatedValueCents: 320000,
      assignedTo: "Rafael",
      lastContactAt: "2026-06-03T10:03:00-03:00",
      labelIds: ["lab_multiunit", "lab_restaurant", "lab_new"]
    },
    {
      id: "end_bianca_nunes",
      crmClientId: "cli_bia_beauty",
      fullName: "Bianca Nunes",
      companyName: "Bia Beauty",
      phone: "+55 31 96666-3030",
      instagramHandle: "@biabeauty",
      email: "contato@biabeauty.com.br",
      originChannel: "whatsapp",
      lifecycleStage: "proposal",
      leadTemperature: "cold",
      priority: "low",
      score: 58,
      estimatedValueCents: 189000,
      assignedTo: "Camila",
      lastContactAt: "2026-06-03T09:30:00-03:00",
      labelIds: ["lab_beauty", "lab_instagram"]
    },
    {
      id: "end_nina_prado",
      crmClientId: "cli_nina_store",
      fullName: "Nina Prado",
      companyName: "@ninaprado.store",
      phone: null,
      instagramHandle: "@ninaprado.store",
      email: "nina@ninaprado.com.br",
      originChannel: "instagram",
      lifecycleStage: "new",
      leadTemperature: "hot",
      priority: "high",
      score: 81,
      estimatedValueCents: 260000,
      assignedTo: "Joao",
      lastContactAt: "2026-06-03T10:24:00-03:00",
      labelIds: ["lab_ecommerce", "lab_direct", "lab_urgent"]
    },
    {
      id: "end_casa_vitta",
      crmClientId: "cli_casa_vitta",
      fullName: "Casa Vitta",
      companyName: "@casavitta",
      phone: null,
      instagramHandle: "@casavitta",
      email: "comercial@casavitta.com.br",
      originChannel: "instagram",
      lifecycleStage: "qualified",
      leadTemperature: "warm",
      priority: "medium",
      score: 69,
      estimatedValueCents: 510000,
      assignedTo: "Rafael",
      lastContactAt: "2026-06-03T10:11:00-03:00",
      labelIds: ["lab_budget", "lab_support"]
    }
  ],
  conversations: [
    {
      id: "conv_mariana_wpp",
      crmClientId: "cli_studio_rocha",
      endCustomerId: "end_mariana_rocha",
      channelType: "whatsapp",
      status: "waiting_agent",
      stage: "Proposta comercial",
      slaStatus: "on_time",
      lastMessagePreview: "Consigo fechar ainda hoje se a proposta incluir treinamento da equipe.",
      lastMessageAt: "2026-06-03T10:18:00-03:00",
      unreadCount: 1
    },
    {
      id: "conv_lucas_wpp",
      crmClientId: "cli_almeida_foods",
      endCustomerId: "end_lucas_almeida",
      channelType: "whatsapp",
      status: "waiting_agent",
      stage: "Qualificacao",
      slaStatus: "warning",
      lastMessagePreview: "Preciso integrar duas lojas e visualizar os pedidos por unidade.",
      lastMessageAt: "2026-06-03T10:03:00-03:00",
      unreadCount: 2
    },
    {
      id: "conv_bianca_wpp",
      crmClientId: "cli_bia_beauty",
      endCustomerId: "end_bianca_nunes",
      channelType: "whatsapp",
      status: "waiting_customer",
      stage: "Apresentacao",
      slaStatus: "on_time",
      lastMessagePreview: "Pode me mandar os planos para atendimento no Instagram tambem?",
      lastMessageAt: "2026-06-03T09:30:00-03:00",
      unreadCount: 0
    },
    {
      id: "conv_nina_ig",
      crmClientId: "cli_nina_store",
      endCustomerId: "end_nina_prado",
      channelType: "instagram",
      status: "waiting_agent",
      stage: "Primeiro contato",
      slaStatus: "warning",
      lastMessagePreview: "Vi o post e queria entender como funciona para loja online.",
      lastMessageAt: "2026-06-03T10:24:00-03:00",
      unreadCount: 1
    },
    {
      id: "conv_casa_vitta_ig",
      crmClientId: "cli_casa_vitta",
      endCustomerId: "end_casa_vitta",
      channelType: "instagram",
      status: "waiting_agent",
      stage: "Diagnostico",
      slaStatus: "on_time",
      lastMessagePreview: "Tem como separar mensagens de orcamento e suporte?",
      lastMessageAt: "2026-06-03T10:11:00-03:00",
      unreadCount: 1
    }
  ],
  messages: [
    ["msg_1", "conv_mariana_wpp", "end_customer", "Cliente", "Oi, recebi a apresentacao. Gostei bastante do fluxo de atendimento.", "2026-06-03T10:12:00-03:00"],
    ["msg_2", "conv_mariana_wpp", "agent", "Agente", "Perfeito, Mariana. Separei uma proposta com implantacao assistida e treinamento para sua equipe.", "2026-06-03T10:14:00-03:00"],
    ["msg_3", "conv_mariana_wpp", "end_customer", "Cliente", "Consigo fechar ainda hoje se a proposta incluir treinamento da equipe.", "2026-06-03T10:18:00-03:00"],
    ["msg_4", "conv_lucas_wpp", "end_customer", "Cliente", "Tenho duas lojas e quero organizar atendimento e pedidos.", "2026-06-03T09:55:00-03:00"],
    ["msg_5", "conv_lucas_wpp", "agent", "Agente", "Consigo mapear isso com voce. As lojas usam o mesmo cardapio?", "2026-06-03T09:58:00-03:00"],
    ["msg_6", "conv_lucas_wpp", "end_customer", "Cliente", "Quase o mesmo, mas os responsaveis sao diferentes.", "2026-06-03T10:03:00-03:00"],
    ["msg_7", "conv_bianca_wpp", "end_customer", "Cliente", "Estou procurando algo simples para centralizar mensagens.", "2026-06-03T09:22:00-03:00"],
    ["msg_8", "conv_bianca_wpp", "agent", "Agente", "Claro. O plano inicial cobre WhatsApp e Instagram com historico por cliente.", "2026-06-03T09:24:00-03:00"],
    ["msg_9", "conv_bianca_wpp", "end_customer", "Cliente", "Pode me mandar os planos para atendimento no Instagram tambem?", "2026-06-03T09:30:00-03:00"],
    ["msg_10", "conv_nina_ig", "end_customer", "Cliente", "Ola! Vi o post e queria entender como funciona para loja online.", "2026-06-03T10:21:00-03:00"],
    ["msg_11", "conv_nina_ig", "agent", "Agente", "Oi, Nina. Voce quer centralizar directs e WhatsApp em uma unica fila?", "2026-06-03T10:22:00-03:00"],
    ["msg_12", "conv_nina_ig", "end_customer", "Cliente", "Sim, principalmente para nao perder pergunta sobre produto.", "2026-06-03T10:24:00-03:00"],
    ["msg_13", "conv_casa_vitta_ig", "end_customer", "Cliente", "Tem como separar mensagens de orcamento e suporte?", "2026-06-03T10:05:00-03:00"],
    ["msg_14", "conv_casa_vitta_ig", "agent", "Agente", "Sim. Podemos criar filas por tipo de demanda, com tags e responsaveis.", "2026-06-03T10:07:00-03:00"],
    ["msg_15", "conv_casa_vitta_ig", "end_customer", "Cliente", "Isso ajudaria muito nosso time comercial.", "2026-06-03T10:11:00-03:00"]
  ].map(([id, conversationId, senderType, senderName, body, sentAt]) => ({
    id,
    conversationId,
    senderType,
    senderName,
    body,
    sentAt
  })),
  tasks: [
    { id: "task_1", endCustomerId: "end_mariana_rocha", title: "Enviar proposta revisada", status: "open", ownerName: "Camila" },
    { id: "task_2", endCustomerId: "end_mariana_rocha", title: "Qualificar orcamento", status: "done", ownerName: "Camila" },
    { id: "task_3", endCustomerId: "end_mariana_rocha", title: "Agendar follow-up", status: "open", ownerName: "Camila" }
  ]
};

function cloneDatabase(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadCrmDatabase() {
  const storedVersion = Number(localStorage.getItem("stn_crm_db_version"));
  const storedDatabase = localStorage.getItem("stn_crm_db");

  if (storedDatabase && storedVersion === CRM_DATABASE_VERSION) {
    return JSON.parse(storedDatabase);
  }

  const seed = cloneDatabase(CRM_DATABASE_SEED);
  localStorage.setItem("stn_crm_db_version", String(CRM_DATABASE_VERSION));
  localStorage.setItem("stn_crm_db", JSON.stringify(seed));
  return seed;
}

function saveCrmDatabase(database) {
  localStorage.setItem("stn_crm_db_version", String(CRM_DATABASE_VERSION));
  localStorage.setItem("stn_crm_db", JSON.stringify(database));
}

window.CRMDatabase = {
  load: loadCrmDatabase,
  save: saveCrmDatabase,
  seed: CRM_DATABASE_SEED,
  version: CRM_DATABASE_VERSION
};
