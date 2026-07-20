import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "./whatsapp.service";
import { PipelineStageService } from "../pipeline/pipeline-stage.service";

// Referência de anúncio Click-to-WhatsApp (Meta/Instagram/Facebook)
interface ExternalAdReply {
  sourceUrl?: string;
  sourceId?: string;
  sourceType?: string;
  title?: string;
  body?: string;
}
interface MsgContextInfo {
  externalAdReply?: ExternalAdReply;
}

interface EvoMessageContent {
  conversation?: string;
  extendedTextMessage?: { text: string; contextInfo?: MsgContextInfo };
  imageMessage?: { caption?: string; mimetype?: string; contextInfo?: MsgContextInfo };
  videoMessage?: { caption?: string; mimetype?: string; contextInfo?: MsgContextInfo };
  audioMessage?: { mimetype?: string } & Record<string, unknown>;
  documentMessage?: { title?: string; fileName?: string; mimetype?: string };
  stickerMessage?: { mimetype?: string } & Record<string, unknown>;
  contactMessage?: { displayName?: string };
  locationMessage?: Record<string, unknown>;
  reactionMessage?: Record<string, unknown>;
  protocolMessage?: Record<string, unknown>;
  ephemeralMessage?: { message?: EvoMessageContent };
  viewOnceMessage?: { message?: EvoMessageContent };
  viewOnceMessageV2?: { message?: EvoMessageContent };
}

interface EvoMessageUpsert {
  event: "messages.upsert";
  instance: string;
  data: {
    // senderPn = real phone JID when remoteJid is a @lid (Evolution v2.3+)
    key: { remoteJid: string; fromMe: boolean; id: string; senderPn?: string };
    pushName?: string;
    message?: EvoMessageContent;
    messageType?: string;
  };
}

interface EvoConnectionUpdate {
  event: "connection.update";
  instance: string;
  data: { state: "open" | "connecting" | "close"; qr?: string };
}

interface EvoQrcodeUpdated {
  event: "qrcode.updated";
  instance: string;
  data: { qrcode: { base64: string; code?: string } };
}

type EvoEvent = EvoMessageUpsert | EvoConnectionUpdate | EvoQrcodeUpdated | { event: string };

// Janela de carência antes de uma mensagem do cliente devolver a conversa pra
// "pendente". Se o operador respondeu há menos que isso, a conversa continua
// "ativa" — evita ela pular de aba no meio de um papo em tempo real.
export const AGENT_REPLY_GRACE_MS = 5 * 60 * 1000;

export function extractText(msg: EvoMessageContent | undefined): string | null {
  if (!msg) return null;

  // Unwrap ephemeral / view-once containers (v2)
  const inner = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message;
  if (inner) return extractText(inner);

  // Ignore reactions, edits/deletes and other protocol events — not real messages
  if (msg.reactionMessage || msg.protocolMessage) return null;

  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage) return msg.imageMessage.caption || "[Imagem]";
  if (msg.videoMessage) return msg.videoMessage.caption || "[Vídeo]";
  if (msg.audioMessage) return "[Áudio]";
  if (msg.documentMessage) return `[Documento] ${msg.documentMessage.fileName ?? msg.documentMessage.title ?? ""}`.trim();
  if (msg.stickerMessage) return "[Figurinha]";
  if (msg.contactMessage) return `[Contato] ${msg.contactMessage.displayName ?? ""}`.trim();
  if (msg.locationMessage) return "[Localização]";

  return null; // unknown type — skip instead of storing junk
}

// Detecta o tipo de mídia (desembrulhando containers). null = texto/sem mídia.
export function detectMediaType(msg: EvoMessageContent | undefined): "audio" | "image" | "video" | "document" | "sticker" | null {
  if (!msg) return null;
  const inner = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message;
  if (inner) return detectMediaType(inner);
  if (msg.audioMessage) return "audio";
  if (msg.imageMessage) return "image";
  if (msg.videoMessage) return "video";
  if (msg.documentMessage) return "document";
  if (msg.stickerMessage) return "sticker";
  return null;
}

