'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import type {
  ChatMessage,
  Contact,
  Conversation,
  ConversationStatus,
  Operator,
  PipelineStageOption,
  ScheduleItem,
  SessionUser,
} from '@/lib/types';

type Toast = { id: number; message: string; tone: 'success' | 'danger' | 'info' };
type Department = { id: string; name: string; permissions?: { views?: Record<string, boolean>; scope?: 'own' | 'all' } };
type WhatsappStatus = { instanceName: string | null; status: string; qr: string | null };

type ApiCurrentUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  crmClientId: string;
  departmentId?: string | null;
  permissions?: { views?: Record<string, boolean>; scope?: 'own' | 'all' };
};

type ApiCustomer = {
  id: string;
  fullName: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  lifecycleStage?: string;
  estimatedValueCents?: number;
  notes?: string | null;
  assignedTo?: string | null;
  lastContactAt?: string | null;
  pipelineStage?: { id: string; name: string; color: string; order: number } | null;
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
};

type ApiConversation = {
  id: string;
  endCustomerId: string;
  channelType: string;
  status: ConversationStatus;
  stage: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedAgent?: { id: string; name: string } | null;
  endCustomer: ApiCustomer;
  messages?: ApiMessage[];
};

type ApiMessage = {
  id: string;
  conversationId: string;
  senderType: 'agent' | 'end_customer' | 'system';
  body: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  sentAt: string;
};

type ApiScheduledMessage = {
  id: string;
  conversationId?: string | null;
  endCustomerId?: string | null;
  agentId?: string | null;
  body: string;
  scheduledAt: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'canceled';
  endCustomer?: ApiCustomer | null;
  conversation?: { endCustomer?: ApiCustomer | null } | null;
};

type ApiAgent = {
  id: string;
  name: string;
  email: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  isActive: boolean;
};

type CrmContextValue = {
  ready: boolean;
  loading: boolean;
  session: SessionUser | null;
  contacts: Contact[];
  conversations: Conversation[];
  messages: ChatMessage[];
  schedules: ScheduleItem[];
  operators: Operator[];
  departments: Department[];
  pipelineStages: PipelineStageOption[];
  settings: Record<string, string>;
  whatsapp: WhatsappStatus | null;
  toasts: Toast[];
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createContact: (input: { name: string; phone?: string; email?: string; value: number; stageId?: string }) => Promise<void>;
  updateContactStage: (contactId: string, pipelineStageId: string | null) => Promise<void>;
  createPipelineStage: (input: { name: string; color: string }) => Promise<void>;
  updatePipelineStage: (stageId: string, input: { name: string; color: string }) => Promise<void>;
  removePipelineStage: (stageId: string) => Promise<void>;
  updateContactDetails: (contactId: string, input: { value: number; notes: string }) => Promise<void>;
  addContactLabel: (contactId: string, name: string) => Promise<void>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  closeConversation: (conversationId: string) => Promise<void>;
  setConversationStatus: (conversationId: string, status: Extract<ConversationStatus, 'open' | 'waiting_customer' | 'waiting_agent'>) => Promise<void>;
  createSchedule: (input: { contactId: string; body: string; scheduledAt: string }) => Promise<void>;
  createOperator: (input: { name: string; email: string; departmentId?: string }) => Promise<{ temporaryPassword: string }>;
  setOperatorActive: (operator: Operator, isActive: boolean) => Promise<void>;
  saveSettings: (values: Record<string, string>) => Promise<void>;
  notify: (message: string, tone?: Toast['tone']) => void;
};

// Mesmo intervalo que o front anterior usava. Curto o bastante para o operador
// nao perceber atraso, longo o bastante para nao martelar a API com uma sala
// cheia de atendentes com a aba aberta.
const CONVERSATION_POLL_MS = 8000;

const CrmContext = createContext<CrmContextValue | null>(null);

const lifecycleLabels: Record<string, string> = {
  new: 'Novo lead',
  qualified: 'Qualificado',
  proposal: 'Proposta',
  won: 'Cliente',
  lost: 'Perdido',
  support: 'Suporte',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sem contato';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function toContact(customer: ApiCustomer): Contact {
  return {
    id: customer.id,
    name: customer.fullName,
    phone: customer.phone ?? 'Não informado',
    email: customer.email ?? 'Não informado',
    owner: customer.assignedTo ?? 'Não atribuído',
    status: lifecycleLabels[customer.lifecycleStage ?? 'new'] ?? customer.lifecycleStage ?? 'Novo lead',
    stage: customer.pipelineStage?.name ?? 'Sem etapa',
    stageId: customer.pipelineStage?.id,
    value: (customer.estimatedValueCents ?? 0) / 100,
    notes: customer.notes ?? '',
    lastContact: formatDate(customer.lastContactAt),
    tags: customer.labels?.map(({ label }) => label.name) ?? [],
  };
}

