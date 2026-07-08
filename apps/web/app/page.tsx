"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ToastEntry = { id: number; msg: string; type: "error" | "success" | "info" };

function useToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counter = useRef(0);
  const toast = useCallback((msg: string, type: ToastEntry["type"] = "info") => {
    const id = ++counter.current;
    console[type === "error" ? "error" : "log"](`[toast][${type}] ${msg}`);
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, toast };
}

type View = "dashboard" | "clients" | "chats" | "settings";
type ChatStatus = "pending" | "active" | "closed";
type Channel = "whatsapp" | "instagram";
type PipelineStage = { id: string; name: string; color: string; hint: string; order: number };
type ConvStatus = "pending" | "open" | "waiting_customer" | "waiting_agent" | "closed";

type Label = { id: string; name: string; color: string; category: string };
type Task = { id: string; title: string; status: "open" | "done" | "canceled" };
type Message = { id: string; senderType: "agent" | "end_customer" | "system"; senderName: string; body: string; mediaType?: string | null; mediaUrl?: string | null; sentAt: string };
type Department = { id: string; name: string; permissions: Record<string, unknown>; isActive: boolean };
type AgentUser = { id: string; name: string; email: string; role: "admin" | "agent"; departmentId: string | null; department?: Department | null };
type QuickMsg = { id: string; shortcut: string; title: string; body: string };
type LeadStatus = { id: string; name: string; color: string; order: number };
type LeadSource = { id: string; name: string; color: string; code?: string | null; order?: number };
type ViewKey = "chats" | "dashboard" | "settings" | "scheduling" | "contacts";
type DeptPermissions = { views: Record<ViewKey, boolean>; scope: "own" | "all" };
type JwtUser = { sub: string; email: string; name: string; role: "admin" | "agent"; crmClientId: string; permissions?: DeptPermissions };

type Conversation = {
  id: string;
  channelType: Channel;
  status: ConvStatus;
  stage: string;
  slaStatus: "on_time" | "warning" | "late";
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  closedAt?: string | null;
  department?: Department | null;
  assignedAgent?: AgentUser | null;
  crmClient: { id?: string; tradeName: string; classification: string; segment: string; ownerName: string };
  endCustomer: {
    id: string; fullName: string; companyName: string | null;
    leadTemperature: "hot" | "warm" | "cold"; priority: "high" | "medium" | "low";
    estimatedValueCents: number; assignedTo: string | null; lastContactAt: string | null;
    leadStatus?: LeadStatus | null; leadSource?: LeadSource | null; sourceUrl?: string | null; sourceRef?: string | null;
    pipelineStage?: PipelineStage | null;
    labels: Array<{ label: Label }>; tasks: Task[];
  };
  messages?: Message[];
};

type ClientCard = {
  id: string; name: string; company: string; crmClient: string; stageId: string | null;
  temperature: "hot" | "warm" | "cold"; priority: "high" | "medium" | "low";
  value: number; owner: string; labels: Label[]; source?: { name: string; color: string } | null;
};

type DashMetrics = {
  totalConversations: number; avgAttendanceTimeSeconds: number; avgFirstResponseSeconds: number;
  byStatus: Array<{ status: string; count: number }>;
  byChannel: Array<{ channel: string; count: number; percentage: number }>;
  byDepartment: Array<{ departmentId: string | null; departmentName: string; count: number; percentage: number }>;
  byOrigin?: Array<{ sourceId: string | null; sourceName: string; color: string; count: number; percentage: number }>;
  volumeByDay: Array<{ date: string; count: number }>;
  volumeByHour: Array<{ hour: number; count: number }>;
  byAgent: Array<{ agentId: string | null; agentName: string; count: number }>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";


const VIEW_META: Array<{ key: ViewKey; label: string }> = [
  { key: "chats", label: "Chats" },
  { key: "dashboard", label: "Dashboard" },
  { key: "contacts", label: "Clientes" },
  { key: "scheduling", label: "Agendamento" },
  { key: "settings", label: "Configuracoes" }
];
const DEFAULT_DEPT_PERMS: DeptPermissions = {
  views: { chats: true, dashboard: false, settings: false, scheduling: true, contacts: true },
  scope: "own"
};
function normPerms(raw: unknown): DeptPermissions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<DeptPermissions>;
  const v = (o.views ?? {}) as Partial<Record<ViewKey, boolean>>;
  return {
    views: {
      chats: v.chats ?? DEFAULT_DEPT_PERMS.views.chats,
      dashboard: v.dashboard ?? DEFAULT_DEPT_PERMS.views.dashboard,
      settings: v.settings ?? DEFAULT_DEPT_PERMS.views.settings,
      scheduling: v.scheduling ?? DEFAULT_DEPT_PERMS.views.scheduling,
      contacts: v.contacts ?? DEFAULT_DEPT_PERMS.views.contacts
    },
    scope: o.scope === "all" ? "all" : "own"
  };
}

function PermsEditor({ value, onChange }: { value: DeptPermissions; onChange: (p: DeptPermissions) => void }) {
  return (
    <div className="perms-editor">
      <div className="perms-views">
        {VIEW_META.map(({ key, label }) => (
          <label key={key} className="perm-check">
            <input
              type="checkbox"
              checked={!!value.views[key]}
              onChange={(e) => onChange({ ...value, views: { ...value.views, [key]: e.target.checked } })}
            />
            {label}
          </label>
        ))}
      </div>
      <label className="perm-scope">
        Escopo de conversas
        <select value={value.scope} onChange={(e) => onChange({ ...value, scope: e.target.value as "own" | "all" })}>
          <option value="own">So as proprias</option>
          <option value="all">Todas do departamento</option>
        </select>
      </label>
    </div>
  );
}

function decodeJwt(token: string): JwtUser | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as JwtUser;
  } catch { return null; }
}

function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? (localStorage.getItem("stn_crm_token") ?? "") : "";
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const merged: RequestInit = {
    ...init,
    headers: { ...authHeader, ...(init?.headers as Record<string, string> | undefined) }
  };
  return fetch(url, merged).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem("stn_crm_token");
      window.location.href = "/login";
    }
    return res;
  });
}

function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("stn_crm_token");
  window.location.href = "/login";
}