// Mimetype declarado pelo próprio WhatsApp no payload. É a fonte mais confiável:
// o Evolution às vezes devolve a mídia sem mimetype, e aí o arquivo salvo fica com
// o content-type errado e não abre. Default por tipo quando o payload também omite.
export function detectMimetype(msg: EvoMessageContent | undefined): string | undefined {
  if (!msg) return undefined;
  const inner = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message;
  if (inner) return detectMimetype(inner);
  if (msg.audioMessage) return msg.audioMessage.mimetype?.trim() || "audio/ogg";
  if (msg.imageMessage) return msg.imageMessage.mimetype?.trim() || "image/jpeg";
  if (msg.videoMessage) return msg.videoMessage.mimetype?.trim() || "video/mp4";
  if (msg.documentMessage) return msg.documentMessage.mimetype?.trim() || "application/octet-stream";
  // Figurinha do WhatsApp e webp (as animadas tambem).
  if (msg.stickerMessage) return msg.stickerMessage.mimetype?.trim() || "image/webp";
  return undefined;
}

// Nome do arquivo declarado no payload, quando houver.
export function detectFileName(msg: EvoMessageContent | undefined): string | undefined {
  if (!msg) return undefined;
  const inner = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message;
  if (inner) return detectFileName(inner);
  const n = msg.documentMessage?.fileName ?? msg.documentMessage?.title;
  return n?.trim() || undefined;
}

// Extrai a referência de anúncio (CTWA) da mensagem, desembrulhando containers.
function detectAdReferral(msg: EvoMessageContent | undefined): ExternalAdReply | null {
  if (!msg) return null;
  const inner = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message;
  if (inner) return detectAdReferral(inner);
  return (
    msg.extendedTextMessage?.contextInfo?.externalAdReply ??
    msg.imageMessage?.contextInfo?.externalAdReply ??
    msg.videoMessage?.contextInfo?.externalAdReply ??
    null
  );
}

// Classifica a plataforma do anúncio pela URL/tipo de origem.
function classifyAdSource(ad: ExternalAdReply): string {
  const hay = `${ad.sourceUrl ?? ""} ${ad.sourceType ?? ""}`.toLowerCase();
  if (hay.includes("instagram") || hay.includes("ig")) return "Instagram Ads";
  if (hay.includes("facebook") || hay.includes("fb")) return "Facebook Ads";
  return "Anúncio Meta";
}

export function cleanPhone(jid: string): string {
  return jid.replace(/@.+$/, "").replace(/\D/g, "");
}