function toConversation(conversation: ApiConversation): Conversation {
  const customer = toContact(conversation.endCustomer);
  return {
    id: conversation.id,
    contactId: conversation.endCustomerId,
    channel: conversation.channelType,
    name: customer.name,
    phone: customer.phone,
    preview: conversation.lastMessagePreview,
    time: formatTime(conversation.lastMessageAt),
    unread: conversation.unreadCount,
    status: conversation.status,
    stage: customer.stage === 'Sem etapa' ? conversation.stage : customer.stage,
    stageId: customer.stageId,
    owner: conversation.assignedAgent?.name ?? customer.owner,
    tags: customer.tags,
  };
}

function toMessage(message: ApiMessage): ChatMessage {
  const mediaType = ['audio', 'image', 'video', 'document', 'sticker'].includes(message.mediaType ?? '')
    ? message.mediaType as ChatMessage['type']
    : 'text';

  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: message.senderType === 'agent' ? 'out' : 'in',
    type: mediaType,
    content: message.body,
    mediaUrl: message.mediaUrl,
    time: formatTime(message.sentAt),
  };
}

function toSchedule(item: ApiScheduledMessage, session: SessionUser | null): ScheduleItem {
  const scheduled = new Date(item.scheduledAt);
  const customer = item.endCustomer ?? item.conversation?.endCustomer;
  const status = {
    pending: 'Agendado',
    processing: 'Pendente',
    sent: 'Enviado',
    failed: 'Falhou',
    canceled: 'Cancelado',
  }[item.status] as ScheduleItem['status'];
  return {
    id: item.id,
    conversationId: item.conversationId ?? undefined,
    contactId: item.endCustomerId ?? customer?.id,
    title: item.body,
    contact: customer?.fullName ?? 'Contato não disponível',
    date: new Intl.DateTimeFormat('pt-BR').format(scheduled),
    time: formatTime(item.scheduledAt),
    owner: item.agentId === session?.id ? session?.name ?? 'Agente' : 'Agente',
    status,
  };
}

