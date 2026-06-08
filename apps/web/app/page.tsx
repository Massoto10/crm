"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";

type View = "dashboard" | "clients" | "chats";
type Channel = "whatsapp" | "instagram";
type Stage = "new" | "qualified" | "proposal" | "won";

type Label = {
  id: string;
  name: string;
  color: string;
  category: string;
};

type Task = {
  id: string;
  title: string;
  status: "open" | "done" | "canceled";
};

type Message = {
  id: string;
  senderType: "agent" | "end_customer" | "system";
  senderName: string;
  body: string;
  sentAt: string;
};

type Conversation = {
  id: string;
  channelType: Channel;
  status: string;
  stage: string;
  slaStatus: "on_time" | "warning" | "late";
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  crmClient: {
    tradeName: string;
    classification: string;
    segment: string;
    ownerName: string;
  };
  endCustomer: {
    id: string;
    fullName: string;
    companyName: string | null;
    leadTemperature: "hot" | "warm" | "cold";
    priority: "high" | "medium" | "low";
    estimatedValueCents: number;
    assignedTo: string | null;
    lastContactAt: string | null;
    labels: Array<{ label: Label }>;
    tasks: Task[];
  };
  messages?: Message[];
};

type ClientCard = {
  id: string;
  name: string;
  company: string;
  crmClient: string;
  stage: Stage;
  temperature: "hot" | "warm" | "cold";
  priority: "high" | "medium" | "low";
  value: number;
  owner: string;
  labels: Label[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

const stages: Array<{ id: Stage; title: string; hint: string }> = [
  { id: "new", title: "Entrada", hint: "Novos contatos" },
  { id: "qualified", title: "Qualificacao", hint: "Perfil e necessidade" },
  { id: "proposal", title: "Proposta", hint: "Negociacao ativa" },
  { id: "won", title: "Fechados", hint: "Clientes ganhos" }
];

const fallbackConversations: Conversation[] = [
  {
    id: "conv_mariana_wpp",
    channelType: "whatsapp",
    status: "waiting_agent",
    stage: "Proposta comercial",
    slaStatus: "on_time",
    lastMessagePreview: "Consigo fechar ainda hoje se a proposta incluir treinamento da equipe.",
    lastMessageAt: "2026-06-03T10:18:00-03:00",
    unreadCount: 1,
    crmClient: { tradeName: "Studio Rocha", classification: "strategic", segment: "Arquitetura", ownerName: "Camila" },
    endCustomer: {
      id: "end_mariana_rocha",
      fullName: "Mariana Rocha",
      companyName: "Studio Rocha",
      leadTemperature: "hot",
      priority: "high",
      estimatedValueCents: 840000,
      assignedTo: "Camila",
      lastContactAt: "2026-06-03T10:18:00-03:00",
      labels: [
        { label: { id: "lab_hot", name: "Lead quente", color: "#b94343", category: "deal" } },
        { label: { id: "lab_proposal", name: "Proposta", color: "#206d6f", category: "deal" } }
      ],
      tasks: [{ id: "task_1", title: "Enviar proposta revisada", status: "open" }]
    },
    messages: [
      { id: "m1", senderType: "end_customer", senderName: "Cliente", body: "Oi, recebi a apresentacao.", sentAt: "2026-06-03T10:12:00-03:00" },
      { id: "m2", senderType: "agent", senderName: "Agente", body: "Separei uma proposta com implantacao assistida.", sentAt: "2026-06-03T10:14:00-03:00" }
    ]
  },
  {
    id: "conv_lucas_wpp",
    channelType: "whatsapp",
    status: "waiting_agent",
    stage: "Qualificacao",
    slaStatus: "warning",
    lastMessagePreview: "Preciso integrar duas lojas e visualizar os pedidos por unidade.",
    lastMessageAt: "2026-06-03T10:03:00-03:00",
    unreadCount: 2,
    crmClient: { tradeName: "Almeida Foods", classification: "growth", segment: "Restaurante", ownerName: "Rafael" },
    endCustomer: {
      id: "end_lucas_almeida",
      fullName: "Lucas Almeida",
      companyName: "Almeida Foods",
      leadTemperature: "warm",
      priority: "medium",
      estimatedValueCents: 320000,
      assignedTo: "Rafael",
      lastContactAt: "2026-06-03T10:03:00-03:00",
      labels: [
        { label: { id: "lab_multiunit", name: "Multiunidade", color: "#bd6a18", category: "profile" } },
        { label: { id: "lab_restaurant", name: "Restaurante", color: "#24875d", category: "profile" } }
      ],
      tasks: []
    },
    messages: []
  },
  {
    id: "conv_nina_ig",
    channelType: "instagram",
    status: "waiting_agent",
    stage: "Primeiro contato",
    slaStatus: "warning",
    lastMessagePreview: "Vi o post e queria entender como funciona para loja online.",
    lastMessageAt: "2026-06-03T10:24:00-03:00",
    unreadCount: 1,
    crmClient: { tradeName: "Nina Prado Store", classification: "growth", segment: "E-commerce", ownerName: "Joao" },
    endCustomer: {
      id: "end_nina_prado",
      fullName: "Nina Prado",
      companyName: "@ninaprado.store",
      leadTemperature: "hot",
      priority: "high",
      estimatedValueCents: 260000,
      assignedTo: "Joao",
      lastContactAt: "2026-06-03T10:24:00-03:00",
      labels: [
        { label: { id: "lab_ecommerce", name: "E-commerce", color: "#2f6ecb", category: "profile" } },
        { label: { id: "lab_direct", name: "Direct", color: "#c23a78", category: "channel" } }
      ],
      tasks: []
    },
    messages: []
  }
];

export default function HomePage() {
  const [view, setView] = useState<View>("dashboard");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [conversations, setConversations] = useState<Conversation[]>(fallbackConversations);
  const [selectedId, setSelectedId] = useState<string | null>(fallbackConversations[0]?.id ?? null);
  const [detail, setDetail] = useState<Conversation | null>(fallbackConversations[0] ?? null);
  const [clients, setClients] = useState<ClientCard[]>(() => buildClients(fallbackConversations));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(fallbackConversations[0]?.endCustomer.id ?? null);
  const [newLabel, setNewLabel] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadConversations() {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/api/conversations?channel=${channel}`);
      if (!response.ok) throw new Error("API unavailable");
      const data = (await response.json()) as Conversation[];
      setConversations(data);
      setSelectedId(data[0]?.id ?? null);
      setIsLoading(false);
    }

    loadConversations().catch(() => {
      const fallback = fallbackConversations.filter((conversation) => conversation.channelType === channel);
      setConversations(fallback);
      setSelectedId(fallback[0]?.id ?? null);
      setIsLoading(false);
    });
  }, [channel]);

  useEffect(() => {
    async function loadAllClients() {
      try {
        const response = await fetch(`${apiUrl}/api/conversations`);
        if (!response.ok) throw new Error("API unavailable");
        const data = (await response.json()) as Conversation[];
        setClients(buildClients(data));
        setSelectedClientId(data[0]?.endCustomer.id ?? null);
      } catch {
        setClients(buildClients(fallbackConversations));
      }
    }

    loadAllClients();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    async function loadDetail() {
      const response = await fetch(`${apiUrl}/api/conversations/${selectedId}`);
      if (!response.ok) throw new Error("API unavailable");
      setDetail((await response.json()) as Conversation);
    }

    loadDetail().catch(() => {
      setDetail(conversations.find((conversation) => conversation.id === selectedId) ?? null);
    });
  }, [selectedId, conversations]);

  const selected = useMemo(
    () => detail ?? conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, detail, selectedId]
  );

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null;

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;

    try {
      await fetch(`${apiUrl}/api/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply })
      });
      const response = await fetch(`${apiUrl}/api/conversations/${selected.id}`);
      setDetail((await response.json()) as Conversation);
    } catch {
      const sentAt = new Date().toISOString();
      setDetail({
        ...selected,
        messages: [
          ...(selected.messages ?? []),
          { id: `local_${Date.now()}`, senderType: "agent", senderName: "Agente", body: reply, sentAt }
        ]
      });
    }

    setReply("");
  }

  function moveClient(clientId: string, stage: Stage) {
    setClients((current) => current.map((client) => (client.id === clientId ? { ...client, stage } : client)));
  }

  function addLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || !newLabel.trim()) return;

    const label: Label = {
      id: `label_${Date.now()}`,
      name: newLabel.trim(),
      color: "#206d6f",
      category: "profile"
    };

    setClients((current) =>
      current.map((client) => (client.id === selectedClient.id ? { ...client, labels: [...client.labels, label] } : client))
    );
    setNewLabel("");
  }

  function removeLabel(clientId: string, labelId: string) {
    setClients((current) =>
      current.map((client) =>
        client.id === clientId ? { ...client, labels: client.labels.filter((label) => label.id !== labelId) } : client
      )
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>STN CRM</strong>
            <span>Atendimento</span>
          </div>
        </div>

        <nav className="nav-groups">
          <div className="nav-group">
            <p>Operacao</p>
            <NavButton active={view === "dashboard"} icon="D" label="Dash" onClick={() => setView("dashboard")} />
            <NavButton active={view === "clients"} icon="U" label="Clientes" count={clients.length} onClick={() => setView("clients")} />
            <NavButton active={view === "chats"} icon="C" label="Chats" count={conversations.length} onClick={() => setView("chats")} />
          </div>
          <div className="nav-group">
            <p>Gestao</p>
            <button className="nav-link" type="button">
              <span className="nav-icon">R</span>
              <span>Relatorios</span>
            </button>
            <button className="nav-link" type="button">
              <span className="nav-icon">A</span>
              <span>Ajustes</span>
            </button>
          </div>
        </nav>
      </aside>

      <main className="workspace">
        {view === "dashboard" && <DashboardView clients={clients} conversations={conversations} />}
        {view === "clients" && (
          <ClientsView
            clients={clients}
            selectedClient={selectedClient}
            newLabel={newLabel}
            onAddLabel={addLabel}
            onChangeLabel={setNewLabel}
            onMoveClient={moveClient}
            onRemoveLabel={removeLabel}
            onSelectClient={setSelectedClientId}
          />
        )}
        {view === "chats" && (
          <ChatsView
            channel={channel}
            conversations={conversations}
            isLoading={isLoading}
            reply={reply}
            selected={selected}
            selectedId={selectedId}
            onChannelChange={setChannel}
            onReplyChange={setReply}
            onSelectConversation={setSelectedId}
            onSubmitReply={submitReply}
          />
        )}
      </main>
    </div>
  );
}