// Evolution sometimes sends the literal string "Null"/"null" as profileName/pushName.
// Treat those as absent so we don't store a contact/message named "Null".
export function cleanName(name: string | undefined): string | undefined {
  const n = name?.trim();
  if (!n || n.toLowerCase() === "null" || n.toLowerCase() === "undefined") return undefined;
  return n;
}

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly pipeline: PipelineStageService
  ) {}

  async handle(payload: EvoEvent): Promise<void> {
    if (payload.event === "messages.upsert") {
      await this.handleMessage(payload as EvoMessageUpsert);
    } else if (payload.event === "connection.update") {
      await this.handleConnectionUpdate(payload as EvoConnectionUpdate);
    } else if (payload.event === "qrcode.updated") {
      await this.handleQrcodeUpdated(payload as EvoQrcodeUpdated);
    }
  }

  private async handleMessage(ev: EvoMessageUpsert): Promise<void> {
    const { key, message } = ev.data;
    const pushName = cleanName(ev.data.pushName);

    // Only process individual contacts — skip groups (@g.us) and broadcasts
    const jid = key.remoteJid ?? "";
    if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) return;

    const text = extractText(message);
    if (!text) return;

    const waMessageId = key.id;

    // For outbound messages (fromMe), deduplicate against CRM-sent messages.
    // If waMessageId already in DB → CRM sent it, skip. Otherwise store as agent message.
    if (key.fromMe) {
      const existing = waMessageId
        ? await this.prisma.message.findUnique({ where: { waMessageId } })
        : null;
      if (existing) return;
      // Sent directly from phone — store as agent message (com mídia, se houver)
      await this.storePhoneSentMessage(ev.instance, key, waMessageId, text, message, pushName);
      return;
    }

    // Idempotency — skip if already processed
    const existing = await this.prisma.message.findUnique({ where: { waMessageId } });
    if (existing) return;

    // Resolve which CRM client owns this instance
    const setting = await this.prisma.setting.findFirst({
      where: { key: "wa_instance_name", value: ev.instance }
    });
    if (!setting) {
      this.logger.warn(`No crmClientId found for instance=${ev.instance}`);
      return;
    }
    const crmClientId = setting.crmClientId;

    const customer = await this.resolveCustomer(crmClientId, key, pushName, true);
    if (!customer) return;
    const phone = customer.phone ?? cleanPhone(jid);

    // Detecção automática de origem — só se o cliente ainda não tem origem definida
    if (!customer.leadSourceId) {
      await this.detectAndSetSource(crmClientId, customer.id, message, text).catch((e) =>
        this.logger.warn(`detectAndSetSource falhou customerId=${customer.id}: ${e}`)
      );
    }

    // Find or reopen conversation (most recent non-closed whatsapp conv)
    let conv = await this.prisma.conversation.findFirst({
      where: { crmClientId, endCustomerId: customer.id, channelType: "whatsapp", status: { not: "closed" } },
      orderBy: { lastMessageAt: "desc" }
    });

    const now = new Date();
    const isNewConversation = !conv;

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          crmClientId,
          endCustomerId: customer.id,
          channelType: "whatsapp",
          status: "pending",
          stage: "Primeiro contato",
          slaStatus: "on_time",
          lastMessagePreview: text.slice(0, 100),
          lastMessageAt: now
        }
      });
      this.logger.log(`new whatsapp conversation created id=${conv.id} phone=${phone}`);
    }

    const mediaType = detectMediaType(message);

    // Baixa a mídia ANTES de criar a mensagem: se criasse antes, a mensagem
    // apareceria no CRM como "anexo indisponível" até o download terminar e o
    // próximo poll chegar. Assim ela já nasce completa.
    let mediaUrl: string | null = null;
    if (mediaType && waMessageId) {
      const media = await this.whatsapp.getMediaBase64(ev.instance, waMessageId, detectMimetype(message));
      if (media) mediaUrl = `data:${media.mimetype};base64,${media.base64}`;
      else this.logger.warn(`${mediaType} inbound sem base64 waMessageId=${waMessageId}`);
    }

    let createdId: string;
    try {
      const created = await this.prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: "end_customer",
          // pushName pode nao vir; cai no nome cadastrado antes de cair no numero
          senderName: pushName ?? customer.fullName ?? phone,
          body: text,
          mediaType: mediaType ?? null,
          mediaUrl,
          sentAt: now,
          waMessageId
        }
      });
      createdId = created.id;
    } catch (err) {
      // Reenvio concorrente do Evolution com o mesmo waMessageId — já gravado.
      if (this.isUniqueViolation(err)) {
        this.logger.log(`duplicate webhook ignored waMessageId=${waMessageId}`);
        return;
      }
      throw err;
    }
    if (mediaUrl) this.logger.log(`${mediaType} inbound salvo msgId=${createdId}`);

    // Mensagem do cliente devolve a conversa pra "pendente" (fila de atendimento),
    // exceto se o operador respondeu há pouco — aí ele está no papo e a conversa
    // segue "ativa". Conversa recém-criada já nasce pendente.
    let backToPending = false;
    if (!isNewConversation && conv.status !== "pending") {
      const lastAgentMsg = await this.prisma.message.findFirst({
        where: { conversationId: conv.id, senderType: "agent" },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true }
      });
      // Não dá pra usar conv.lastMessageAt: mensagem do cliente também bumpa esse
      // campo, então um cliente mandando várias seguidas suprimiria a transição.
      backToPending = !lastAgentMsg || now.getTime() - lastAgentMsg.sentAt.getTime() >= AGENT_REPLY_GRACE_MS;
    }

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        lastMessagePreview: text.slice(0, 100),
        lastMessageAt: now,
        unreadCount: { increment: 1 },
        ...(backToPending ? { status: "pending" as const } : {})
      }
    });
    if (backToPending) this.logger.log(`conversation back to pending id=${conv.id}`);

    // Update customer last contact
    await this.prisma.endCustomer.update({
      where: { id: customer.id },
      data: { lastContactAt: now }
    });

    // Classificação automática do funil a partir do que o cliente escreveu.
    await this.pipeline.applyFromMessage({
      crmClientId,
      endCustomerId: customer.id,
      texto: text,
      origem: "cliente"
    });

    this.logger.log(`message stored waMessageId=${waMessageId} convId=${conv.id}`);
  }

  private async handleQrcodeUpdated(ev: EvoQrcodeUpdated): Promise<void> {
    const setting = await this.prisma.setting.findFirst({
      where: { key: "wa_instance_name", value: ev.instance }
    });
    if (!setting) return;

    const base64 = ev.data?.qrcode?.base64;
    if (!base64) return;

    await this.prisma.setting.upsert({
      where: { crmClientId_key: { crmClientId: setting.crmClientId, key: "wa_qr" } },
      create: { crmClientId: setting.crmClientId, key: "wa_qr", value: base64 },
      update: { value: base64 }
    });
    this.logger.log(`qrcode.updated stored for instance=${ev.instance}`);
  }

  private async handleConnectionUpdate(ev: EvoConnectionUpdate): Promise<void> {
    const setting = await this.prisma.setting.findFirst({
      where: { key: "wa_instance_name", value: ev.instance }
    });
    if (!setting) return;

    const status = ev.data.state === "open" ? "connected" : ev.data.state === "connecting" ? "connecting" : "disconnected";
    await this.prisma.setting.upsert({
      where: { crmClientId_key: { crmClientId: setting.crmClientId, key: "wa_status" } },
      create: { crmClientId: setting.crmClientId, key: "wa_status", value: status },
      update: { value: status }
    });
    // Clear stored QR once connected
    if (status === "connected") {
      await this.prisma.setting.deleteMany({
        where: { crmClientId: setting.crmClientId, key: "wa_qr" }
      });
    }
    this.logger.log(`connection.update instance=${ev.instance} state=${ev.data.state} → wa_status=${status}`);
  }

  /**
   * Finds the customer by WhatsApp identity, matching BOTH the jid and the
   * phone number. A person can appear as `5521...@s.whatsapp.net` or as a
   * `...@lid` (hidden-number id) — without cross-matching we'd create two
   * customers and two chats for the same person. When the chat is @lid,
   * Evolution v2.3+ sends the real number in `key.senderPn`.
   *
   * If multiple records match (stale duplicates), they are merged automatically
   * into the oldest record before returning.
   */
  private async resolveCustomer(
    crmClientId: string,
    key: EvoMessageUpsert["data"]["key"],
    pushName: string | undefined,
    createIfMissing: boolean
  ) {
    const jid = key.remoteJid;
    const jidDigits = cleanPhone(jid);
    const realPhone = key.senderPn ? cleanPhone(key.senderPn) : jid.endsWith("@lid") ? null : jidDigits;
    const phones = [...new Set([realPhone, jidDigits].filter((p): p is string => !!p))];

    const matches = await this.prisma.endCustomer.findMany({
      where: { crmClientId, OR: [{ whatsappJid: jid }, { phone: { in: phones } }] },
      orderBy: { createdAt: "asc" }
    });

    if (matches.length === 0) {
      if (!createIfMissing) return null;
      try {
        return await this.prisma.endCustomer.create({
          data: {
            crmClientId,
            fullName: pushName ?? realPhone ?? jidDigits,
            phone: realPhone ?? jidDigits,
            whatsappJid: jid,
            originChannel: "whatsapp",
            lifecycleStage: "new",
            leadTemperature: "cold",
            priority: "low"
          }
        });
      } catch (err) {
        // Corrida: outro webhook do mesmo contato criou o registro primeiro.
        // A constraint única disparou P2002 — busca o vencedor da corrida.
        if (this.isUniqueViolation(err)) {
          const winner = await this.prisma.endCustomer.findFirst({
            where: { crmClientId, OR: [{ whatsappJid: jid }, { phone: { in: phones } }] },
            orderBy: { createdAt: "asc" }
          });
          if (winner) return winner;
        }
        throw err;
      }
    }

    // Auto-merge any stale duplicates into the oldest record
    if (matches.length > 1) {
      for (const dupe of matches.slice(1)) {
        await this.mergeCustomers(matches[0].id, dupe.id);
        this.logger.log(`auto-merged duplicate endCustomer id=${dupe.id} into id=${matches[0].id}`);
      }
      // Reload primary in case mergeCustomers backfilled fields
      matches[0] = await this.prisma.endCustomer.findUniqueOrThrow({ where: { id: matches[0].id } });
    }

    let customer = matches[0];

    // Backfill/fix identity fields as we learn them
    const fix: { whatsappJid?: string; phone?: string } = {};
    if (!customer.whatsappJid) fix.whatsappJid = jid;
    if (realPhone && customer.phone !== realPhone && customer.phone === jidDigits) fix.phone = realPhone;
    if (Object.keys(fix).length > 0) {
      try {
        customer = await this.prisma.endCustomer.update({ where: { id: customer.id }, data: fix });
        this.logger.log(`customer identity updated id=${customer.id} ${JSON.stringify(fix)}`);
      } catch (err) {
        // Backfill colidiu com outro registro que já tem esse phone/jid — é o
        // mesmo lead sob duas identidades (@lid vs número real). Mescla eles.
        if (this.isUniqueViolation(err)) {
          const other = await this.prisma.endCustomer.findFirst({
            where: {
              crmClientId,
              id: { not: customer.id },
              OR: [...(fix.phone ? [{ phone: fix.phone }] : []), ...(fix.whatsappJid ? [{ whatsappJid: fix.whatsappJid }] : [])]
            },
            orderBy: { createdAt: "asc" }
          });
          if (other) {
            // Mantém o mais antigo como primário
            const [primary, dupe] = customer.createdAt <= other.createdAt ? [customer, other] : [other, customer];
            await this.mergeCustomers(primary.id, dupe.id);
            this.logger.log(`merged on identity collision primary=${primary.id} dupe=${dupe.id}`);
            return this.prisma.endCustomer.findUniqueOrThrow({ where: { id: primary.id } });
          }
        }
        throw err;
      }
    }
    return customer;
  }

  /** Detecta violação de constraint única do Prisma (P2002). */
  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  }

  /**
   * Merges `dupeId` into `primaryId`: moves all conversations, tasks, and
   * scheduled messages to the primary, copies missing labels, backfills any
   * missing identity fields on the primary, then deletes the duplicate.
   */
  async mergeCustomers(primaryId: string, dupeId: string): Promise<void> {
    const [primary, dupe] = await Promise.all([
      this.prisma.endCustomer.findUnique({ where: { id: primaryId } }),
      this.prisma.endCustomer.findUnique({ where: { id: dupeId } })
    ]);
    if (!primary || !dupe) return;

    const [primaryLabels, dupeLabels] = await Promise.all([
      this.prisma.endCustomerLabel.findMany({ where: { endCustomerId: primaryId } }),
      this.prisma.endCustomerLabel.findMany({ where: { endCustomerId: dupeId } })
    ]);
    const primaryLabelIds = new Set(primaryLabels.map((l) => l.labelId));
    const newLabels = dupeLabels.filter((l) => !primaryLabelIds.has(l.labelId));

    const backfill: Record<string, string> = {};
    if (!primary.whatsappJid && dupe.whatsappJid) backfill.whatsappJid = dupe.whatsappJid;
    if (!primary.phone && dupe.phone) backfill.phone = dupe.phone;
    if (!primary.email && dupe.email) backfill.email = dupe.email;
    if (!primary.companyName && dupe.companyName) backfill.companyName = dupe.companyName;

    try {
      await this.prisma.$transaction([
        this.prisma.conversation.updateMany({ where: { endCustomerId: dupeId }, data: { endCustomerId: primaryId } }),
        this.prisma.task.updateMany({ where: { endCustomerId: dupeId }, data: { endCustomerId: primaryId } }),
        this.prisma.scheduledMessage.updateMany({ where: { endCustomerId: dupeId }, data: { endCustomerId: primaryId } }),
        ...newLabels.map((l) => this.prisma.endCustomerLabel.create({ data: { endCustomerId: primaryId, labelId: l.labelId } })),
        ...(Object.keys(backfill).length ? [this.prisma.endCustomer.update({ where: { id: primaryId }, data: backfill })] : []),
        this.prisma.endCustomer.delete({ where: { id: dupeId } })
      ]);
    } catch (err) {
      this.logger.error(`mergeCustomers transaction falhou primary=${primaryId} dupe=${dupeId}: ${String(err)}`);
      throw err;
    }

    // Após mover as conversas do duplicado, o cliente pode ficar com vários
    // chats abertos do mesmo canal — junta num só pra não duplicar no inbox.
    await this.consolidateWhatsappConversations(primaryId);
  }

  /**
   * Junta as conversas de WhatsApp não-fechadas de um cliente numa única thread
   * (a mais antiga). Move as mensagens, soma os não-lidos e remove as extras.
   * Conversas fechadas ficam intactas (histórico).
   */
  private async consolidateWhatsappConversations(customerId: string): Promise<void> {
    const convs = await this.prisma.conversation.findMany({
      where: { endCustomerId: customerId, channelType: "whatsapp", status: { not: "closed" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, unreadCount: true, lastMessageAt: true, lastMessagePreview: true }
    });
    if (convs.length <= 1) return;

    const target = convs[0];
    const extras = convs.slice(1);
    const totalUnread = convs.reduce((sum, c) => sum + c.unreadCount, 0);
    const latest = convs.reduce((a, b) => (b.lastMessageAt > a.lastMessageAt ? b : a));

    try {
      await this.prisma.$transaction([
        ...extras.map((c) =>
          this.prisma.message.updateMany({ where: { conversationId: c.id }, data: { conversationId: target.id } })
        ),
        ...extras.map((c) =>
          this.prisma.scheduledMessage.updateMany({ where: { conversationId: c.id }, data: { conversationId: target.id } })
        ),
        this.prisma.conversation.update({
          where: { id: target.id },
          data: { unreadCount: totalUnread, lastMessageAt: latest.lastMessageAt, lastMessagePreview: latest.lastMessagePreview }
        }),
        this.prisma.conversation.deleteMany({ where: { id: { in: extras.map((c) => c.id) } } })
      ]);
    } catch (err) {
      this.logger.error(`consolidate transaction falhou customer=${customerId}: ${String(err)}`);
      throw err;
    }
    this.logger.log(`consolidated ${extras.length} whatsapp conversations into ${target.id} for customer=${customerId}`);
  }

  /**
   * Define a origem do lead automaticamente na 1ª mensagem:
   * 1) anúncio Click-to-WhatsApp (externalAdReply) → cria/usa a origem da plataforma;
   * 2) senão, casa o texto contra o `code` das origens cadastradas (link rastreável).
   * Não sobrescreve origem já definida.
   */
  private async detectAndSetSource(crmClientId: string, customerId: string, message: EvoMessageContent | undefined, text: string): Promise<void> {
    const ad = detectAdReferral(message);
    if (ad) {
      const name = classifyAdSource(ad);
      const source = await this.prisma.leadSource.upsert({
        where: { crmClientId_name: { crmClientId, name } },
        create: { crmClientId, name, color: "#d62976" },
        update: {}
      });
      await this.prisma.endCustomer.update({
        where: { id: customerId },
        data: { leadSourceId: source.id, sourceUrl: ad.sourceUrl ?? null, sourceRef: ad.title ?? ad.sourceId ?? null }
      });
      this.logger.log(`origem auto (anúncio) customerId=${customerId} source=${name} url=${ad.sourceUrl ?? "-"}`);
      return;
    }

    // Link rastreável: procura uma origem cujo code apareça no texto da mensagem
    const lower = (text ?? "").toLowerCase();
    if (!lower.trim()) return;
    const sources = await this.prisma.leadSource.findMany({
      where: { crmClientId, isActive: true, code: { not: null } },
      select: { id: true, name: true, code: true }
    });
    const match = sources.find((s) => s.code && lower.includes(s.code.toLowerCase()));
    if (match) {
      await this.prisma.endCustomer.update({ where: { id: customerId }, data: { leadSourceId: match.id } });
      this.logger.log(`origem auto (link) customerId=${customerId} source=${match.name} code=${match.code}`);
    }
  }

  private async storePhoneSentMessage(
    instance: string,
    key: EvoMessageUpsert["data"]["key"],
    waMessageId: string,
    text: string,
    message: EvoMessageContent | undefined,
    senderName?: string
  ): Promise<void> {
    const setting = await this.prisma.setting.findFirst({
      where: { key: "wa_instance_name", value: instance }
    });
    if (!setting) return;
    const crmClientId = setting.crmClientId;

    const customer = await this.resolveCustomer(crmClientId, key, undefined, false);
    if (!customer) return;

    const conv = await this.prisma.conversation.findFirst({
      where: { crmClientId, endCustomerId: customer.id, channelType: "whatsapp", status: { not: "closed" } },
      orderBy: { lastMessageAt: "desc" }
    });
    if (!conv) return;

    const mediaType = detectMediaType(message);
    const now = new Date();

    // Igual ao inbound: baixa antes de criar pra a mensagem não nascer quebrada.
    let mediaUrl: string | null = null;
    if (mediaType && waMessageId) {
      const media = await this.whatsapp.getMediaBase64(instance, waMessageId, detectMimetype(message));
      if (media) mediaUrl = `data:${media.mimetype};base64,${media.base64}`;
      else this.logger.warn(`${mediaType} phone-sent sem base64 waMessageId=${waMessageId}`);
    }

    let createdId: string;
    try {
      const created = await this.prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: "agent",
          senderName: senderName ?? "Agente",
          body: text,
          mediaType: mediaType ?? null,
          mediaUrl,
          sentAt: now,
          waMessageId
        }
      });
      createdId = created.id;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        this.logger.log(`duplicate phone-sent webhook ignored waMessageId=${waMessageId}`);
        return;
      }
      throw err;
    }

    if (mediaUrl) {
      this.logger.log(`${mediaType} phone-sent salvo msgId=${createdId}`);
    }

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessagePreview: text.slice(0, 100), lastMessageAt: now, status: "waiting_customer" }
    });
    this.logger.log(`phone-sent agent message stored waMessageId=${waMessageId} convId=${conv.id}`);
  }
}