function toOperator(agent: ApiAgent, departments: Department[]): Operator {
  const configuredDepartment = departments.find((item) => item.id === agent.departmentId);
  const permissions = configuredDepartment?.permissions;
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    departmentId: agent.departmentId,
    department: agent.department?.name ?? configuredDepartment?.name ?? 'Sem departamento',
    status: agent.isActive ? 'Ativo' : 'Inativo',
    scope: permissions?.scope === 'all' ? 'all' : 'own',
    views: Object.entries(permissions?.views ?? {}).filter(([, allowed]) => allowed).map(([view]) => view),
  };
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [whatsapp, setWhatsapp] = useState<WhatsappStatus | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Conversa aberta no momento, para o poll saber qual detalhe recarregar.
  // Ref e nao estado: mudar isto nao precisa re-renderizar nem recriar o timer.
  const openConversationIdRef = useRef<string | null>(null);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const loadData = useCallback(async (currentSession: SessionUser) => {
    const [clientResult, contactResult, conversationResult, scheduleResult, departmentResult, agentResult, stageResult, settingsResult, whatsappResult] = await Promise.allSettled([
      apiFetch<{ id: string; tradeName: string }>('/crm-clients'),
      apiFetch<ApiCustomer[]>('/end-customers?limit=100'),
      apiFetch<ApiConversation[]>('/conversations'),
      apiFetch<ApiScheduledMessage[]>('/scheduled-messages'),
      apiFetch<Department[]>('/departments'),
      apiFetch<ApiAgent[]>('/agents'),
      apiFetch<PipelineStageOption[]>('/pipeline-stages'),
      apiFetch<Record<string, string>>(`/settings/${currentSession.institutionId}`),
      apiFetch<WhatsappStatus>(`/whatsapp/${currentSession.institutionId}/status`),
    ]);

    if (clientResult.status === 'fulfilled') {
      setSession((previous) => previous ? { ...previous, institutionName: clientResult.value.tradeName } : previous);
      currentSession = { ...currentSession, institutionName: clientResult.value.tradeName };
    }
    const loadedDepartments = departmentResult.status === 'fulfilled' ? departmentResult.value : [];
    setDepartments(loadedDepartments);
    setContacts(contactResult.status === 'fulfilled' ? contactResult.value.map(toContact) : []);
    setConversations(conversationResult.status === 'fulfilled' ? conversationResult.value.map(toConversation) : []);
    setSchedules(scheduleResult.status === 'fulfilled' ? scheduleResult.value.map((item) => toSchedule(item, currentSession)) : []);
    setPipelineStages(stageResult.status === 'fulfilled' ? stageResult.value : []);
    setOperators(agentResult.status === 'fulfilled' ? agentResult.value.map((agent) => toOperator(agent, loadedDepartments)) : []);
    setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value : {});
    setWhatsapp(whatsappResult.status === 'fulfilled' ? whatsappResult.value : null);
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      await loadData(session);
    } finally {
      setLoading(false);
    }
  }, [loadData, session]);

  const establishSession = useCallback(async (user: ApiCurrentUser) => {
    const nextSession: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === 'admin' ? 'institution_admin' : 'operator',
      institutionId: user.crmClientId,
      department: user.departmentId ?? undefined,
    };
    setSession(nextSession);
    await loadData(nextSession);
    return nextSession;
  }, [loadData]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      setLoading(true);
      try {
        window.sessionStorage.removeItem('stn-crm-access-token');
        const user = await apiFetch<ApiCurrentUser | null>('/auth/me');
        if (active && user) await establishSession(user);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          window.sessionStorage.removeItem('stn-crm-access-token');
        }
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error('Não foi possível restaurar a sessão.', error);
        }
      } finally {
        if (active) {
          setLoading(false);
          setReady(true);
        }
      }
    };
    void restore();
    return () => { active = false; };
  }, [establishSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await apiFetch<{ user: ApiCurrentUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      window.sessionStorage.removeItem('stn-crm-access-token');
      await establishSession(result.user);
      router.push('/dashboard');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível entrar.' };
    } finally {
      setLoading(false);
    }
  }, [establishSession, router]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Mesmo se a rede cair, removemos a sessão local; o cookie é HTTP-only.
    }
    setSession(null);
    setContacts([]);
    setConversations([]);
    setMessages([]);
    setSchedules([]);
    setOperators([]);
    setSettings({});
    setWhatsapp(null);
    window.sessionStorage.removeItem('stn-crm-access-token');
    router.push('/login');
  }, [router]);

  const loadConversation = useCallback(async (id: string) => {
    openConversationIdRef.current = id;
    const conversation = await apiFetch<ApiConversation>(`/conversations/${id}`);
    const mapped = toConversation(conversation);
    setConversations((current) => current.map((item) => item.id === id ? mapped : item));
    setMessages(conversation.messages?.map(toMessage) ?? []);
  }, []);

  /**
   * Mensagem que chega pelo WhatsApp e gravada pelo webhook direto no banco — o
   * navegador nao fica sabendo de nada. Sem este poll a conversa so aparece se o
   * operador recarregar a pagina na mao, que na pratica e "o CRM nao recebe
   * mensagem".
   *
   * Deliberadamente mais magro que refresh(): busca so a lista de conversas e o
   * detalhe da que esta aberta, sem mexer em `loading` — usar refresh() aqui
   * recarregaria nove endpoints e piscaria a tela inteira a cada ciclo.
   */
  useEffect(() => {
    if (!session) return;

    let cancelado = false;
    let emVoo = false;

    const tick = async () => {
      // Aba em segundo plano nao precisa de dado fresco, e evita rajada de
      // requisicao acumulada quando a maquina volta de suspensao.
      if (emVoo || document.visibilityState !== 'visible') return;
      emVoo = true;
      try {
        const lista = await apiFetch<ApiConversation[]>('/conversations');
        if (cancelado) return;
        setConversations(lista.map(toConversation));

        const abertaId = openConversationIdRef.current;
        if (abertaId) {
          const detalhe = await apiFetch<ApiConversation>(`/conversations/${abertaId}`);
          if (!cancelado) setMessages(detalhe.messages?.map(toMessage) ?? []);
        }
      } catch {
        // Falha de rede no poll e silenciosa: a proxima volta resolve, e um
        // toast a cada 8s numa queda de conexao seria pior que o problema.
      } finally {
        emVoo = false;
      }
    };

    const timer = window.setInterval(tick, CONVERSATION_POLL_MS);
    // Voltar para a aba atualiza na hora, sem esperar o proximo ciclo.
    document.addEventListener('visibilitychange', tick);

    return () => {
      cancelado = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [session]);

  const createContact = useCallback(async (input: { name: string; phone?: string; email?: string; value: number; stageId?: string }) => {
    const customer = await apiFetch<ApiCustomer>('/end-customers', {
      method: 'POST',
      body: JSON.stringify({
        fullName: input.name,
        phone: input.phone || undefined,
        email: input.email || undefined,
        estimatedValueCents: Math.round(input.value * 100),
        pipelineStageId: input.stageId || undefined,
      }),
    });
    setContacts((current) => [toContact(customer), ...current]);
  }, []);

  const updateContactStage = useCallback(async (contactId: string, pipelineStageId: string | null) => {
    const customer = await apiFetch<ApiCustomer>(`/end-customers/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pipelineStageId }),
    });
    const mapped = toContact(customer);
    setContacts((current) => current.map((item) => item.id === contactId ? mapped : item));
    setConversations((current) => current.map((item) => item.contactId === contactId ? { ...item, stage: mapped.stage, stageId: mapped.stageId, tags: mapped.tags } : item));
  }, []);

  const createPipelineStage = useCallback(async ({ name, color }: { name: string; color: string }) => {
    await apiFetch('/pipeline-stages', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), color, order: pipelineStages.length }),
    });
    await refresh();
  }, [pipelineStages.length, refresh]);

  const updatePipelineStage = useCallback(async (stageId: string, { name, color }: { name: string; color: string }) => {
    await apiFetch(`/pipeline-stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim(), color }),
    });
    await refresh();
  }, [refresh]);

  const removePipelineStage = useCallback(async (stageId: string) => {
    await apiFetch(`/pipeline-stages/${stageId}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const updateContactDetails = useCallback(async (contactId: string, input: { value: number; notes: string }) => {
    const customer = await apiFetch<ApiCustomer>(`/end-customers/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ estimatedValueCents: Math.round(input.value * 100), notes: input.notes.trim() || null }),
    });
    const mapped = toContact(customer);
    setContacts((current) => current.map((item) => item.id === contactId ? mapped : item));
  }, []);

  const addContactLabel = useCallback(async (contactId: string, name: string) => {
    await apiFetch(`/end-customers/${contactId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    });
    await refresh();
  }, [refresh]);

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    await apiFetch(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    await loadConversation(conversationId);
    await refresh();
  }, [loadConversation, refresh]);

  const closeConversation = useCallback(async (conversationId: string) => {
    await apiFetch(`/conversations/${conversationId}/close`, { method: 'PUT' });
    await refresh();
  }, [refresh]);

  const setConversationStatus = useCallback(async (conversationId: string, status: Extract<ConversationStatus, 'open' | 'waiting_customer' | 'waiting_agent'>) => {
    await apiFetch(`/conversations/${conversationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await refresh();
  }, [refresh]);

  const createSchedule = useCallback(async ({ contactId, body, scheduledAt }: { contactId: string; body: string; scheduledAt: string }) => {
    const conversation = conversations.find((item) => item.contactId === contactId && item.status !== 'closed');
    if (!conversation) throw new Error('Este contato precisa de uma conversa aberta para receber um agendamento.');
    await apiFetch('/scheduled-messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId: conversation.id, endCustomerId: contactId, body, scheduledAt }),
    });
    await refresh();
  }, [conversations, refresh]);

  const createOperator = useCallback(async ({ name, email, departmentId }: { name: string; email: string; departmentId?: string }) => {
    const result = await apiFetch<ApiAgent & { tempPassword: string }>('/agents', {
      method: 'POST',
      body: JSON.stringify({ name, email, role: 'agent', departmentId: departmentId || undefined }),
    });
    setOperators((current) => [...current, toOperator(result, departments)]);
    return { temporaryPassword: result.tempPassword };
  }, [departments]);

  const setOperatorActive = useCallback(async (operator: Operator, isActive: boolean) => {
    const result = await apiFetch<ApiAgent>(`/agents/${operator.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
    setOperators((current) => current.map((item) => item.id === operator.id ? toOperator(result, departments) : item));
  }, [departments]);

  const saveSettings = useCallback(async (values: Record<string, string>) => {
    if (!session?.institutionId) throw new Error('Instituição não identificada na sessão.');
    const saved = await apiFetch<Record<string, string>>(`/settings/${session.institutionId}`, {
      method: 'PUT',
      body: JSON.stringify(values),
    });
    setSettings(saved);
  }, [session?.institutionId]);

  const value = useMemo(() => ({
    ready,
    loading,
    session,
    contacts,
    conversations,
    messages,
    schedules,
    operators,
    departments,
    pipelineStages,
    settings,
    whatsapp,
    toasts,
    login,
    logout,
    refresh,
    loadConversation,
    createContact,
    updateContactStage,
    createPipelineStage,
    updatePipelineStage,
    removePipelineStage,
    updateContactDetails,
    addContactLabel,
    sendMessage,
    closeConversation,
    setConversationStatus,
    createSchedule,
    createOperator,
    setOperatorActive,
    saveSettings,
    notify,
  }), [ready, loading, session, contacts, conversations, messages, schedules, operators, departments, pipelineStages, settings, whatsapp, toasts, login, logout, refresh, loadConversation, createContact, updateContactStage, createPipelineStage, updatePipelineStage, removePipelineStage, updateContactDetails, addContactLabel, sendMessage, closeConversation, setConversationStatus, createSchedule, createOperator, setOperatorActive, saveSettings, notify]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) throw new Error('useCrm precisa ser usado dentro de CrmProvider');
  return context;
}
