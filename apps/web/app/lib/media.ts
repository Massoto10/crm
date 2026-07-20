// Helpers puros de mensagem/mídia e agrupamento de status da inbox.
// Extraídos de page.tsx para poderem ser testados sem montar o componente.

export type ChatStatus = "pending" | "active" | "closed";
export type ConvStatus = "pending" | "open" | "waiting_customer" | "waiting_agent" | "closed";

// Agrupamento das abas da inbox sobre os status do backend. "Ativo" cobre os três
// estados intermediários (ver findAll em apps/api/src/conversations/conversations.service.ts).
export function matchesChatStatus(status: ConvStatus, tab: ChatStatus): boolean {
  if (tab === "pending") return status === "pending";
  if (tab === "closed") return status === "closed";
  return status === "open" || status === "waiting_customer" || status === "waiting_agent";
}

// Aba da inbox onde uma conversa aparece. Inverso de matchesChatStatus.
export function chatStatusFor(status: ConvStatus): ChatStatus {
  if (status === "pending") return "pending";
  if (status === "closed") return "closed";
  return "active";
}

// Textos que o backend grava em Message.body quando a mídia vem sem legenda.
// Espelha whatsapp-webhook.service.ts (extractText) e conversations.service.ts
// (createAgentMedia) — se mudar lá, mudar aqui.
export const MEDIA_PLACEHOLDERS = new Set([
  "[Imagem]",
  "[Vídeo]",
  "[Áudio]",
  "[Figurinha]",
  "[Sticker]",
  "[Localização]",
  "[Contato]"
]);

// Legenda real da mídia, ou null quando o body é só o placeholder.
export function mediaCaption(body: string | undefined | null): string | null {
  const t = (body ?? "").trim();
  if (!t || MEDIA_PLACEHOLDERS.has(t) || t.startsWith("[Documento]") || t.startsWith("[Contato]")) return null;
  return t;
}

// Extensão a partir do mimetype do data URI, pros casos comuns. Sem isso, um
// documento sem fileName baixa como "arquivo" sem extensão e o SO não abre.
export const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3"
};

// Nome de download do anexo: usa o fileName vindo no body e garante extensão.
export function downloadName(body: string | undefined | null, mediaUrl: string): string {
  const base = (body ?? "").replace(/^\[Documento\]\s*/, "").trim() || "arquivo";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const mime = mediaUrl.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  const ext = mime ? EXT_BY_MIME[mime] : undefined;
  return ext ? `${base}.${ext}` : base;
}