function NavButton({
  active,
  count,
  icon,
  label,
  onClick
}: {
  active: boolean;
  count?: number;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`nav-link ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {typeof count === "number" && <small>{count}</small>}
    </button>
  );
}

function DashboardView({ clients, conversations }: { clients: ClientCard[]; conversations: Conversation[] }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Visao geral</p>
          <h1>Dashboard</h1>
        </div>
        <button className="primary-button" type="button">Configurar metricas</button>
      </header>

      <section className="metric-row" aria-label="Resumo do dashboard">
        <Metric title="Clientes ativos" value={String(clients.length)} detail="Base em atendimento" />
        <Metric title="Conversas abertas" value={String(conversations.length)} detail="WPP e Instagram" />
        <Metric title="Ticket em aberto" value={money(clients.reduce((total, client) => total + client.value, 0))} detail="Kanban comercial" />
        <Metric title="SLA critico" value="0" detail="Em desenvolvimento" />
      </section>

      <section className="development-board">
        <div className="development-panel">
          <span className="status-pill">Em desenvolvimento</span>
          <h2>Dash operacional</h2>
          <p>Esta tela sera usada para acompanhar fila, receita estimada, conversao por canal e desempenho dos atendentes.</p>
        </div>
        <div className="development-grid">
          <div />
          <div />
          <div />
          <div />
        </div>
      </section>
    </>
  );
}

function ClientsView({
  clients,
  selectedClient,
  newLabel,
  onAddLabel,
  onChangeLabel,
  onMoveClient,
  onRemoveLabel,
  onSelectClient
}: {
  clients: ClientCard[];
  selectedClient: ClientCard | null;
  newLabel: string;
  onAddLabel: (event: FormEvent<HTMLFormElement>) => void;
  onChangeLabel: (value: string) => void;
  onMoveClient: (clientId: string, stage: Stage) => void;
  onRemoveLabel: (clientId: string, labelId: string) => void;
  onSelectClient: (clientId: string) => void;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Clientes dos clientes</p>
          <h1>Clientes</h1>
        </div>
        <div className="topbar-actions">
          <label className="search-box">
            <span>Q</span>
            <input type="search" placeholder="Buscar cliente, empresa ou label" />
          </label>
          <button className="primary-button" type="button">Novo cliente</button>
        </div>
      </header>

      <section className="clients-layout">
        <div className="kanban-board" aria-label="Kanban de clientes">
          {stages.map((stage) => {
            const columnClients = clients.filter((client) => client.stage === stage.id);
            return (
              <div
                key={stage.id}
                className="kanban-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, stage.id, onMoveClient)}
              >
                <div className="kanban-header">
                  <div>
                    <h2>{stage.title}</h2>
                    <span>{stage.hint}</span>
                  </div>
                  <small>{columnClients.length}</small>
                </div>
                <div className="kanban-list">
                  {columnClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      draggable
                      className={`client-card ${selectedClient?.id === client.id ? "active" : ""}`}
                      onClick={() => onSelectClient(client.id)}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", client.id)}
                    >
                      <div className="client-card-top">
                        <div className="avatar">{initials(client.name)}</div>
                        <div>
                          <strong>{client.name}</strong>
                          <span>{client.company}</span>
                        </div>
                      </div>
                      <p>{client.crmClient} - {temperature(client.temperature)}</p>
                      <div className="tag-list">
                        {client.labels.slice(0, 3).map((label) => (
                          <span key={label.id} className="tag" style={{ borderColor: label.color, color: label.color }}>
                            {label.name}
                          </span>
                        ))}
                      </div>
                      <div className="client-card-footer">
                        <span>{client.owner}</span>
                        <strong>{money(client.value)}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="client-editor" aria-label="Edicao de cliente">
          {selectedClient ? (
            <>
              <div className="profile-card">
                <div className="profile-top">
                  <div className="avatar large">{initials(selectedClient.name)}</div>
                  <div>
                    <h2>{selectedClient.name}</h2>
                    <span>{selectedClient.company}</span>
                  </div>
                </div>
                <div className="profile-grid">
                  <Info label="Etapa" value={stageTitle(selectedClient.stage)} />
                  <Info label="Valor" value={money(selectedClient.value)} />
                  <Info label="Responsavel" value={selectedClient.owner} />
                  <Info label="Prioridade" value={priority(selectedClient.priority)} />
                </div>
              </div>

              <div className="side-section">
                <div className="section-title">
                  <h3>Labels</h3>
                </div>
                <form className="label-form" onSubmit={onAddLabel}>
                  <input value={newLabel} onChange={(event) => onChangeLabel(event.target.value)} placeholder="Nova label" />
                  <button className="primary-button slim" type="submit">Adicionar</button>
                </form>
                <div className="editable-labels">
                  {selectedClient.labels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      className="editable-tag"
                      style={{ borderColor: label.color, color: label.color }}
                      onClick={() => onRemoveLabel(selectedClient.id, label.id)}
                    >
                      {label.name}
                      <span>x</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="side-section">
                <div className="section-title">
                  <h3>Mover etapa</h3>
                </div>
                <div className="stage-buttons">
                  {stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      className={`filter-chip ${selectedClient.stage === stage.id ? "active" : ""}`}
                      onClick={() => onMoveClient(selectedClient.id, stage.id)}
                    >
                      {stage.title}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Selecione um cliente.</div>
          )}
        </aside>
      </section>
    </>
  );
}

function ChatsView({
  channel,
  conversations,
  isLoading,
  reply,
  selected,
  selectedId,
  onChannelChange,
  onReplyChange,
  onSelectConversation,
  onSubmitReply
}: {
  channel: Channel;
  conversations: Conversation[];
  isLoading: boolean;
  reply: string;
  selected: Conversation | null;
  selectedId: string | null;
  onChannelChange: (channel: Channel) => void;
  onReplyChange: (reply: string) => void;
  onSelectConversation: (id: string) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Central de relacionamento</p>
          <h1>Chats</h1>
        </div>
        <div className="topbar-actions">
          <label className="search-box">
            <span>Q</span>
            <input type="search" placeholder="Buscar cliente, tag ou conversa" />
          </label>
          <button className="primary-button" type="button">Nova conversa</button>
        </div>
      </header>

      <section className="metric-row" aria-label="Resumo dos chats">
        <Metric title="Fila aberta" value={String(conversations.length)} detail="Conversas do canal" />
        <Metric title="Tempo medio" value="04m 18s" detail="SLA operacional" />
        <Metric title="Conversao" value="31%" detail="Leads para proposta" />
        <Metric title="Satisfacao" value="92" detail="NPS da semana" />
      </section>

      <section className="chat-board">
        <div className="inbox-panel">
          <div className="panel-header">
            <div>
              <h2>Inbox</h2>
              <span>Priorize conversas por canal e SLA.</span>
            </div>
          </div>

          <div className="channel-tabs" role="tablist" aria-label="Canais">
            <button className={`channel-tab ${channel === "whatsapp" ? "active" : ""}`} type="button" onClick={() => onChannelChange("whatsapp")}>
              <span className="channel-icon wpp">W</span>
              WhatsApp
            </button>
            <button className={`channel-tab ${channel === "instagram" ? "active" : ""}`} type="button" onClick={() => onChannelChange("instagram")}>
              <span className="channel-icon instagram">IG</span>
              Instagram
            </button>
          </div>

          <div className="quick-filters" aria-label="Filtros rapidos">
            <button className="filter-chip active" type="button">Todos</button>
            <button className="filter-chip" type="button">Nao lidos</button>
            <button className="filter-chip" type="button">Alta prioridade</button>
          </div>

          <div className="conversation-list">
            {isLoading ? (
              <div className="empty-state">Carregando conversas...</div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-card ${conversation.id === selectedId ? "active" : ""}`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="avatar">{initials(conversation.endCustomer.fullName)}</div>
                  <div className="conversation-main">
                    <strong>{conversation.endCustomer.fullName}</strong>
                    <span>{conversation.lastMessagePreview}</span>
                    <em>{conversation.crmClient.tradeName} - {temperature(conversation.endCustomer.leadTemperature)}</em>
                  </div>
                  <div className="conversation-meta">
                    <time>{elapsed(conversation.lastMessageAt)}</time>
                    <span className={`priority ${conversation.endCustomer.priority}`} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selected ? (
          <>
            <section className="chat-detail" aria-label="Detalhes da conversa">
              <div className="detail-header">
                <div className="contact-summary">
                  <div className="avatar">{initials(selected.endCustomer.fullName)}</div>
                  <div>
                    <h2>{selected.endCustomer.fullName}</h2>
                    <span>{selected.channelType} - {temperature(selected.endCustomer.leadTemperature)} - {selected.crmClient.tradeName}</span>
                  </div>
                </div>
                <button className="primary-button slim" type="button">Assumir</button>
              </div>

              <div className="conversation-stage">
                <div>
                  <span className="stage-label">Etapa atual</span>
                  <strong>{selected.stage}</strong>
                </div>
                <div className="stage-track" aria-hidden="true">
                  <span className="done" />
                  <span className="done" />
                  <span className="current" />
                  <span />
                </div>
              </div>

              <div className="message-thread">
                {(selected.messages ?? []).map((message) => (
                  <div key={message.id} className={`message ${message.senderType === "agent" ? "agent" : ""}`}>
                    <strong>{message.senderName}</strong>
                    <p>{message.body}</p>
                    <time>{time(message.sentAt)}</time>
                  </div>
                ))}
              </div>

              <form className="reply-box" onSubmit={onSubmitReply}>
                <textarea rows={3} placeholder="Escreva uma resposta profissional..." value={reply} onChange={(event) => onReplyChange(event.target.value)} />
                <button className="primary-button send" type="submit">Enviar</button>
              </form>
            </section>

            <aside className="profile-panel" aria-label="Perfil do cliente">
              <div className="profile-card">
                <div className="profile-top">
                  <div className="avatar large">{initials(selected.endCustomer.fullName)}</div>
                  <div>
                    <h2>{selected.endCustomer.fullName}</h2>
                    <span>{selected.endCustomer.companyName} - {classification(selected.crmClient.classification)}</span>
                  </div>
                </div>
                <div className="profile-grid">
                  <Info label="Valor estimado" value={money(selected.endCustomer.estimatedValueCents)} />
                  <Info label="Responsavel" value={selected.endCustomer.assignedTo ?? "-"} />
                  <Info label="Ultimo contato" value={selected.endCustomer.lastContactAt ? elapsed(selected.endCustomer.lastContactAt) : "-"} />
                  <Info label="SLA" value={sla(selected.slaStatus)} />
                </div>
              </div>

              <div className="side-section">
                <div className="section-title">
                  <h3>Etiquetas</h3>
                </div>
                <div className="tag-list">
                  {selected.endCustomer.labels.map(({ label }) => (
                    <span key={label.id} className="tag" style={{ borderColor: label.color, color: label.color }}>{label.name}</span>
                  ))}
                </div>
              </div>

              <div className="side-section">
                <div className="section-title">
                  <h3>Proximas acoes</h3>
                </div>
                <ul className="task-list">
                  {selected.endCustomer.tasks.map((task) => (
                    <li key={task.id}>
                      <span className={`task-box ${task.status === "done" ? "checked" : ""}`} />
                      {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </>
        ) : (
          <div className="empty-state large">Nenhuma conversa encontrada.</div>
        )}
      </section>
    </>
  );
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function handleDrop(event: DragEvent<HTMLDivElement>, stage: Stage, onMoveClient: (clientId: string, stage: Stage) => void) {
  event.preventDefault();
  const clientId = event.dataTransfer.getData("text/plain");
  if (clientId) onMoveClient(clientId, stage);
}

function buildClients(conversations: Conversation[]): ClientCard[] {
  const stageMap: Record<string, Stage> = {
    new: "new",
    qualified: "qualified",
    proposal: "proposal",
    won: "won",
    "Primeiro contato": "new",
    Qualificacao: "qualified",
    Apresentacao: "qualified",
    "Proposta comercial": "proposal"
  };

  const byCustomer = new Map<string, ClientCard>();
  conversations.forEach((conversation) => {
    if (byCustomer.has(conversation.endCustomer.id)) return;
    byCustomer.set(conversation.endCustomer.id, {
      id: conversation.endCustomer.id,
      name: conversation.endCustomer.fullName,
      company: conversation.endCustomer.companyName ?? conversation.crmClient.tradeName,
      crmClient: conversation.crmClient.tradeName,
      stage: stageMap[conversation.stage] ?? "new",
      temperature: conversation.endCustomer.leadTemperature,
      priority: conversation.endCustomer.priority,
      value: conversation.endCustomer.estimatedValueCents,
      owner: conversation.endCustomer.assignedTo ?? conversation.crmClient.ownerName,
      labels: conversation.endCustomer.labels.map(({ label }) => label)
    });
  });
  return Array.from(byCustomer.values());
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

function elapsed(date: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60)} h`;
}

function time(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function temperature(value: string) {
  return { hot: "Lead quente", warm: "Lead morno", cold: "Lead frio" }[value] ?? value;
}

function classification(value: string) {
  return { strategic: "Estrategico", growth: "Crescimento", standard: "Padrao", at_risk: "Em risco" }[value] ?? value;
}

function sla(value: string) {
  return { on_time: "No prazo", warning: "Atencao", late: "Atrasado" }[value] ?? value;
}

function stageTitle(value: Stage) {
  return stages.find((stage) => stage.id === value)?.title ?? value;
}

function priority(value: string) {
  return { high: "Alta", medium: "Media", low: "Baixa" }[value] ?? value;
}