export default function HomePage() {
  const { toasts, toast } = useToast();
  const [currentUser, setCurrentUser] = useState<JwtUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [chatStatus, setChatStatus] = useState<ChatStatus>("pending");
  const [filterDeptId, setFilterDeptId] = useState<string>("");
  const [filterSourceId, setFilterSourceId] = useState<string>("");
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Conversation | null>(null);
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [quickMessages, setQuickMessages] = useState<QuickMsg[]>([]);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [showProspeccaoModal, setShowProspeccaoModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dashMetrics, setDashMetrics] = useState<DashMetrics | null>(null);
  const [firstCrmClientId, setFirstCrmClientId] = useState<string | null>(null);
  // When set, the next conversations load selects this id instead of data[0]
  // (used to open a just-created conversation after Nova conversa).
  const pendingSelectRef = useRef<string | null>(null);

  // Auth check — runs once on mount
  useEffect(() => {
    const token = localStorage.getItem("stn_crm_token");
    if (!token) { window.location.href = "/login"; return; }
    const user = decodeJwt(token);
    if (!user) { localStorage.removeItem("stn_crm_token"); window.location.href = "/login"; return; }
    setCurrentUser(user);
    setFirstCrmClientId(user.crmClientId);
  }, []);

  // Redireciona pra primeira tela permitida se a atual (default dashboard) for bloqueada
  useEffect(() => {
    if (!currentUser) return;
    const map: Record<View, ViewKey | "admin"> = { dashboard: "dashboard", clients: "contacts", chats: "chats", settings: "admin" };
    const allowed = (v: View) =>
      currentUser.role === "admin" || (map[v] !== "admin" && !!currentUser.permissions?.views?.[map[v] as ViewKey]);
    if (!allowed(view)) {
      const first = (["chats", "dashboard", "clients", "settings"] as View[]).find(allowed) ?? "chats";
      setView(first);
    }
  }, [currentUser, view]);

  useEffect(() => {
    if (!firstCrmClientId) return;
    const crmId = firstCrmClientId;
    async function bootstrap() {
      try {
        const [deptRes, agentRes, srcRes, stageRes] = await Promise.all([
          apiFetch(`${apiUrl}/api/departments?crmClientId=${crmId}`),
          apiFetch(`${apiUrl}/api/agents?crmClientId=${crmId}`),
          apiFetch(`${apiUrl}/api/lead-sources?crmClientId=${crmId}`),
          apiFetch(`${apiUrl}/api/pipeline-stages?crmClientId=${crmId}`)
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        else console.error(`[bootstrap] departments failed: ${deptRes.status}`);
        if (agentRes.ok) setAgents(await agentRes.json());
        else console.error(`[bootstrap] agents failed: ${agentRes.status}`);
        if (srcRes.ok) setLeadSources(await srcRes.json());
        else console.error(`[bootstrap] lead-sources failed: ${srcRes.status}`);
        if (stageRes.ok) setPipelineStages(await stageRes.json());
        else console.error(`[bootstrap] pipeline-stages failed: ${stageRes.status}`);
      } catch (err) {
        console.error("[bootstrap] failed:", err);
      }
    }
    bootstrap();
  }, [firstCrmClientId]);

  useEffect(() => {
    if (!firstCrmClientId) return;
    const crmClientId = firstCrmClientId;
    async function load() {
      setIsLoading(true);
      try {
        // Busca todas as convs (qualquer status); Chats filtra por aba client-side, board mostra tudo.
        const params = new URLSearchParams({ channel, crmClientId });
        if (filterDeptId) params.set("departmentId", filterDeptId);
        if (filterSourceId) params.set("leadSourceId", filterSourceId);
        const res = await apiFetch(`${apiUrl}/api/conversations?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Conversation[];
        setConversations(data);
        setClients(buildClients(data));
        const want = pendingSelectRef.current;
        const pick = want && data.some((c) => c.id === want) ? want : (data[0]?.id ?? null);
        setSelectedId(pick);
        if (want) pendingSelectRef.current = null;
      } catch (err) {
        console.error("[conversations] load failed:", err);
        setConversations([]);
        setClients([]);
        setSelectedId(null);
      }
      setIsLoading(false);
    }
    load();
  }, [view, channel, filterDeptId, filterSourceId, firstCrmClientId]);

  useEffect(() => {
    if (view !== "chats" || !firstCrmClientId) return;
    apiFetch(`${apiUrl}/api/quick-messages?crmClientId=${firstCrmClientId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setQuickMessages)
      .catch((err) => console.error("[quick-messages] load failed:", err));
  }, [view, firstCrmClientId]);

  useEffect(() => {
    if (view !== "dashboard" || !firstCrmClientId) return;
    // Não busca métricas se o departamento não tem acesso ao dashboard (evita 403 no load)
    if (currentUser && currentUser.role !== "admin" && !currentUser.permissions?.views?.dashboard) return;
    apiFetch(`${apiUrl}/api/dashboard`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setDashMetrics)
      .catch((err) => console.error("[dashboard] metrics load failed:", err));
  }, [view, firstCrmClientId, currentUser]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    apiFetch(`${apiUrl}/api/conversations/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((d) => setDetail(d as Conversation))
      .catch((err) => {
        console.error(`[conversation] load failed id=${selectedId}:`, err);
        setDetail(conversations.find((c) => c.id === selectedId) ?? null);
      });
  }, [selectedId, conversations]);

  // Poll open conversation for new incoming messages every 4s
  useEffect(() => {
    if (!selectedId || view !== "chats") return;
    const id = setInterval(() => {
      apiFetch(`${apiUrl}/api/conversations/${selectedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => setDetail(d as Conversation))
        .catch((err) => console.error(`[poll detail] id=${selectedId} falhou:`, err));
    }, 4000);
    return () => clearInterval(id);
  }, [selectedId, view]);

  // Poll conversation list for new messages/conversations every 8s
  useEffect(() => {
    if (view !== "chats" || !firstCrmClientId) return;
    const crmClientId = firstCrmClientId;
    const id = setInterval(() => {
      const params = new URLSearchParams({ channel, crmClientId });
      if (filterDeptId) params.set("departmentId", filterDeptId);
      if (filterSourceId) params.set("leadSourceId", filterSourceId);
      apiFetch(`${apiUrl}/api/conversations?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => {
          setConversations(data as Conversation[]);
          setClients(buildClients(data as Conversation[]));
        })
        .catch((err) => console.error("[poll list] falhou:", err));
    }, 8000);
    return () => clearInterval(id);
  }, [view, channel, filterDeptId, filterSourceId, firstCrmClientId]);

  const selected = useMemo(
    () => detail ?? conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, detail, selectedId]
  );
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? clients[0] ?? null;

  function refreshConversations() {
    if (!firstCrmClientId) return;
    const crmClientId = firstCrmClientId;
    setSelectedId(null);
    const params = new URLSearchParams({ channel, crmClientId });
    if (filterDeptId) params.set("departmentId", filterDeptId);
    if (filterSourceId) params.set("leadSourceId", filterSourceId);
    apiFetch(`${apiUrl}/api/conversations?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((d) => {
        const data = d as Conversation[];
        setConversations(data);
        setClients(buildClients(data));
        const want = pendingSelectRef.current;
        const pick = want && data.some((c) => c.id === want) ? want : (data[0]?.id ?? null);
        setSelectedId(pick);
        if (want) pendingSelectRef.current = null;
      })
      .catch((err) => console.error("[conversations] refresh failed:", err));
  }

  async function patchCustomer(endCustomerId: string, data: { estimatedValueCents?: number; assignedTo?: string | null }) {
    const res = await apiFetch(`${apiUrl}/api/end-customers/${endCustomerId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (selectedId) await refreshDetail(selectedId);
  }

  async function refreshDetail(convId: string) {
    const conv = await apiFetch(`${apiUrl}/api/conversations/${convId}`);
    if (conv.ok) setDetail((await conv.json()) as Conversation);
    else console.error(`[refreshDetail] falhou: HTTP ${conv.status}`);
  }

  async function addCustomerLabel(endCustomerId: string, name: string) {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/${endCustomerId}/labels`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDetail(selectedId);
    } catch (err) { console.error("[addCustomerLabel]", err); toast("Erro ao adicionar etiqueta", "error"); }
  }

  async function removeCustomerLabel(endCustomerId: string, labelId: string) {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/${endCustomerId}/labels/${labelId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDetail(selectedId);
    } catch (err) { console.error("[removeCustomerLabel]", err); toast("Erro ao remover etiqueta", "error"); }
  }

  async function addCustomerTask(endCustomerId: string, title: string) {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/${endCustomerId}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDetail(selectedId);
    } catch (err) { console.error("[addCustomerTask]", err); toast("Erro ao adicionar acao", "error"); }
  }

  async function toggleCustomerTask(taskId: string) {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/tasks/${taskId}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDetail(selectedId);
    } catch (err) { console.error("[toggleCustomerTask]", err); toast("Erro ao atualizar acao", "error"); }
  }

  async function removeCustomerTask(taskId: string) {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDetail(selectedId);
    } catch (err) { console.error("[removeCustomerTask]", err); toast("Erro ao remover acao", "error"); }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/conversations/${selected.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const conv = await apiFetch(`${apiUrl}/api/conversations/${selected.id}`);
      if (!conv.ok) throw new Error(`HTTP ${conv.status}`);
      const updated = (await conv.json()) as Conversation;
      setDetail(updated);
      // Keep the inbox list in sync — status/preview/timestamp change after sending
      // (e.g. pending → open), otherwise the list item shows a stale badge.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, status: updated.status, lastMessagePreview: updated.lastMessagePreview, lastMessageAt: updated.lastMessageAt, unreadCount: updated.unreadCount }
            : c
        )
      );
    } catch (err) {
      console.error("[submitReply] failed:", err);
      toast("Erro ao enviar mensagem", "error");
    }
    setReply("");
    setShowQuickPicker(false);
  }

  async function sendAudio(audioBase64: string, mimetype: string) {
    if (!selected) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/conversations/${selected.id}/audio`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimetype })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const conv = await apiFetch(`${apiUrl}/api/conversations/${selected.id}`);
      if (!conv.ok) throw new Error(`HTTP ${conv.status}`);
      const updated = (await conv.json()) as Conversation;
      setDetail(updated);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, status: updated.status, lastMessagePreview: updated.lastMessagePreview, lastMessageAt: updated.lastMessageAt, unreadCount: updated.unreadCount }
            : c
        )
      );
      toast("Audio enviado", "success");
    } catch (err) {
      console.error("[sendAudio] failed:", err);
      toast("Erro ao enviar audio", "error");
    }
  }

  async function sendMedia(file: File) {
    if (!selected) return;
    const mediatype: "image" | "video" | "document" = file.type.startsWith("image/")
      ? "image" : file.type.startsWith("video/") ? "video" : "document";
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(file);
      });
      const res = await apiFetch(`${apiUrl}/api/conversations/${selected.id}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimetype: file.type || "application/octet-stream", mediatype, fileName: file.name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const conv = await apiFetch(`${apiUrl}/api/conversations/${selected.id}`);
      if (!conv.ok) throw new Error(`HTTP ${conv.status}`);
      const updated = (await conv.json()) as Conversation;
      setDetail(updated);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, status: updated.status, lastMessagePreview: updated.lastMessagePreview, lastMessageAt: updated.lastMessageAt, unreadCount: updated.unreadCount }
            : c
        )
      );
      toast("Arquivo enviado", "success");
    } catch (err) {
      console.error("[sendMedia] failed:", err);
      toast("Erro ao enviar arquivo", "error");
    }
  }

  async function closeConversation(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/conversations/${id}/close`, { method: "PUT" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("Conversa encerrada", "success");
      refreshConversations();
    } catch (err) {
      console.error("[closeConversation] failed:", err);
      toast("Erro ao encerrar conversa", "error");
    }
  }

  async function assignAgent(conversationId: string, agentId: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/conversations/${conversationId}/assign`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const conv = await apiFetch(`${apiUrl}/api/conversations/${conversationId}`);
      if (!conv.ok) throw new Error(`HTTP ${conv.status}`);
      setDetail((await conv.json()) as Conversation);
      toast("Agente atribuido", "success");
    } catch (err) {
      console.error("[assignAgent] failed:", err);
      toast("Erro ao atribuir agente", "error");
    }
  }

  function handleReplyChange(value: string) {
    setReply(value);
    const match = value.match(/\/(\w*)$/);
    if (match) { setQuickSearch(match[1] ?? ""); setShowQuickPicker(true); }
    else setShowQuickPicker(false);
  }

  function insertQuickMessage(body: string) {
    setReply((prev) => prev.replace(/\/\w*$/, body));
    setShowQuickPicker(false);
  }

  async function moveClient(clientId: string, stageId: string) {
    setClients((cur) => cur.map((c) => (c.id === clientId ? { ...c, stageId } : c))); // otimista
    try {
      const res = await apiFetch(`${apiUrl}/api/end-customers/${clientId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipelineStageId: stageId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[moveClient] falhou:", err);
      toast("Erro ao mover etapa", "error");
    }
  }

  function addLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || !newLabel.trim()) return;
    const label: Label = { id: `label_${Date.now()}`, name: newLabel.trim(), color: "#206d6f", category: "profile" };
    setClients((cur) => cur.map((c) => (c.id === selectedClient.id ? { ...c, labels: [...c.labels, label] } : c)));
    setNewLabel("");
  }

  function removeLabel(clientId: string, labelId: string) {
    setClients((cur) => cur.map((c) => (c.id === clientId ? { ...c, labels: c.labels.filter((l) => l.id !== labelId) } : c)));
  }

  const filteredQuick = quickMessages.filter(
    (qm) => !quickSearch || qm.shortcut.includes(quickSearch) || qm.title.toLowerCase().includes(quickSearch.toLowerCase())
  );

  // Block render until auth check completes
  if (!currentUser) return null;

  // Admin vê tudo; agente segue as permissões do departamento (do JWT).
  const canView = (v: ViewKey) => currentUser.role === "admin" || !!currentUser.permissions?.views?.[v];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div><strong>STN CRM</strong><span>Atendimento</span></div>
        </div>
        <nav className="nav-groups">
          <div className="nav-group">
            <p>Operacao</p>
            {canView("dashboard") && <NavButton active={view === "dashboard"} icon="D" label="Dash" onClick={() => setView("dashboard")} />}
            {canView("contacts") && <NavButton active={view === "clients"} icon="U" label="Clientes" count={clients.length} onClick={() => setView("clients")} />}
            {canView("chats") && <NavButton active={view === "chats"} icon="C" label="Chats" count={conversations.length} onClick={() => setView("chats")} />}
          </div>
          {currentUser.role === "admin" && (
            <div className="nav-group">
              <p>Gestao</p>
              <NavButton active={view === "settings"} icon="A" label="Configuracoes" onClick={() => setView("settings")} />
            </div>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="avatar small">{initials(currentUser.name)}</div>
            <div>
              <strong>{currentUser.name}</strong>
              <span>{currentUser.role === "admin" ? "Admin" : "SDR"}</span>
            </div>
          </div>
          <button className="logout-btn" type="button" onClick={logout} title="Sair">↩</button>
        </div>
      </aside>

      <main className="workspace">
        {view === "dashboard" && <DashboardView clients={clients} conversations={conversations} metrics={dashMetrics} crmClientId={firstCrmClientId} departments={departments} agents={agents} currentUser={currentUser} />}
        {view === "clients" && (
          <ClientsView
            clients={clients} selectedClient={selectedClient} newLabel={newLabel}
            onAddLabel={addLabel} onChangeLabel={setNewLabel} onMoveClient={moveClient}
            pipelineStages={pipelineStages}
            onRemoveLabel={removeLabel} onSelectClient={setSelectedClientId}
            crmClientId={firstCrmClientId} canSchedule={canView("scheduling")}
            onNewConversation={() => setShowProspeccaoModal(true)}
            onError={(msg) => toast(msg, "error")} onInfo={(msg) => toast(msg, "success")}
          />
        )}
        {view === "chats" && (
          <ChatsView
            channel={channel} chatStatus={chatStatus} conversations={conversations}
            departments={departments} agents={agents} filterDeptId={filterDeptId}
            leadSources={leadSources} filterSourceId={filterSourceId} onFilterSourceChange={setFilterSourceId}
            isLoading={isLoading} reply={reply} selected={selected} selectedId={selectedId}
            showFilters={showFilters} showQuickPicker={showQuickPicker} filteredQuick={filteredQuick}
            onChannelChange={setChannel} onChatStatusChange={setChatStatus}
            onFilterDeptChange={setFilterDeptId} onToggleFilters={() => setShowFilters((s) => !s)}
            onReplyChange={handleReplyChange} onSelectConversation={setSelectedId}
            onClearSelection={() => setSelectedId(null)}
            onSubmitReply={submitReply} onClose={closeConversation} onAssignAgent={assignAgent}
            onInsertQuickMessage={insertQuickMessage} onNewConversation={() => setShowProspeccaoModal(true)}
            onSchedule={() => setShowScheduleModal(true)} onSendAudio={sendAudio} onSendMedia={sendMedia}
            onPatchCustomer={patchCustomer} onError={(msg) => toast(msg, "error")}
            onAddCustomerLabel={addCustomerLabel} onRemoveCustomerLabel={removeCustomerLabel}
            onAddTask={addCustomerTask} onToggleTask={toggleCustomerTask} onRemoveTask={removeCustomerTask}
          />
        )}
        {view === "settings" && currentUser.role === "admin" && <SettingsView firstCrmClientId={firstCrmClientId} />}
      </main>

      {showProspeccaoModal && (
        <ProspeccaoModal
          departments={departments} firstCrmClientId={firstCrmClientId}
          onClose={() => setShowProspeccaoModal(false)}
          onCreated={(created) => {
            setShowProspeccaoModal(false);
            setView("chats");
            pendingSelectRef.current = created.id;
            // Ajusta aba/canal pra a conversa nova ficar visível e sempre refaz o fetch
            // (a lista busca todos os status; trocar de aba não dispara mais refetch).
            const target: ChatStatus =
              created.status === "pending" ? "pending" : created.status === "closed" ? "closed" : "active";
            setChannel(created.channelType);
            setChatStatus(target);
            refreshConversations();
          }}
          onError={(msg) => toast(msg, "error")}
        />
      )}
      {showScheduleModal && selected && firstCrmClientId && (
        <ScheduleModal
          conversationId={selected.id} crmClientId={firstCrmClientId}
          onClose={() => setShowScheduleModal(false)}
          onError={(msg) => toast(msg, "error")}
        />
      )}
      <ToastList toasts={toasts} />
    </div>
  );
}

function DashboardView({
  clients, conversations, metrics, crmClientId, departments, agents, currentUser
}: {
  clients: ClientCard[]; conversations: Conversation[]; metrics: DashMetrics | null;
  crmClientId: string | null; departments: Department[]; agents: AgentUser[];
  currentUser: JwtUser;
}) {
  const [deptFilter, setDeptFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<DashMetrics | null>(metrics);

  useEffect(() => { setData(metrics); }, [metrics]);

  async function applyFilters() {
    if (!crmClientId) return;
    const params = new URLSearchParams();
    if (deptFilter) params.set("departmentId", deptFilter);
    if (agentFilter) params.set("agentId", agentFilter);
    if (channelFilter) params.set("channelType", channelFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    try {
      const res = await apiFetch(`${apiUrl}/api/dashboard?${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }

  const pending = data?.byStatus.find((s) => s.status === "pending")?.count ?? 0;
  const active = data?.byStatus.filter((s) => ["open", "waiting_customer", "waiting_agent"].includes(s.status)).reduce((sum, s) => sum + s.count, 0) ?? 0;
  const closed = data?.byStatus.find((s) => s.status === "closed")?.count ?? 0;

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Visao geral</p><h1>Dashboard</h1></div>
        <div className="topbar-actions">
          {crmClientId && currentUser.role === "admin" && (
            <>
              <select className="filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">Todos departamentos</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="filter-select" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
                <option value="">Todos agentes</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="filter-select" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                <option value="">Todas conexoes</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </select>
              <input type="date" className="filter-select" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" className="filter-select" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <button className="primary-button" type="button" onClick={applyFilters}>Filtrar</button>
            </>
          )}
        </div>
      </header>

      <section className="metric-row">
        <Metric title="Total conversas" value={String(data?.totalConversations ?? conversations.length)} detail="No periodo" />
        <Metric title="Pendentes" value={String(pending || conversations.filter((c) => c.status === "pending").length)} detail="Aguardando atendimento" />
        <Metric title="Ativos" value={String(active || conversations.filter((c) => ["open", "waiting_customer", "waiting_agent"].includes(c.status)).length)} detail="Em andamento" />
        <Metric title="Fechados" value={String(closed || conversations.filter((c) => c.status === "closed").length)} detail="Encerrados" />
      </section>

      {data ? (
        <section className="dash-grid">
          <div className="dash-card">
            <h3>Tempo medio de atendimento</h3>
            <strong className="dash-big">{formatSeconds(data.avgAttendanceTimeSeconds)}</strong>
            <p className="dash-sub">Tempo medio de primeira resposta: {formatSeconds(data.avgFirstResponseSeconds)}</p>
          </div>
          <div className="dash-card">
            <h3>Por canal</h3>
            {data.byChannel.map((c) => (
              <div key={c.channel} className="bar-row">
                <span className="bar-label">{c.channel}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${c.percentage}%` }} /></div>
                <span className="bar-pct">{c.count} ({c.percentage}%)</span>
              </div>
            ))}
          </div>
          <div className="dash-card">
            <h3>Por departamento</h3>
            {data.byDepartment.map((d, i) => (
              <div key={i} className="bar-row">
                <span className="bar-label">{d.departmentName}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${d.percentage}%` }} /></div>
                <span className="bar-pct">{d.count} ({d.percentage}%)</span>
              </div>
            ))}
          </div>
          <div className="dash-card">
            <h3>Leads por origem</h3>
            {(data.byOrigin ?? []).map((o, i) => (
              <div key={i} className="bar-row">
                <span className="bar-label">{o.sourceName}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${o.percentage}%`, background: o.color }} /></div>
                <span className="bar-pct">{o.count} ({o.percentage}%)</span>
              </div>
            ))}
            {(data.byOrigin ?? []).length === 0 && <p className="dash-sub">Sem dados.</p>}
          </div>
          <div className="dash-card">
            <h3>Volume por atendente</h3>
            {data.byAgent.map((a, i) => (
              <div key={i} className="bar-row">
                <span className="bar-label">{a.agentName}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${data.totalConversations ? Math.round((a.count / data.totalConversations) * 100) : 0}%` }} />
                </div>
                <span className="bar-pct">{a.count}</span>
              </div>
            ))}
          </div>
          <div className="dash-card dash-card--wide">
            <h3>Volume semanal (ultimos 30 dias)</h3>
            <div className="volume-chart">
              {data.volumeByDay.slice(-14).map((d) => (
                <div key={d.date} className="volume-bar-wrap">
                  <div className="volume-bar" style={{ height: `${Math.max(4, Math.min(100, (d.count / Math.max(...data.volumeByDay.map((x) => x.count), 1)) * 100))}%` }} />
                  <span>{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card dash-card--wide">
            <h3>Volume medio por hora</h3>
            <div className="volume-chart">
              {data.volumeByHour.map((h) => (
                <div key={h.hour} className="volume-bar-wrap">
                  <div className="volume-bar" style={{ height: `${Math.max(4, Math.min(100, (h.count / Math.max(...data.volumeByHour.map((x) => x.count), 1)) * 100))}%` }} />
                  <span>{String(h.hour).padStart(2, "0")}h</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="development-board">
          <div className="development-panel">
            <span className="status-pill">Carregando dados</span>
            <h2>Dash operacional</h2>
            <p>Conecte a API e configure departamentos para ver metricas reais de atendimento, conversao por canal e desempenho dos agentes.</p>
          </div>
          <div className="development-grid"><div /><div /><div /><div /></div>
        </section>
      )}
    </>
  );
}

function ClientsView({
  clients, selectedClient, newLabel, onAddLabel, onChangeLabel, onMoveClient, pipelineStages, onRemoveLabel, onSelectClient,
  crmClientId, canSchedule, onNewConversation, onError, onInfo
}: {
  clients: ClientCard[]; selectedClient: ClientCard | null; newLabel: string;
  onAddLabel: (e: FormEvent<HTMLFormElement>) => void; onChangeLabel: (v: string) => void;
  onMoveClient: (id: string, stageId: string) => void; pipelineStages: PipelineStage[];
  onRemoveLabel: (clientId: string, labelId: string) => void;
  onSelectClient: (id: string) => void;
  crmClientId: string | null; canSchedule: boolean;
  onNewConversation: () => void;
  onError: (msg: string) => void; onInfo: (msg: string) => void;
}) {
  const [showBulk, setShowBulk] = useState(false);
  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Clientes dos clientes</p><h1>Clientes</h1></div>
        <div className="topbar-actions">
          <label className="search-box"><span>Q</span><input type="search" placeholder="Buscar cliente, empresa ou label" /></label>
          <button className="primary-button" type="button" onClick={onNewConversation}>Nova conversa</button>
          {canSchedule && <button className="secondary-button" type="button" onClick={() => setShowBulk(true)} disabled={clients.length === 0}>Disparo em massa</button>}
        </div>
      </header>
      {showBulk && crmClientId && (
        <BulkScheduleModal
          crmClientId={crmClientId}
          endCustomerIds={clients.map((c) => c.id)}
          onClose={() => setShowBulk(false)}
          onError={onError}
          onDone={(n) => { setShowBulk(false); onInfo(`Agendado para ${n} cliente(s)`); }}
        />
      )}
      <section className="clients-layout">
        <div className="kanban-board">
          {pipelineStages.map((stage, idx) => {
            // Cliente sem etapa cai na 1ª coluna.
            const col = clients.filter((c) => c.stageId === stage.id || (!c.stageId && idx === 0));
            return (
              <div key={stage.id} className="kanban-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, stage.id, onMoveClient)}>
                <div className="kanban-header">
                  <div><h2>{stage.name}</h2><span>{stage.hint}</span></div>
                  <small>{col.length}</small>
                </div>
                <div className="kanban-list">
                  {col.map((client) => (
                    <button key={client.id} type="button" draggable className={`client-card ${selectedClient?.id === client.id ? "active" : ""}`} onClick={() => onSelectClient(client.id)} onDragStart={(e) => e.dataTransfer.setData("text/plain", client.id)}>
                      <div className="client-card-top">
                        <div className="avatar">{initials(client.name)}</div>
                        <div><strong>{client.name}</strong><span>{client.company}</span></div>
                      </div>
                      <p>{client.crmClient} - {temperature(client.temperature)}</p>
                      <div className="tag-list">{client.labels.slice(0, 3).map((l) => <span key={l.id} className="tag" style={{ borderColor: l.color, color: l.color }}>{l.name}</span>)}</div>
                      <div className="client-card-footer"><span>{client.owner}</span><strong>{money(client.value)}</strong></div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <aside className="client-editor">
          {selectedClient ? (
            <>
              <div className="profile-card">
                <div className="profile-top">
                  <div className="avatar large">{initials(selectedClient.name)}</div>
                  <div><h2>{selectedClient.name}</h2><span>{selectedClient.company}</span></div>
                </div>
                <div className="profile-grid">
                  <Info label="Etapa" value={pipelineStages.find((s) => s.id === selectedClient.stageId)?.name ?? pipelineStages[0]?.name ?? "—"} />
                  <Info label="Valor" value={money(selectedClient.value)} />
                  <Info label="Responsavel" value={selectedClient.owner} />
                  <Info label="Prioridade" value={priority(selectedClient.priority)} />
                </div>
              </div>
              <div className="side-section">
                <div className="section-title"><h3>Labels</h3></div>
                <form className="label-form" onSubmit={onAddLabel}>
                  <input value={newLabel} onChange={(e) => onChangeLabel(e.target.value)} placeholder="Nova label" />
                  <button className="primary-button slim" type="submit">Adicionar</button>
                </form>
                <div className="editable-labels">
                  {selectedClient.labels.map((l) => (
                    <button key={l.id} type="button" className="editable-tag" style={{ borderColor: l.color, color: l.color }} onClick={() => onRemoveLabel(selectedClient.id, l.id)}>
                      {l.name}<span>x</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="side-section">
                <div className="section-title"><h3>Mover etapa</h3></div>
                <div className="stage-buttons">
                  {pipelineStages.map((s, idx) => (
                    <button key={s.id} type="button" className={`filter-chip ${(selectedClient.stageId === s.id || (!selectedClient.stageId && idx === 0)) ? "active" : ""}`} onClick={() => onMoveClient(selectedClient.id, s.id)}>{s.name}</button>
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
  channel, chatStatus, conversations, departments, agents, filterDeptId, isLoading,
  reply, selected, selectedId, showFilters, showQuickPicker, filteredQuick,
  onChannelChange, onChatStatusChange, onFilterDeptChange, onToggleFilters,
  onReplyChange, onSelectConversation, onClearSelection, onSubmitReply, onClose, onAssignAgent,
  onInsertQuickMessage, onNewConversation, onSchedule, onSendAudio, onSendMedia, onPatchCustomer, onError,
  onAddCustomerLabel, onRemoveCustomerLabel, onAddTask, onToggleTask, onRemoveTask,
  leadSources, filterSourceId, onFilterSourceChange
}: {
  channel: Channel; chatStatus: ChatStatus; conversations: Conversation[];
  departments: Department[]; agents: AgentUser[]; filterDeptId: string;
  leadSources: LeadSource[]; filterSourceId: string; onFilterSourceChange: (id: string) => void;
  isLoading: boolean; reply: string; selected: Conversation | null; selectedId: string | null;
  showFilters: boolean; showQuickPicker: boolean; filteredQuick: QuickMsg[];
  onChannelChange: (c: Channel) => void; onChatStatusChange: (s: ChatStatus) => void;
  onFilterDeptChange: (id: string) => void; onToggleFilters: () => void;
  onReplyChange: (v: string) => void; onSelectConversation: (id: string) => void;
  onClearSelection: () => void;
  onSubmitReply: (e: FormEvent<HTMLFormElement>) => void;
  onClose: (id: string) => void; onAssignAgent: (convId: string, agentId: string) => void;
  onInsertQuickMessage: (body: string) => void; onNewConversation: () => void; onSchedule: () => void;
  onSendAudio: (audioBase64: string, mimetype: string) => void;
  onSendMedia: (file: File) => void;
  onPatchCustomer: (id: string, data: { estimatedValueCents?: number; assignedTo?: string | null }) => Promise<void>;
  onError: (msg: string) => void;
  onAddCustomerLabel: (endCustomerId: string, name: string) => void;
  onRemoveCustomerLabel: (endCustomerId: string, labelId: string) => void;
  onAddTask: (endCustomerId: string, title: string) => void;
  onToggleTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
}) {
  const pending = conversations.filter((c) => c.status === "pending").length;
  const active = conversations.filter((c) => ["open", "waiting_customer", "waiting_agent"].includes(c.status)).length;
  const closed = conversations.filter((c) => c.status === "closed").length;
  // Lista da inbox filtrada pela aba selecionada (dados já vêm com todos os status).
  const visible = conversations.filter((c) =>
    chatStatus === "pending" ? c.status === "pending"
      : chatStatus === "closed" ? c.status === "closed"
        : ["open", "waiting_customer", "waiting_agent"].includes(c.status));

  const threadRef = useRef<HTMLDivElement>(null);
  const [editingEstimatedValue, setEditingEstimatedValue] = useState(false);
  const [editValueStr, setEditValueStr] = useState("");
  const [editingAssignedTo, setEditingAssignedTo] = useState(false);
  const [editAssignedToStr, setEditAssignedToStr] = useState("");
  const [newCustLabel, setNewCustLabel] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    setEditingEstimatedValue(false);
    setEditingAssignedTo(false);
    setNewCustLabel("");
    setNewTaskTitle("");
  }, [selected?.id]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.messages?.length, selected?.id]);

  return (
    <div className="chats-view">
      <header className="topbar">
        <div><p className="eyebrow">Central de relacionamento</p><h1>Chats</h1></div>
        <div className="topbar-actions">
          <label className="search-box"><span>Q</span><input type="search" placeholder="Buscar cliente, tag ou conversa" /></label>
          <button className="primary-button" type="button" onClick={onNewConversation}>Nova conversa</button>
        </div>
      </header>

      <section className="metric-row">
        <Metric title="Pendentes" value={String(pending)} detail="Aguardando primeiro atendimento" />
        <Metric title="Ativos" value={String(active)} detail="Conversas em andamento" />
        <Metric title="Fechados" value={String(closed)} detail="Encerrados" />
        <Metric title="Total" value={String(conversations.length)} detail="Neste canal/filtro" />
      </section>

      <section className={`chat-board${selectedId ? " chat-board--has-selected" : ""}`}>
        <div className="inbox-panel">
          <div className="panel-header">
            <div><h2>Inbox</h2><span>Filtre por status e canal.</span></div>
            <button type="button" className={`icon-btn ${showFilters ? "active" : ""}`} onClick={onToggleFilters} title="Filtros">⚙</button>
          </div>

          <div className="status-tabs" role="tablist">
            {(["pending", "active", "closed"] as ChatStatus[]).map((s) => (
              <button key={s} role="tab" type="button" className={`status-tab ${chatStatus === s ? "active" : ""}`} onClick={() => onChatStatusChange(s)}>
                {s === "pending" ? "Pendente" : s === "active" ? "Ativo" : "Fechado"}
              </button>
            ))}
          </div>

          <div className="channel-tabs" role="tablist">
            <button className={`channel-tab ${channel === "whatsapp" ? "active" : ""}`} type="button" onClick={() => onChannelChange("whatsapp")}>
              <span className="channel-icon wpp">W</span>WhatsApp
            </button>
            <button className={`channel-tab ${channel === "instagram" ? "active" : ""}`} type="button" onClick={() => onChannelChange("instagram")}>
              <span className="channel-icon instagram">IG</span>Instagram
            </button>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <label className="filter-label">Departamento
                <select value={filterDeptId} onChange={(e) => onFilterDeptChange(e.target.value)}>
                  <option value="">Todos</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="filter-label">Origem
                <select value={filterSourceId} onChange={(e) => onFilterSourceChange(e.target.value)}>
                  <option value="">Todas</option>
                  {leadSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="conversation-list">
            {isLoading ? (
              <div className="empty-state">Carregando...</div>
            ) : visible.length === 0 ? (
              <div className="empty-state">Sem conversas neste filtro.</div>
            ) : (
              visible.map((conv) => (
                <button key={conv.id} type="button" className={`conversation-card ${conv.id === selectedId ? "active" : ""}`} onClick={() => onSelectConversation(conv.id)}>
                  <div className="avatar">{initials(conv.endCustomer.fullName)}</div>
                  <div className="conversation-main">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <strong style={{ fontSize: 14 }}>{conv.endCustomer.fullName}</strong>
                      <span className={`conv-status-badge ${conv.status}`}>{convStatusLabel(conv.status)}</span>
                      {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                    </div>
                    <span>{conv.lastMessagePreview}</span>
                    <em>{conv.department?.name ?? conv.crmClient.tradeName} - {temperature(conv.endCustomer.leadTemperature)}</em>
                  </div>
                  <div className="conversation-meta">
                    <time>{elapsed(conv.lastMessageAt)}</time>
                    <span className={`priority ${conv.endCustomer.priority}`} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selected ? (
          <>
            <section className="chat-detail">
              <div className="detail-header">
                <div className="contact-summary">
                  <div className="avatar">{initials(selected.endCustomer.fullName)}</div>
                  <div>
                    <h2>{selected.endCustomer.fullName}</h2>
                    <span>{selected.channelType} - {temperature(selected.endCustomer.leadTemperature)} - {selected.crmClient.tradeName}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="mobile-back-btn" type="button" onClick={onClearSelection}>← Voltar</button>
                  {selected.status !== "closed" && (
                    <button className="secondary-button" type="button" onClick={() => onClose(selected.id)}>Encerrar</button>
                  )}
                  <span className={`conv-status-badge ${selected.status}`} style={{ alignSelf: "center" }}>{convStatusLabel(selected.status)}</span>
                </div>
              </div>

              <div className="conversation-stage">
                <div><span className="stage-label">Etapa atual</span><strong>{selected.stage}</strong></div>
                <div className="stage-track">
                  <span className="done" /><span className="done" /><span className="current" /><span />
                </div>
              </div>

              <div className="message-thread" ref={threadRef}>
                {(selected.messages ?? []).map((msg) => (
                  <div key={msg.id} className={`message ${msg.senderType === "agent" ? "agent" : ""}`}>
                    <strong>{msg.senderName}</strong>
                    {msg.mediaType && !msg.mediaUrl ? (
                      <p>📎 Mídia (indisponível)</p>
                    ) : msg.mediaType === "audio" && msg.mediaUrl ? (
                      <audio controls preload="none" src={msg.mediaUrl} className="msg-audio" />
                    ) : msg.mediaType === "image" && msg.mediaUrl ? (
                      <a href={msg.mediaUrl} target="_blank" rel="noreferrer"><img src={msg.mediaUrl} alt={msg.body} className="msg-image" /></a>
                    ) : msg.mediaType === "video" && msg.mediaUrl ? (
                      <video controls preload="none" src={msg.mediaUrl} className="msg-video" />
                    ) : msg.mediaType === "document" && msg.mediaUrl ? (
                      <a href={msg.mediaUrl} download={msg.body?.replace(/^\[Documento\]\s*/, "") || "arquivo"} className="msg-doc">📎 {msg.body?.replace(/^\[Documento\]\s*/, "") || "Baixar arquivo"}</a>
                    ) : (
                      <p>{msg.body}</p>
                    )}
                    <time>{time(msg.sentAt)}</time>
                  </div>
                ))}
              </div>

              <div className="reply-area">
                {showQuickPicker && filteredQuick.length > 0 && (
                  <div className="quick-picker">
                    {filteredQuick.slice(0, 8).map((qm) => (
                      <button key={qm.id} type="button" className="quick-picker-item" onClick={() => onInsertQuickMessage(qm.body)}>
                        <strong>/{qm.shortcut}</strong><span>{qm.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="reply-toolbar">
                  <button type="button" className="reply-tool-btn" onClick={onSchedule} title="Agendar mensagem">📅 Agendar</button>
                  <AudioRecorder onSend={onSendAudio} onError={onError} />
                  <MediaAttach onSelect={onSendMedia} onError={onError} />
                </div>
                <form className="reply-box" onSubmit={onSubmitReply}>
                  <textarea
                    rows={3}
                    placeholder="Escreva / para msgs rapidas..."
                    value={reply}
                    onChange={(e) => onReplyChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button className="primary-button send" type="submit">Enviar</button>
                </form>
              </div>
            </section>

            <aside className="profile-panel">
              <div className="profile-card">
                <div className="profile-top">
                  <div className="avatar large">{initials(selected.endCustomer.fullName)}</div>
                  <div>
                    <h2>{selected.endCustomer.fullName}</h2>
                    <span>{selected.endCustomer.companyName} - {classification(selected.crmClient.classification)}</span>
                  </div>
                </div>
                <div className="profile-grid">
                  <div>
                    <span>Valor estimado</span>
                    {editingEstimatedValue ? (
                      <input
                        autoFocus
                        className="inline-edit-input"
                        value={editValueStr}
                        onChange={(e) => setEditValueStr(e.target.value)}
                        onBlur={() => {
                          const cents = Math.round(parseFloat(editValueStr.replace(",", ".")) * 100);
                          if (!isNaN(cents)) {
                            onPatchCustomer(selected.endCustomer.id, { estimatedValueCents: cents }).catch(() => onError("Erro ao salvar valor"));
                          }
                          setEditingEstimatedValue(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingEstimatedValue(false);
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <strong
                        className="editable-value"
                        title="Clique para editar"
                        onClick={() => { setEditValueStr(String(selected.endCustomer.estimatedValueCents / 100)); setEditingEstimatedValue(true); }}
                      >
                        {money(selected.endCustomer.estimatedValueCents)}
                      </strong>
                    )}
                  </div>
                  <div>
                    <span>Responsavel</span>
                    {editingAssignedTo ? (
                      <input
                        autoFocus
                        className="inline-edit-input"
                        value={editAssignedToStr}
                        onChange={(e) => setEditAssignedToStr(e.target.value)}
                        onBlur={() => {
                          onPatchCustomer(selected.endCustomer.id, { assignedTo: editAssignedToStr.trim() || null }).catch(() => onError("Erro ao salvar responsavel"));
                          setEditingAssignedTo(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingAssignedTo(false);
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <strong
                        className="editable-value"
                        title="Clique para editar"
                        onClick={() => { setEditAssignedToStr(selected.endCustomer.assignedTo ?? ""); setEditingAssignedTo(true); }}
                      >
                        {selected.endCustomer.assignedTo ?? selected.assignedAgent?.name ?? "—"}
                      </strong>
                    )}
                  </div>
                  <Info label="Ultimo contato" value={selected.endCustomer.lastContactAt ? elapsed(selected.endCustomer.lastContactAt) : "-"} />
                  <Info label="SLA" value={sla(selected.slaStatus)} />
                </div>
              </div>

              <div className="side-section">
                <div className="section-title"><h3>Origem</h3></div>
                {selected.endCustomer.leadSource ? (
                  <>
                    <span className="tag" style={{ borderColor: selected.endCustomer.leadSource.color, color: selected.endCustomer.leadSource.color }}>
                      {selected.endCustomer.leadSource.name}
                    </span>
                    {selected.endCustomer.sourceUrl && (
                      <a className="side-empty" href={selected.endCustomer.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, textDecoration: "underline" }}>
                        {selected.endCustomer.sourceRef || "Ver anúncio"}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="side-empty">Direto (sem origem identificada).</p>
                )}
              </div>

              {selected.endCustomer.leadStatus && (
                <div className="side-section">
                  <div className="section-title"><h3>Status de Lead</h3></div>
                  <span className="tag" style={{ borderColor: selected.endCustomer.leadStatus.color, color: selected.endCustomer.leadStatus.color }}>
                    {selected.endCustomer.leadStatus.name}
                  </span>
                </div>
              )}

              {agents.length > 0 && selected.status !== "closed" && (
                <div className="side-section">
                  <div className="section-title"><h3>Atendente</h3></div>
                  <select className="filter-select full-width" value={selected.assignedAgent?.id ?? ""} onChange={(e) => { if (e.target.value) onAssignAgent(selected.id, e.target.value); }}>
                    <option value="">Nao atribuido</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.department?.name ?? "sem dept"})</option>)}
                  </select>
                </div>
              )}

              <div className="side-section">
                <div className="section-title"><h3>Etiquetas</h3></div>
                {(selected.endCustomer.labels ?? []).length > 0 ? (
                  <div className="tag-list">
                    {(selected.endCustomer.labels ?? []).map(({ label }) => (
                      <button
                        key={label.id}
                        type="button"
                        className="editable-tag"
                        style={{ borderColor: label.color, color: label.color }}
                        title="Remover etiqueta"
                        onClick={() => onRemoveCustomerLabel(selected.endCustomer.id, label.id)}
                      >
                        {label.name}<span>×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="side-empty">Nenhuma etiqueta.</p>
                )}
                <form
                  className="label-form"
                  onSubmit={(e) => { e.preventDefault(); if (newCustLabel.trim()) { onAddCustomerLabel(selected.endCustomer.id, newCustLabel.trim()); setNewCustLabel(""); } }}
                >
                  <input value={newCustLabel} onChange={(e) => setNewCustLabel(e.target.value)} placeholder="Nova etiqueta" />
                  <button className="primary-button slim" type="submit">Adicionar</button>
                </form>
              </div>

              <div className="side-section">
                <div className="section-title"><h3>Proximas acoes</h3></div>
                {(selected.endCustomer.tasks ?? []).length > 0 ? (
                  <ul className="task-list">
                    {(selected.endCustomer.tasks ?? []).map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className={`task-box ${task.status === "done" ? "checked" : ""}`}
                          title={task.status === "done" ? "Reabrir" : "Concluir"}
                          onClick={() => onToggleTask(task.id)}
                        />
                        <span className={task.status === "done" ? "task-done" : ""}>{task.title}</span>
                        <button type="button" className="task-remove" title="Remover" onClick={() => onRemoveTask(task.id)}>×</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="side-empty">Nenhuma acao pendente.</p>
                )}
                <form
                  className="label-form"
                  onSubmit={(e) => { e.preventDefault(); if (newTaskTitle.trim()) { onAddTask(selected.endCustomer.id, newTaskTitle.trim()); setNewTaskTitle(""); } }}
                >
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Nova acao" />
                  <button className="primary-button slim" type="submit">Adicionar</button>
                </form>
              </div>
            </aside>
          </>
        ) : (
          <div className="empty-state large">Selecione uma conversa.</div>
        )}
      </section>
    </div>
  );
}

function SettingsView({ firstCrmClientId }: { firstCrmClientId: string | null }) {
  type SettingsTab = "departments" | "agents" | "quickMessages" | "leadStatuses" | "leadSources" | "pipelineStages" | "rules" | "whatsapp" | "danger";
  const { toasts, toast } = useToast();
  const [tab, setTab] = useState<SettingsTab>("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [quickMessages, setQuickMessages] = useState<QuickMsg[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [waNumber, setWaNumber] = useState<string>("");
  const [rules, setRules] = useState<Record<string, string>>({});

  const [deptName, setDeptName] = useState("");
  const [newDeptPerms, setNewDeptPerms] = useState<DeptPermissions>(DEFAULT_DEPT_PERMS);
  const [editingPerms, setEditingPerms] = useState<Record<string, DeptPermissions>>({});
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentDept, setAgentDept] = useState("");
  const [agentRole, setAgentRole] = useState<"agent" | "admin">("agent");
  const [qmShortcut, setQmShortcut] = useState("");
  const [qmTitle, setQmTitle] = useState("");
  const [qmBody, setQmBody] = useState("");
  const [lsName, setLsName] = useState("");
  const [lsColor, setLsColor] = useState("#206d6f");
  const [srcName, setSrcName] = useState("");
  const [srcColor, setSrcColor] = useState("#d62976");
  const [srcCode, setSrcCode] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#206d6f");
  const [stageHint, setStageHint] = useState("");
  const [credInfo, setCredInfo] = useState<{ name: string; email: string; password: string } | null>(null);
  const [clearConfirm, setClearConfirm] = useState("");
  const [clearing, setClearing] = useState(false);
  const [waSyncing, setWaSyncing] = useState(false);
  const [waStatus, setWaStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waMethod, setWaMethod] = useState<"qr" | "code">("qr");
  const [waPhone, setWaPhone] = useState("");
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null);
  const waPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!firstCrmClientId || tab !== "whatsapp") return;
    loadWaStatus(firstCrmClientId);
  }, [tab, firstCrmClientId]);

  function loadWaStatus(crmId: string) {
    apiFetch(`${apiUrl}/api/whatsapp/${crmId}/status`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { status: string; qr: string | null }) => {
        setWaStatus(d.status as typeof waStatus);
        if (d.qr) setWaQr(d.qr);
      })
      .catch(() => setWaStatus("disconnected"));
  }

  async function syncWaStatus() {
    if (!firstCrmClientId || waSyncing) return;
    setWaSyncing(true);
    try {
      const res = await apiFetch(`${apiUrl}/api/whatsapp/${firstCrmClientId}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { status: string; qr: string | null };
      setWaStatus(d.status as typeof waStatus);
      setWaQr(d.qr ?? null);
      toast(`Sincronizado: ${d.status === "connected" ? "conectado" : d.status === "connecting" ? "aguardando" : "desconectado"}`, "success");
    } catch (err) { console.error("[syncWaStatus]", err); toast("Erro ao sincronizar", "error"); }
    finally { setWaSyncing(false); }
  }

  // Poller de status compartilhado entre QR e código de pareamento.
  // Atualiza QR (quando aplicável) e para ao conectar.
  function startWaPoller(crmId: string) {
    if (waPollerRef.current) { clearInterval(waPollerRef.current); waPollerRef.current = null; }
    setWaStatus("connecting");
    let tries = 0;
    waPollerRef.current = setInterval(() => {
      tries++;
      apiFetch(`${apiUrl}/api/whatsapp/${crmId}/status`)
        .then((r) => r.json() as Promise<{ status: string; qr: string | null }>)
        .then((s) => {
          setWaStatus(s.status as typeof waStatus);
          if (s.qr) setWaQr(s.qr);
          if (s.status === "connected") {
            setWaQr(null); setWaPairingCode(null);
            clearInterval(waPollerRef.current!); waPollerRef.current = null;
          }
        })
        .catch(() => null);
      if (tries >= 60) { clearInterval(waPollerRef.current!); waPollerRef.current = null; }
    }, 2000);
  }

  async function connectWa() {
    if (!firstCrmClientId) return;
    setWaLoading(true); setWaQr(null); setWaPairingCode(null);
    try {
      const res = await apiFetch(`${apiUrl}/api/whatsapp/${firstCrmClientId}/connect`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startWaPoller(firstCrmClientId);
    } catch (err) {
      console.error("[connectWa]", err); toast("Erro ao conectar WhatsApp", "error");
    } finally { setWaLoading(false); }
  }

  async function connectWaCode() {
    if (!firstCrmClientId) return;
    if (!waPhone.trim()) { toast("Informe o número com DDD", "error"); return; }
    setWaLoading(true); setWaQr(null); setWaPairingCode(null);
    try {
      const res = await apiFetch(`${apiUrl}/api/whatsapp/${firstCrmClientId}/connect-code`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone.trim() })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { pairingCode: string | null; alreadyConnected?: boolean };
      if (data.alreadyConnected) { setWaStatus("connected"); toast("WhatsApp já conectado", "success"); return; }
      if (!data.pairingCode) { toast("Não foi possível gerar o código. Tente novamente.", "error"); return; }
      setWaPairingCode(data.pairingCode);
      startWaPoller(firstCrmClientId);
    } catch (err) {
      console.error("[connectWaCode]", err); toast("Erro ao gerar código de pareamento", "error");
    } finally { setWaLoading(false); }
  }

  async function disconnectWa() {
    if (!firstCrmClientId) return;
    setWaLoading(true);
    try {
      const res = await apiFetch(`${apiUrl}/api/whatsapp/${firstCrmClientId}/disconnect`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWaStatus("disconnected"); setWaQr(null);
      if (waPollerRef.current) { clearInterval(waPollerRef.current); waPollerRef.current = null; }
      toast("WhatsApp desconectado", "success");
    } catch (err) {
      console.error("[disconnectWa]", err); toast("Erro ao desconectar", "error");
    } finally { setWaLoading(false); }
  }

  useEffect(() => {
    if (!firstCrmClientId) return;
    const crmId = firstCrmClientId;
    Promise.all([
      apiFetch(`${apiUrl}/api/departments?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`departments ${r.status}`)),
      apiFetch(`${apiUrl}/api/agents?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`agents ${r.status}`)),
      apiFetch(`${apiUrl}/api/quick-messages?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`quick-messages ${r.status}`)),
      apiFetch(`${apiUrl}/api/lead-statuses?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`lead-statuses ${r.status}`)),
      apiFetch(`${apiUrl}/api/lead-sources?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`lead-sources ${r.status}`)),
      apiFetch(`${apiUrl}/api/pipeline-stages?crmClientId=${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`pipeline-stages ${r.status}`)),
      apiFetch(`${apiUrl}/api/settings/${crmId}`).then((r) => r.ok ? r.json() : Promise.reject(`settings ${r.status}`))
    ]).then(([d, a, q, l, src, ps, s]) => {
      setDepartments(d); setAgents(a); setQuickMessages(q); setLeadStatuses(l); setLeadSources(src); setPipelineStages(ps); setRules(s);
    }).catch((err) => {
      console.error("[SettingsView] load failed:", err);
      toast("Erro ao carregar configuracoes", "error");
    });
  }, [firstCrmClientId]);

  async function addDept(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !deptName.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/departments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmClientId: firstCrmClientId, name: deptName, permissions: newDeptPerms }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json(); setDepartments((prev) => [...prev, d]); setDeptName(""); setNewDeptPerms(DEFAULT_DEPT_PERMS);
      toast("Departamento criado", "success");
    } catch (err) { console.error("[addDept]", err); toast("Erro ao criar departamento", "error"); }
  }

  async function saveDeptPerms(id: string) {
    const perms = editingPerms[id];
    if (!perms) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/departments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: perms }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json(); setDepartments((prev) => prev.map((x) => (x.id === id ? d : x)));
      setEditingPerms((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast("Permissoes atualizadas", "success");
    } catch (err) { console.error("[saveDeptPerms]", err); toast("Erro ao salvar permissoes", "error"); }
  }

  async function removeDept(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) { console.error("[removeDept]", err); toast("Erro ao remover departamento", "error"); }
  }

  async function addAgent(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !agentName.trim() || !agentEmail.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmClientId: firstCrmClientId, name: agentName, email: agentEmail, role: agentRole, departmentId: agentDept || undefined }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const a = await res.json(); setAgents((prev) => [...prev, a]); setAgentName(""); setAgentEmail("");
      if (a.tempPassword) setCredInfo({ name: a.name, email: a.email, password: a.tempPassword });
      toast("Agente criado", "success");
    } catch (err) { console.error("[addAgent]", err); toast("Erro ao criar agente", "error"); }
  }

  async function removeAgent(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { console.error("[removeAgent]", err); toast("Erro ao remover agente", "error"); }
  }

  async function resetAgentPassword(a: AgentUser) {
    try {
      const res = await apiFetch(`${apiUrl}/api/agents/${a.id}/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setCredInfo({ name: a.name, email: a.email, password: d.tempPassword });
      toast("Senha redefinida", "success");
    } catch (err) { console.error("[resetAgentPassword]", err); toast("Erro ao redefinir senha", "error"); }
  }

  async function addQM(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !qmShortcut.trim() || !qmBody.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/quick-messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmClientId: firstCrmClientId, shortcut: qmShortcut, title: qmTitle || qmShortcut, body: qmBody }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const q = await res.json(); setQuickMessages((prev) => [...prev, q]); setQmShortcut(""); setQmTitle(""); setQmBody("");
      toast("Mensagem rapida criada", "success");
    } catch (err) { console.error("[addQM]", err); toast("Erro ao criar mensagem rapida", "error"); }
  }

  async function removeQM(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/quick-messages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setQuickMessages((prev) => prev.filter((q) => q.id !== id));
    } catch (err) { console.error("[removeQM]", err); toast("Erro ao remover mensagem rapida", "error"); }
  }

  async function addLS(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !lsName.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/lead-statuses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmClientId: firstCrmClientId, name: lsName, color: lsColor, order: leadStatuses.length }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const l = await res.json(); setLeadStatuses((prev) => [...prev, l]); setLsName("");
      toast("Status de lead criado", "success");
    } catch (err) { console.error("[addLS]", err); toast("Erro ao criar status de lead", "error"); }
  }

  async function removeLS(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/lead-statuses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeadStatuses((prev) => prev.filter((l) => l.id !== id));
    } catch (err) { console.error("[removeLS]", err); toast("Erro ao remover status de lead", "error"); }
  }

  async function addSrc(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !srcName.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/lead-sources`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmClientId: firstCrmClientId, name: srcName.trim(), color: srcColor, code: srcCode.trim() || undefined, order: leadSources.length })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = await res.json(); setLeadSources((prev) => [...prev, s]); setSrcName(""); setSrcCode("");
      toast("Origem criada", "success");
    } catch (err) { console.error("[addSrc]", err); toast("Erro ao criar origem (nome/codigo ja existe?)", "error"); }
  }

  async function removeSrc(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/lead-sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeadSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) { console.error("[removeSrc]", err); toast("Erro ao remover origem", "error"); }
  }

  async function addStage(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId || !stageName.trim()) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/pipeline-stages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmClientId: firstCrmClientId, name: stageName.trim(), color: stageColor, hint: stageHint.trim() || undefined, order: pipelineStages.length })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = await res.json(); setPipelineStages((prev) => [...prev, s]); setStageName(""); setStageHint("");
      toast("Etapa criada", "success");
    } catch (err) { console.error("[addStage]", err); toast("Erro ao criar etapa (nome ja existe?)", "error"); }
  }

  async function removeStage(id: string) {
    try {
      const res = await apiFetch(`${apiUrl}/api/pipeline-stages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPipelineStages((prev) => prev.filter((s) => s.id !== id));
      toast("Etapa removida", "success");
    } catch (err) { console.error("[removeStage]", err); toast("Erro ao remover etapa", "error"); }
  }

  async function renameStage(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/pipeline-stages/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPipelineStages((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
    } catch (err) { console.error("[renameStage]", err); toast("Erro ao renomear etapa", "error"); }
  }

  async function clearAllChats() {
    if (clearConfirm !== "confirmar" || clearing) return;
    setClearing(true);
    try {
      const res = await apiFetch(`${apiUrl}/api/conversations/all`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "confirmar" })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { conversations: number };
      toast(`${d.conversations} conversa(s) apagada(s). Dashboard zerado.`, "success");
      setClearConfirm("");
    } catch (err) { console.error("[clearAllChats]", err); toast("Erro ao limpar chats", "error"); }
    finally { setClearing(false); }
  }

  async function saveRules(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId) return;
    try {
      const res = await apiFetch(`${apiUrl}/api/settings/${firstCrmClientId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rules) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("Regras salvas", "success");
    } catch (err) { console.error("[saveRules]", err); toast("Erro ao salvar regras", "error"); }
  }

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "departments", label: "Departamentos" },
    { id: "agents", label: "Agentes" },
    { id: "quickMessages", label: "Msgs Rapidas" },
    { id: "leadStatuses", label: "Status de Lead" },
    { id: "leadSources", label: "Origens" },
    { id: "pipelineStages", label: "Etapas do funil" },
    { id: "rules", label: "Regras" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "danger", label: "Zona de risco" }
  ];

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Administracao</p><h1>Configuracoes</h1></div>
      </header>
      <div className="settings-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`settings-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="settings-content">
        {tab === "departments" && (
          <div className="settings-section">
            <h2>Departamentos</h2>
            <form className="settings-add-form settings-add-form--wide" onSubmit={addDept}>
              <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Nome do departamento (ex: Vendas)" />
              <PermsEditor value={newDeptPerms} onChange={setNewDeptPerms} />
              <button className="primary-button slim" type="submit">Adicionar departamento</button>
            </form>
            <div className="dept-list">
              {departments.map((d) => {
                const draft = editingPerms[d.id];
                const current = normPerms(d.permissions);
                const allowed = VIEW_META.filter((v) => current.views[v.key]).map((v) => v.label).join(", ") || "Nenhuma";
                return (
                  <div key={d.id} className="dept-card">
                    <div className="dept-card-head">
                      <div>
                        <strong>{d.name}</strong>
                        <span className="dept-perms-summary">Acesso: {allowed} · Escopo: {current.scope === "all" ? "Todas conversas" : "Proprias"}</span>
                      </div>
                      <div className="dept-card-actions">
                        {draft ? (
                          <>
                            <button type="button" className="primary-button slim" onClick={() => saveDeptPerms(d.id)}>Salvar</button>
                            <button type="button" className="ghost-btn" onClick={() => setEditingPerms((p) => { const n = { ...p }; delete n[d.id]; return n; })}>Cancelar</button>
                          </>
                        ) : (
                          <button type="button" className="ghost-btn" onClick={() => setEditingPerms((p) => ({ ...p, [d.id]: current }))}>Permissoes</button>
                        )}
                        <button type="button" className="danger-btn" onClick={() => removeDept(d.id)}>Remover</button>
                      </div>
                    </div>
                    {draft && <PermsEditor value={draft} onChange={(p) => setEditingPerms((prev) => ({ ...prev, [d.id]: p }))} />}
                  </div>
                );
              })}
              {departments.length === 0 && <p style={{ textAlign: "center", color: "var(--muted)" }}>Nenhum departamento cadastrado.</p>}
            </div>
          </div>
        )}

        {tab === "agents" && (
          <div className="settings-section">
            <h2>Agentes</h2>
            <form className="settings-add-form settings-add-form--wide" onSubmit={addAgent}>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Nome" />
              <input value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} placeholder="Email" type="email" />
              <select value={agentDept} onChange={(e) => setAgentDept(e.target.value)}>
                <option value="">Sem departamento</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={agentRole} onChange={(e) => setAgentRole(e.target.value as "agent" | "admin")}>
                <option value="agent">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="primary-button slim" type="submit">Adicionar</button>
            </form>
            <table className="settings-table">
              <thead><tr><th>Nome</th><th>Email</th><th>Departamento</th><th>Papel</th><th>Acoes</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.email}</td>
                    <td>{a.department?.name ?? "-"}</td>
                    <td>{a.role === "admin" ? "Administrador" : "Usuario"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="ghost-btn" onClick={() => resetAgentPassword(a)}>Redefinir senha</button>
                      <button type="button" className="danger-btn" onClick={() => removeAgent(a.id)}>Remover</button>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>Nenhum agente cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "quickMessages" && (
          <div className="settings-section">
            <h2>Mensagens Rapidas</h2>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Digite / no chat para buscar e inserir mensagens rapidas.</p>
            <form className="settings-add-form settings-add-form--wide" onSubmit={addQM}>
              <input value={qmShortcut} onChange={(e) => setQmShortcut(e.target.value)} placeholder="Atalho (ex: ola)" />
              <input value={qmTitle} onChange={(e) => setQmTitle(e.target.value)} placeholder="Titulo" />
              <textarea value={qmBody} onChange={(e) => setQmBody(e.target.value)} placeholder="Corpo da mensagem" rows={2} style={{ resize: "vertical" }} />
              <button className="primary-button slim" type="submit">Adicionar</button>
            </form>
            <table className="settings-table">
              <thead><tr><th>Atalho</th><th>Titulo</th><th>Corpo</th><th>Acoes</th></tr></thead>
              <tbody>
                {quickMessages.map((q) => (
                  <tr key={q.id}>
                    <td><code>/{q.shortcut}</code></td>
                    <td>{q.title}</td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.body}</td>
                    <td><button type="button" className="danger-btn" onClick={() => removeQM(q.id)}>Remover</button></td>
                  </tr>
                ))}
                {quickMessages.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>Nenhuma mensagem rapida.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "leadStatuses" && (
          <div className="settings-section">
            <h2>Status de Lead</h2>
            <form className="settings-add-form" onSubmit={addLS}>
              <input value={lsName} onChange={(e) => setLsName(e.target.value)} placeholder="Nome do status" />
              <input type="color" value={lsColor} onChange={(e) => setLsColor(e.target.value)} style={{ width: 42, height: 38, padding: 2, border: "1px solid var(--line)", borderRadius: 8 }} />
              <button className="primary-button slim" type="submit">Adicionar</button>
            </form>
            <table className="settings-table">
              <thead><tr><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>
                {leadStatuses.map((l) => (
                  <tr key={l.id}>
                    <td><span className="tag" style={{ borderColor: l.color, color: l.color }}>● {l.name}</span></td>
                    <td><button type="button" className="danger-btn" onClick={() => removeLS(l.id)}>Remover</button></td>
                  </tr>
                ))}
                {leadStatuses.length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", color: "var(--muted)" }}>Nenhum status de lead.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "leadSources" && (
          <div className="settings-section">
            <h2>Origens dos leads</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              O sistema seta a origem sozinho: anúncios do Instagram/Facebook (Click-to-WhatsApp) são detectados automaticamente.
              Para TikTok/LinkedIn/site, defina um <strong>código</strong> e use o link wa.me gerado em cada plataforma —
              quando o lead clicar e mandar a 1ª mensagem com o código, a origem é identificada.
            </p>
            <label className="filter-label" style={{ maxWidth: 280, marginBottom: 12 }}>Seu número WhatsApp (só dígitos, com DDI)
              <input value={waNumber} onChange={(e) => setWaNumber(e.target.value.replace(/\D/g, ""))} placeholder="5521999999999" />
            </label>
            <form className="settings-add-form settings-add-form--wide" onSubmit={addSrc}>
              <input value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="Nome (ex: TikTok)" />
              <input value={srcCode} onChange={(e) => setSrcCode(e.target.value)} placeholder="Código do link (ex: tiktok)" />
              <input type="color" value={srcColor} onChange={(e) => setSrcColor(e.target.value)} style={{ width: 42, height: 38, padding: 2, border: "1px solid var(--line)", borderRadius: 8 }} />
              <button className="primary-button slim" type="submit">Adicionar</button>
            </form>
            <table className="settings-table">
              <thead><tr><th>Origem</th><th>Código</th><th>Link rastreável</th><th>Ações</th></tr></thead>
              <tbody>
                {leadSources.map((s) => {
                  const link = s.code ? `https://wa.me/${waNumber || "SEUNUMERO"}?text=${encodeURIComponent(s.code)}` : "—";
                  return (
                    <tr key={s.id}>
                      <td><span className="tag" style={{ borderColor: s.color, color: s.color }}>● {s.name}</span></td>
                      <td>{s.code ?? "—"}</td>
                      <td>{s.code ? <button type="button" className="ghost-btn" onClick={() => { navigator.clipboard?.writeText(link).then(() => toast("Link copiado", "success")).catch(() => {}); }}>Copiar link</button> : "auto (anúncio)"}</td>
                      <td><button type="button" className="danger-btn" onClick={() => removeSrc(s.id)}>Remover</button></td>
                    </tr>
                  );
                })}
                {leadSources.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>Nenhuma origem cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "pipelineStages" && (
          <div className="settings-section">
            <h2>Etapas do funil (board de Clientes)</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              As colunas do quadro de Clientes. Crie, renomeie, escolha a cor e remova. A ordem segue a de criação.
              Ao remover uma etapa, os clientes dela voltam para a primeira coluna.
            </p>
            <form className="settings-add-form settings-add-form--wide" onSubmit={addStage}>
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Nome (ex: Entrada)" />
              <input value={stageHint} onChange={(e) => setStageHint(e.target.value)} placeholder="Descrição (ex: Novos contatos)" />
              <input type="color" value={stageColor} onChange={(e) => setStageColor(e.target.value)} style={{ width: 42, height: 38, padding: 2, border: "1px solid var(--line)", borderRadius: 8 }} />
              <button className="primary-button slim" type="submit">Adicionar</button>
            </form>
            <table className="settings-table">
              <thead><tr><th>Etapa</th><th>Descrição</th><th>Ações</th></tr></thead>
              <tbody>
                {pipelineStages.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="tag" style={{ borderColor: s.color, color: s.color, marginRight: 8 }}>●</span>
                      <input defaultValue={s.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== s.name) renameStage(s.id, e.target.value); }} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "4px 8px", maxWidth: 180 }} />
                    </td>
                    <td>{s.hint || "—"}</td>
                    <td><button type="button" className="danger-btn" onClick={() => removeStage(s.id)}>Remover</button></td>
                  </tr>
                ))}
                {pipelineStages.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>Nenhuma etapa cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "whatsapp" && (
          <div className="settings-section">
            <h2>WhatsApp</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              Conecte o numero de WhatsApp da empresa via QR code. Mensagens recebidas criam conversas automaticamente.
            </p>
            <div className="wa-connect-panel">
              <div className="wa-status-row">
                <span className={`wa-status-dot wa-status-dot--${waStatus}`} />
                <span>
                  {waStatus === "connected" ? "Conectado" : waStatus === "connecting" ? "Aguardando escaneamento..." : "Desconectado"}
                </span>
                <button type="button" className="ghost-btn" style={{ marginLeft: "auto" }} onClick={syncWaStatus} disabled={waSyncing} title="Revalidar status no servidor">
                  {waSyncing ? "Sincronizando..." : "↻ Sincronizar"}
                </button>
              </div>
              {waStatus !== "connected" && (
                <>
                  <div className="wa-method-tabs" role="tablist">
                    <button type="button" role="tab" className={`wa-method-tab ${waMethod === "qr" ? "active" : ""}`} onClick={() => setWaMethod("qr")}>QR Code</button>
                    <button type="button" role="tab" className={`wa-method-tab ${waMethod === "code" ? "active" : ""}`} onClick={() => setWaMethod("code")}>Código de telefone</button>
                  </div>

                  {waMethod === "qr" && (
                    <button className="primary-button" type="button" onClick={connectWa} disabled={waLoading}>
                      {waLoading ? "Conectando..." : "Conectar via QR"}
                    </button>
                  )}

                  {waMethod === "code" && (
                    <div className="wa-code-form">
                      <input
                        className="settings-input"
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="Número com DDD (ex: 11 99999-9999)"
                        style={{ maxWidth: 320 }}
                      />
                      <button className="primary-button" type="button" onClick={connectWaCode} disabled={waLoading}>
                        {waLoading ? "Gerando..." : "Gerar código"}
                      </button>
                    </div>
                  )}
                </>
              )}
              {waStatus === "connected" && (
                <button className="danger-btn" type="button" onClick={disconnectWa} disabled={waLoading}>
                  Desconectar
                </button>
              )}
              {waMethod === "qr" && waQr && (
                <div className="wa-qr-wrapper">
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                    Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho → escaneie o QR abaixo:
                  </p>
                  <img src={waQr} alt="QR Code WhatsApp" className="wa-qr-img" />
                </div>
              )}
              {waMethod === "code" && waPairingCode && (
                <div className="wa-code-wrapper">
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                    No celular: WhatsApp → Aparelhos conectados → Conectar aparelho → <strong>Conectar com número de telefone</strong>. Digite o código:
                  </p>
                  <div className="wa-pairing-code">{waPairingCode}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "rules" && (
          <div className="settings-section">
            <h2>Regras de Atendimento</h2>
            <form className="rules-form" onSubmit={saveRules}>
              <div className="rule-item">
                <label>
                  <strong>Prazo de retorno pos-fechamento (dias)</strong>
                  <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 8px" }}>
                    Se o cliente retornar dentro deste prazo apos o fechamento, sera direcionado ao departamento de pos-venda.
                  </p>
                  <input
                    type="number" min="1" max="365"
                    value={rules["post_closure_return_days"] ?? "15"}
                    onChange={(e) => setRules((r) => ({ ...r, post_closure_return_days: e.target.value }))}
                    style={{ width: 100 }}
                    className="settings-input"
                  />
                  <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>dias</span>
                </label>
              </div>
              <div className="rule-item">
                <label>
                  <strong>Departamento de pos-venda (retorno)</strong>
                  <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 8px" }}>
                    Conversas de retorno serao automaticamente atribuidas a este departamento.
                  </p>
                  <select
                    value={rules["post_closure_department_id"] ?? ""}
                    onChange={(e) => setRules((r) => ({ ...r, post_closure_department_id: e.target.value }))}
                    className="filter-select"
                  >
                    <option value="">Nenhum (nao aplicar regra)</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="rule-item">
                <label className="rule-toggle">
                  <input
                    type="checkbox"
                    checked={rules["trigger_close_enabled"] === "true"}
                    onChange={(e) => setRules((r) => ({ ...r, trigger_close_enabled: e.target.checked ? "true" : "false" }))}
                  />
                  <strong>Fechamento automático por palavra-chave</strong>
                </label>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 8px" }}>
                  Quando o agente enviar uma mensagem citando uma destas palavras, a conversa é encerrada automaticamente.
                </p>
                <input
                  value={rules["trigger_close_keywords"] ?? ""}
                  onChange={(e) => setRules((r) => ({ ...r, trigger_close_keywords: e.target.value }))}
                  placeholder="fechamento, fechado, fechar"
                  className="settings-input"
                  style={{ width: "100%", maxWidth: 420 }}
                  disabled={rules["trigger_close_enabled"] !== "true"}
                />
                <span style={{ display: "block", marginTop: 4, color: "var(--muted)", fontSize: 12 }}>Separe por vírgula. Vazio = usa padrão (fechamento, fechado, fechar).</span>
              </div>

              <div className="rule-item">
                <label className="rule-toggle">
                  <input
                    type="checkbox"
                    checked={rules["trigger_value_enabled"] === "true"}
                    onChange={(e) => setRules((r) => ({ ...r, trigger_value_enabled: e.target.checked ? "true" : "false" }))}
                  />
                  <strong>Valor automático por palavra-chave</strong>
                </label>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 8px" }}>
                  Quando o agente citar uma destas palavras junto a um número, o valor do lead é atualizado (ex: "valor 1.500,00").
                </p>
                <input
                  value={rules["trigger_value_keywords"] ?? ""}
                  onChange={(e) => setRules((r) => ({ ...r, trigger_value_keywords: e.target.value }))}
                  placeholder="valor, preço, R$"
                  className="settings-input"
                  style={{ width: "100%", maxWidth: 420 }}
                  disabled={rules["trigger_value_enabled"] !== "true"}
                />
                <span style={{ display: "block", marginTop: 4, color: "var(--muted)", fontSize: 12 }}>Separe por vírgula. Vazio = usa padrão (valor, preço, R$).</span>
              </div>

              <button className="primary-button" type="submit">Salvar regras</button>
            </form>
          </div>
        )}

        {tab === "danger" && (
          <div className="settings-section">
            <h2>Zona de risco</h2>
            <div className="danger-zone">
              <h3 style={{ marginTop: 0 }}>Limpar todos os chats</h3>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Apaga <strong>todas as conversas, mensagens e agendamentos</strong> desta conta e
                <strong> zera o dashboard</strong>. Contatos, etiquetas e configurações NÃO são afetados.
                <br />Esta ação é <strong>irreversível</strong>.
              </p>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "12px 0 4px" }}>
                Digite <code>confirmar</code> para habilitar:
              </label>
              <input
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                placeholder="confirmar"
                className="settings-input"
                style={{ maxWidth: 240, display: "block", marginBottom: 12 }}
              />
              <button
                type="button"
                className="danger-btn"
                disabled={clearConfirm !== "confirmar" || clearing}
                onClick={clearAllChats}
              >
                {clearing ? "Apagando..." : "Apagar todos os chats"}
              </button>
            </div>
          </div>
        )}
      </div>
      {credInfo && (
        <div className="modal-overlay" onClick={() => setCredInfo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Senha de acesso</h2>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Guarde e repasse agora — <strong>não será exibida de novo</strong>. Se perder, use "Redefinir senha".
            </p>
            <div style={{ background: "var(--surface-2, #f1f4f5)", borderRadius: 8, padding: 12, margin: "12px 0" }}>
              <div style={{ fontSize: 13 }}><strong>{credInfo.name}</strong></div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{credInfo.email}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <code style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{credInfo.password}</code>
                <button type="button" className="ghost-btn" onClick={() => { navigator.clipboard?.writeText(credInfo.password).then(() => toast("Senha copiada", "success")).catch(() => {}); }}>Copiar</button>
              </div>
            </div>
            <button type="button" className="primary-button slim" onClick={() => setCredInfo(null)}>Fechar</button>
          </div>
        </div>
      )}
      <ToastList toasts={toasts} />
    </>
  );
}

type ContactResult = {
  id: string; fullName: string; companyName: string | null;
  phone: string | null; whatsappJid: string | null; instagramHandle: string | null;
  email: string | null; leadTemperature: string; priority: string;
};

function ProspeccaoModal({
  departments, firstCrmClientId, onClose, onCreated, onError
}: {
  departments: Department[]; firstCrmClientId: string | null;
  onClose: () => void; onCreated: (conv: Conversation) => void; onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<"search" | "form">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ContactResult | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [convChannel, setConvChannel] = useState<Channel>("whatsapp");
  const [deptId, setDeptId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim() || !firstCrmClientId) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`${apiUrl}/api/end-customers?crmClientId=${firstCrmClientId}&search=${encodeURIComponent(v)}&limit=8`);
        if (res.ok) setResults(await res.json());
        else { console.error(`[ProspeccaoModal] busca falhou: HTTP ${res.status}`); setResults([]); }
      } catch (err) {
        console.error("[ProspeccaoModal] busca erro:", err); setResults([]);
      } finally { setSearching(false); }
    }, 280);
  }

  function selectContact(c: ContactResult) {
    setSelected(c);
    setIsNew(false);
    setName(c.fullName);
    setPhone(c.phone ?? "");
    setCompany(c.companyName ?? "");
    setEmail(c.email ?? "");
    setStep("form");
  }

  function createNew() {
    setSelected(null);
    setIsNew(true);
    const q = query.trim();
    // Se a busca parece um telefone (só dígitos/símbolos de fone, 8+ dígitos),
    // joga no campo telefone; senão usa como nome do contato.
    const digits = q.replace(/\D/g, "");
    const looksPhone = /^[+()\d\s.\-]+$/.test(q) && digits.length >= 8;
    if (looksPhone) {
      setName("");
      setPhone(q);
    } else {
      setName(q);
      setPhone("");
    }
    setCompany("");
    setEmail("");
    setStep("form");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!firstCrmClientId) return;
    setLoading(true);
    try {
      const body: Record<string, string | undefined> = {
        channelType: convChannel,
        departmentId: deptId || undefined,
        firstMessage: firstMessage.trim() || undefined
      };
      if (selected) {
        body.endCustomerId = selected.id;
      } else {
        if (!name.trim()) { onError("Informe o nome do contato"); setLoading(false); return; }
        body.customerName = name.trim();
        body.companyName = company.trim() || undefined;
        body.email = email.trim() || undefined;
        if (convChannel === "whatsapp") {
          if (!phone.trim()) { onError("Informe o numero de WhatsApp"); setLoading(false); return; }
          body.phone = phone.trim();
        } else {
          if (!phone.trim()) { onError("Informe o handle do Instagram"); setLoading(false); return; }
          body.phone = phone.trim();
        }
      }
      const res = await apiFetch(`${apiUrl}/api/conversations/initiate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Erro ${res.status}`);
      }
      const created = (await res.json()) as Conversation;
      onCreated(created);
    } catch (err) {
      console.error("[ProspeccaoModal] initiate failed:", err);
      onError(err instanceof Error ? err.message : "Erro ao criar conversa");
    } finally { setLoading(false); }
  }

  const contactPhone = selected?.phone ?? selected?.whatsappJid ?? null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--prosp" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step === "form" && (
              <button type="button" className="icon-btn" onClick={() => setStep("search")} title="Voltar">←</button>
            )}
            <h2>{step === "search" ? "Nova prospecção" : isNew ? "Novo contato" : "Iniciar conversa"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {step === "search" && (
          <div className="prosp-search-step">
            <p className="prosp-hint">Busque um contato existente ou crie um novo para iniciar a conversa.</p>
            <div className="prosp-search-box">
              <span className="prosp-search-icon">🔍</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Nome, telefone ou empresa..."
                className="prosp-search-input"
              />
              {searching && <span className="prosp-spinner" />}
            </div>

            {results.length > 0 && (
              <div className="prosp-results">
                {results.map((c) => (
                  <button key={c.id} type="button" className="prosp-result-item" onClick={() => selectContact(c)}>
                    <div className="avatar prosp-avatar">{initials(c.fullName)}</div>
                    <div className="prosp-result-info">
                      <strong>{c.fullName}</strong>
                      <span>{[c.companyName, c.phone ?? c.whatsappJid].filter(Boolean).join(" · ")}</span>
                    </div>
                    <span className={`temp-dot temp-dot--${c.leadTemperature}`} />
                  </button>
                ))}
              </div>
            )}

            {query.trim().length > 0 && !searching && (
              <button type="button" className="prosp-create-btn" onClick={createNew}>
                <span className="prosp-create-icon">+</span>
                Criar novo contato{name ? ` "${query}"` : ""}
              </button>
            )}

            {!query && (
              <button type="button" className="prosp-create-btn" onClick={createNew}>
                <span className="prosp-create-icon">+</span>
                Criar novo contato
              </button>
            )}
          </div>
        )}

        {step === "form" && (
          <form className="modal-form prosp-form" onSubmit={submit}>
            {selected ? (
              <div className="prosp-selected-card">
                <div className="avatar">{initials(selected.fullName)}</div>
                <div>
                  <strong>{selected.fullName}</strong>
                  <span>{selected.companyName ?? contactPhone ?? "—"}</span>
                </div>
                <button type="button" className="icon-btn" onClick={() => { setSelected(null); setStep("search"); }} title="Trocar contato">✕</button>
              </div>
            ) : (
              <fieldset className="prosp-fieldset">
                <legend>Dados do contato</legend>
                <label>
                  Nome *
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
                </label>
                <label>
                  {convChannel === "whatsapp" ? "Número WhatsApp *" : "Handle Instagram *"}
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={convChannel === "whatsapp" ? "+55 11 99999-9999" : "@usuario"}
                  />
                </label>
                <div className="prosp-two-col">
                  <label>
                    Empresa
                    <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" />
                  </label>
                  <label>
                    Email
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
                  </label>
                </div>
              </fieldset>
            )}

            <fieldset className="prosp-fieldset">
              <legend>Conversa</legend>
              <label>
                Canal
                <div className="channel-tabs" style={{ marginTop: 6 }}>
                  {(["whatsapp", "instagram"] as Channel[]).map((c) => (
                    <button key={c} type="button" className={`channel-tab ${convChannel === c ? "active" : ""}`} onClick={() => setConvChannel(c)}>
                      <span className={`channel-icon ${c === "whatsapp" ? "wpp" : "instagram"}`}>{c === "whatsapp" ? "W" : "IG"}</span>
                      {c === "whatsapp" ? "WhatsApp" : "Instagram"}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Departamento
                <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label>
                Primeira mensagem <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional)</span>
                <textarea
                  rows={3}
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  placeholder="Olá! Gostaria de apresentar nossa proposta..."
                  style={{ resize: "vertical" }}
                />
              </label>
            </fieldset>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Iniciando..." : "Iniciar conversa"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ScheduleModal({ conversationId, crmClientId, onClose, onError }: { conversationId: string; crmClientId: string; onClose: () => void; onError: (msg: string) => void }) {
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !scheduledAt) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${apiUrl}/api/scheduled-messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmClientId, conversationId, body, scheduledAt })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error("[ScheduleModal] create failed:", err);
      onError("Erro ao agendar mensagem. Tente novamente.");
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Agendar mensagem</h2><button type="button" className="icon-btn" onClick={onClose}>✕</button></div>
        {done ? (
          <p style={{ textAlign: "center", color: "var(--success)", padding: 24, fontWeight: 800 }}>Mensagem agendada!</p>
        ) : (
          <form onSubmit={submit} className="modal-form">
            <label>Data e hora<input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
            <label>Mensagem<textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite a mensagem que sera enviada..." style={{ resize: "vertical" }} /></label>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? "Agendando..." : "Agendar"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function BulkScheduleModal({ crmClientId, endCustomerIds, onClose, onError, onDone }: {
  crmClientId: string; endCustomerIds: string[];
  onClose: () => void; onError: (msg: string) => void; onDone: (n: number) => void;
}) {
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [channelType, setChannelType] = useState<Channel>("whatsapp");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !scheduledAt || endCustomerIds.length === 0) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${apiUrl}/api/scheduled-messages/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endCustomerIds, channelType, body, scheduledAt })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { scheduled: number };
      onDone(data.scheduled);
    } catch (err) {
      console.error("[BulkScheduleModal] failed:", err);
      onError("Erro ao agendar em massa. Tente novamente.");
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Disparo em massa</h2><button type="button" className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={submit} className="modal-form">
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Agenda a mesma mensagem para <strong>{endCustomerIds.length}</strong> cliente(s) listado(s).</p>
          <label>Canal
            <select value={channelType} onChange={(e) => setChannelType(e.target.value as Channel)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label>Data e hora<input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
          <label>Mensagem<textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensagem enviada a todos os clientes selecionados..." style={{ resize: "vertical" }} /></label>
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Agendando..." : `Agendar para ${endCustomerIds.length}`}</button>
        </form>
      </div>
    </div>
  );
}

function AudioRecorder({ onSend, onError }: { onSend: (audioBase64: string, mimetype: string) => void; onError: (msg: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("Gravacao de audio nao suportada neste navegador");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) { setBusy(false); return; }
        try {
          const dataUri = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = () => reject(fr.error);
            fr.onload = () => resolve(String(fr.result));
            fr.readAsDataURL(blob);
          });
          onSend(dataUri, rec.mimeType || "audio/webm");
        } catch (err) {
          console.error("[AudioRecorder] encode falhou:", err);
          onError("Erro ao processar audio");
        } finally { setBusy(false); }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err) {
      console.error("[AudioRecorder] getUserMedia falhou:", err);
      onError("Permita o acesso ao microfone para gravar");
    }
  }

  function stop() {
    if (recorderRef.current && recording) {
      setBusy(true);
      setRecording(false);
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }

  return (
    <button
      type="button"
      className={`reply-tool-btn ${recording ? "recording" : ""}`}
      onClick={recording ? stop : start}
      disabled={busy}
      title={recording ? "Parar e enviar" : "Gravar audio"}
    >
      {recording ? "⏹ Parar" : busy ? "..." : "🎤 Audio"}
    </button>
  );
}

function MediaAttach({ onSelect, onError }: { onSelect: (file: File) => void; onError: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX = 14 * 1024 * 1024; // ~14MB (limite do body é 16MB; base64 infla ~33%)
  return (
    <>
      <button type="button" className="reply-tool-btn" onClick={() => inputRef.current?.click()} title="Anexar foto ou arquivo">📎 Anexo</button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permite re-selecionar o mesmo arquivo
          if (!file) return;
          if (file.size > MAX) { onError("Arquivo muito grande (max 14MB)"); return; }
          onSelect(file);
        }}
      />
    </>
  );
}

function ToastList({ toasts }: { toasts: ToastEntry[] }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-list" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function NavButton({ active, count, icon, label, onClick }: { active: boolean; count?: number; icon: string; label: string; onClick: () => void }) {
  return (
    <button className={`nav-link ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {typeof count === "number" && <small>{count}</small>}
    </button>
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
    <div><span>{label}</span><strong>{value}</strong></div>
  );
}

function handleDrop(event: DragEvent<HTMLDivElement>, stageId: string, onMoveClient: (id: string, stageId: string) => void) {
  event.preventDefault();
  const id = event.dataTransfer.getData("text/plain");
  if (id) onMoveClient(id, stageId);
}

function buildClients(conversations: Conversation[]): ClientCard[] {
  const byCustomer = new Map<string, ClientCard>();
  conversations.forEach((conv) => {
    if (byCustomer.has(conv.endCustomer.id)) return;
    byCustomer.set(conv.endCustomer.id, {
      id: conv.endCustomer.id,
      name: conv.endCustomer.fullName,
      company: conv.endCustomer.companyName ?? conv.crmClient.tradeName,
      crmClient: conv.crmClient.tradeName,
      stageId: conv.endCustomer.pipelineStage?.id ?? null,
      temperature: conv.endCustomer.leadTemperature,
      priority: conv.endCustomer.priority,
      value: conv.endCustomer.estimatedValueCents,
      owner: conv.endCustomer.assignedTo ?? conv.assignedAgent?.name ?? "—",
      labels: conv.endCustomer.labels.map(({ label }) => label),
      source: conv.endCustomer.leadSource ? { name: conv.endCustomer.leadSource.name, color: conv.endCustomer.leadSource.color } : null
    });
  });
  return Array.from(byCustomer.values());
}

function initials(name: string) { return (name ?? "").trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?"; }
function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100); }
function elapsed(date: string) { const m = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000)); return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; }
function time(date: string) { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date)); }
function temperature(v: string) { return ({ hot: "Lead quente", warm: "Lead morno", cold: "Lead frio" } as Record<string, string>)[v] ?? v; }
function classification(v: string) { return ({ strategic: "Estrategico", growth: "Crescimento", standard: "Padrao", at_risk: "Em risco" } as Record<string, string>)[v] ?? v; }
function sla(v: string) { return ({ on_time: "No prazo", warning: "Atencao", late: "Atrasado" } as Record<string, string>)[v] ?? v; }
function priority(v: string) { return ({ high: "Alta", medium: "Media", low: "Baixa" } as Record<string, string>)[v] ?? v; }
function convStatusLabel(s: ConvStatus) { return ({ pending: "Pendente", open: "Ativo", waiting_customer: "Aguardando", waiting_agent: "Fila", closed: "Fechado" } as Record<string, string>)[s] ?? s; }
function formatSeconds(s: number) { if (!s) return "-"; if (s < 60) return `${s}s`; if (s < 3600) return `${Math.round(s / 60)}min`; return `${Math.round(s / 3600)}h`; }
