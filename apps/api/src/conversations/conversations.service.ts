import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ChannelType, ConversationStatus, Prisma } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { normalizeBrazilPhone } from "../common/phone";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";
import { InstagramService } from "../instagram/instagram.service";

type ChatStatusFilter = "pending" | "active" | "closed";

interface FindAllFilters {
  chatStatus?: ChatStatusFilter;
  channel?: ChannelType;
  departmentId?: string;
  agentId?: string;
  leadSourceId?: string;
  crmClientId?: string;
}

interface InitiateDto {
  crmClientId: string;
  endCustomerId?: string;
  phone?: string;
  customerName?: string;
  companyName?: string;
  email?: string;
  channelType: ChannelType;
  departmentId?: string;
  firstMessage?: string;
}

const convInclude = {
  crmClient: true,
  department: true,
  assignedAgent: { include: { department: true } },
  endCustomer: {
    include: {
      leadStatus: true,
      leadSource: true,
      labels: { include: { label: true } },
      tasks: true
    }
  }
} satisfies Prisma.ConversationInclude;

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly instagram: InstagramService
  ) {}

  findAll(filters: FindAllFilters = {}) {
    const where: Prisma.ConversationWhereInput = {};

    if (filters.chatStatus === "pending") {
      where.status = "pending";
    } else if (filters.chatStatus === "active") {
      where.status = { in: ["open", "waiting_customer", "waiting_agent"] };
    } else if (filters.chatStatus === "closed") {
      where.status = "closed";
    }

    if (filters.channel) where.channelType = filters.channel;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.agentId) where.assignedAgentId = filters.agentId;
    if (filters.crmClientId) where.crmClientId = filters.crmClientId;
    if (filters.leadSourceId) where.endCustomer = { leadSourceId: filters.leadSourceId };

    this.logger.log(`findAll filters=${JSON.stringify(filters)}`);
    return this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: convInclude
    });
  }

  async findOne(id: string) {
    this.logger.log(`findOne conversationId=${id}`);
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { ...convInclude, messages: { orderBy: { sentAt: "asc" } } }
    });
    if (!conv) throw new NotFoundException("Conversa não encontrada");
    return conv;
  }

  async createAgentMessage(conversationId: string, text: string, senderName: string) {
    const body = text?.trim();
    if (!body) throw new BadRequestException("Corpo da mensagem é obrigatório");

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, channelType: true, crmClientId: true, endCustomerId: true, endCustomer: { select: { phone: true, whatsappJid: true, instagramHandle: true } } }
    });
    assertFound(conv, "Conversa");

    const sentAt = new Date();
    const message = await this.prisma.message.create({
      data: { conversationId, senderType: "agent", senderName, body, sentAt }
    });

    const nextStatus: ConversationStatus =
      conv.status === "pending" ? "open" : "waiting_customer";

    await Promise.all([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessagePreview: body, lastMessageAt: sentAt, unreadCount: 0, status: nextStatus }
      }),
      this.prisma.endCustomer.update({
        where: { id: conv.endCustomerId },
        data: { lastContactAt: sentAt }
      })
    ]);

    this.logger.log(`message created convId=${conversationId} status=${nextStatus}`);

    // Fire-and-forget outbound delivery for WhatsApp conversations
    if (conv.channelType === "whatsapp") {
      const jid = conv.endCustomer?.whatsappJid ?? null;
      const phone = conv.endCustomer?.phone?.replace(/\D/g, "") ?? null;
      const lidDigits = jid?.endsWith("@lid") ? jid.replace(/@.+$/, "") : null;
      // Prefer real phone number; fall back to @lid jid when phone = lid digits (real number unknown)
      const target = lidDigits && phone === lidDigits ? jid : phone ?? jid;
      this.sendWhatsappOutbound(conv.crmClientId, target, body, message.id, conv.endCustomerId);
    } else if (conv.channelType === "instagram") {
      const handle = conv.endCustomer?.instagramHandle ?? null;
      if (handle) {
        // Fire-and-forget — stub até as credenciais Meta serem plugadas (ver InstagramService)
        this.instagram.sendText(handle, body).catch((err) => this.logger.error(`instagram outbound failed: ${err}`));
      } else {
        this.logger.warn(`instagram outbound skipped: sem instagramHandle convId=${conversationId}`);
      }
    }

    return message;
  }

  // Mensagem de áudio do agente: guarda o áudio como data URI (mediaUrl) e envia
  // pelo WhatsApp. Mesma transição de status que createAgentMessage.
  async createAgentAudio(conversationId: string, audioBase64: string, mimetype: string, senderName: string) {
    if (!audioBase64?.trim()) throw new BadRequestException("Áudio é obrigatório");

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, channelType: true, crmClientId: true, endCustomerId: true, endCustomer: { select: { phone: true, whatsappJid: true, instagramHandle: true } } }
    });
    assertFound(conv, "Conversa");

    const dataUri = audioBase64.startsWith("data:") ? audioBase64 : `data:${mimetype};base64,${audioBase64}`;
    const sentAt = new Date();
    const message = await this.prisma.message.create({
      data: { conversationId, senderType: "agent", senderName, body: "[Áudio]", mediaType: "audio", mediaUrl: dataUri, sentAt }
    });

    const nextStatus: ConversationStatus = conv.status === "pending" ? "open" : "waiting_customer";
    await Promise.all([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessagePreview: "🎤 Áudio", lastMessageAt: sentAt, unreadCount: 0, status: nextStatus }
      }),
      this.prisma.endCustomer.update({ where: { id: conv.endCustomerId }, data: { lastContactAt: sentAt } })
    ]);
    this.logger.log(`audio message created convId=${conversationId} status=${nextStatus}`);

    if (conv.channelType === "whatsapp") {
      const target = this.resolveWhatsappTarget(conv.endCustomer);
      this.sendWhatsappAudioOutbound(conv.crmClientId, target, dataUri, message.id);
    } else if (conv.channelType === "instagram") {
      this.logger.warn(`instagram audio outbound nao suportado ainda convId=${conversationId}`);
    }

    return message;
  }

  // Mensagem de mídia do agente (imagem/vídeo/documento): guarda como data URI e envia.
  async createAgentMedia(
    conversationId: string,
    opts: { base64: string; mimetype: string; mediatype: "image" | "video" | "document"; fileName?: string; caption?: string },
    senderName: string
  ) {
    if (!opts.base64?.trim()) throw new BadRequestException("Arquivo é obrigatório");

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, channelType: true, crmClientId: true, endCustomerId: true, endCustomer: { select: { phone: true, whatsappJid: true, instagramHandle: true } } }
    });
    assertFound(conv, "Conversa");

    const dataUri = opts.base64.startsWith("data:") ? opts.base64 : `data:${opts.mimetype};base64,${opts.base64}`;
    const label = opts.mediatype === "image" ? "[Imagem]" : opts.mediatype === "video" ? "[Vídeo]" : `[Documento] ${opts.fileName ?? ""}`.trim();
    const body = opts.caption?.trim() || label;
    const preview = opts.mediatype === "image" ? "📷 Imagem" : opts.mediatype === "video" ? "🎬 Vídeo" : "📎 Arquivo";

    const sentAt = new Date();
    const message = await this.prisma.message.create({
      data: { conversationId, senderType: "agent", senderName, body, mediaType: opts.mediatype, mediaUrl: dataUri, sentAt }
    });

    const nextStatus: ConversationStatus = conv.status === "pending" ? "open" : "waiting_customer";
    await Promise.all([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessagePreview: preview, lastMessageAt: sentAt, unreadCount: 0, status: nextStatus }
      }),
      this.prisma.endCustomer.update({ where: { id: conv.endCustomerId }, data: { lastContactAt: sentAt } })
    ]);
    this.logger.log(`media message created convId=${conversationId} type=${opts.mediatype} status=${nextStatus}`);

    if (conv.channelType === "whatsapp") {
      const target = this.resolveWhatsappTarget(conv.endCustomer);
      this.sendWhatsappMediaOutbound(conv.crmClientId, target, message.id, {
        mediatype: opts.mediatype, base64: dataUri, mimetype: opts.mimetype, fileName: opts.fileName, caption: opts.caption
      });
    } else if (conv.channelType === "instagram") {
      this.logger.warn(`instagram media outbound nao suportado ainda convId=${conversationId}`);
    }

    return message;
  }

  // Resolve o melhor alvo (telefone real ou @lid) para envio no WhatsApp.
  private resolveWhatsappTarget(endCustomer: { phone: string | null; whatsappJid: string | null } | null): string | null {
    const jid = endCustomer?.whatsappJid ?? null;
    const phone = endCustomer?.phone?.replace(/\D/g, "") ?? null;
    const lidDigits = jid?.endsWith("@lid") ? jid.replace(/@.+$/, "") : null;
    return lidDigits && phone === lidDigits ? jid : phone ?? jid;
  }

  async close(id: string) {
    assertFound(await this.prisma.conversation.findUnique({ where: { id }, select: { id: true } }), "Conversa");
    const result = await this.prisma.conversation.update({
      where: { id },
      data: { status: "closed", closedAt: new Date() }
    });
    this.logger.log(`conversation closed id=${id}`);
    return result;
  }

  async assign(id: string, agentId: string) {
    const [conv, agent] = await Promise.all([
      this.prisma.conversation.findUnique({ where: { id }, select: { id: true, status: true, crmClientId: true } }),
      this.prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, crmClientId: true } })
    ]);
    assertFound(conv, "Conversa");
    assertFound(agent, "Agente");
    if (agent.crmClientId !== conv.crmClientId) {
      throw new BadRequestException("Agente não pertence à mesma conta CRM da conversa");
    }
    const nextStatus = conv.status === "pending" ? "open" : conv.status;
    const result = await this.prisma.conversation.update({
      where: { id },
      data: { assignedAgentId: agentId, status: nextStatus }
    });
    this.logger.log(`conversation assigned id=${id} agentId=${agentId}`);
    return result;
  }

  async setDepartment(id: string, departmentId: string) {
    const [conv, dept] = await Promise.all([
      this.prisma.conversation.findUnique({ where: { id }, select: { id: true, crmClientId: true, assignedAgentId: true } }),
      this.prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, crmClientId: true } })
    ]);
    assertFound(conv, "Conversa");
    assertFound(dept, "Departamento");
    if (dept.crmClientId !== conv.crmClientId) {
      throw new BadRequestException("Departamento não pertence à mesma conta CRM da conversa");
    }

    // Handoff Venda → Pós-venda: a conversa fica atrelada ao mesmo atendente até
    // ser movida para o departamento de pós-venda. Nesse ponto o fluxo do vendedor
    // encerra — desatribui para a equipe de pós-venda assumir do zero.
    const settings = await this.getClientSettings(conv.crmClientId);
    const postSaleDeptId = settings["post_closure_department_id"];
    const isHandoff = !!postSaleDeptId && departmentId === postSaleDeptId && conv.assignedAgentId !== null;

    const result = await this.prisma.conversation.update({
      where: { id },
      data: { departmentId, ...(isHandoff ? { assignedAgentId: null } : {}) }
    });
    if (isHandoff) this.logger.log(`handoff to pós-venda convId=${id}: unassigned previous agent`);
    return result;
  }

  async initiate(dto: InitiateDto) {
    const { crmClientId, channelType, firstMessage } = dto;
    let { departmentId } = dto;

    // Normalize phone for WhatsApp to E.164-BR (55 + DDD + número) so it matches
    // what the webhook stores and is accepted by Evolution on outbound.
    const phone = dto.phone
      ? channelType === "whatsapp"
        ? normalizeBrazilPhone(dto.phone)
        : dto.phone
      : undefined;

    let customer = dto.endCustomerId
      ? await this.prisma.endCustomer.findUnique({ where: { id: dto.endCustomerId } })
      : phone
        ? await this.prisma.endCustomer.findFirst({ where: { crmClientId, phone } })
        : null;

    // Guard: endCustomerId must exist and belong to this org
    if (dto.endCustomerId && (!customer || customer.crmClientId !== crmClientId)) {
      throw new NotFoundException("Contato não encontrado");
    }

    if (customer) {
      const settings = await this.getClientSettings(crmClientId);
      const returnDays = parseInt(settings["post_closure_return_days"] ?? "15", 10);
      const returnDeptId = settings["post_closure_department_id"];

      if (returnDeptId) {
        const lastClosed = await this.prisma.conversation.findFirst({
          where: { endCustomerId: customer.id, status: "closed", closedAt: { not: null } },
          orderBy: { closedAt: "desc" }
        });

        if (lastClosed?.closedAt) {
          const daysSince = (Date.now() - lastClosed.closedAt.getTime()) / 86400000;
          if (daysSince <= returnDays) {
            departmentId = returnDeptId;
            this.logger.log(`post-closure return rule applied customerId=${customer.id} deptId=${returnDeptId}`);
          }
        }
      }

      await this.prisma.endCustomer.update({
        where: { id: customer.id },
        data: { lastContactAt: new Date() }
      });
    } else {
      if (!dto.customerName) throw new BadRequestException("Nome do cliente é obrigatório para novos contatos");
      customer = await this.prisma.endCustomer.create({
        data: {
          crmClientId,
          fullName: dto.customerName,
          phone: phone ?? null,
          companyName: dto.companyName ?? null,
          email: dto.email ?? null,
          originChannel: channelType,
          lifecycleStage: "new",
          leadTemperature: "cold",
          priority: "low"
        }
      });
    }

    const firstPreview = firstMessage?.trim() ?? "Nova conversa iniciada";
    const conv = await this.prisma.conversation.create({
      data: {
        crmClientId,
        endCustomerId: customer.id,
        channelType,
        status: "pending",
        stage: "Primeiro contato",
        slaStatus: "on_time",
        lastMessagePreview: firstPreview,
        lastMessageAt: new Date(),
        departmentId: departmentId ?? null
      },
      include: convInclude
    });

    this.logger.log(`conversation initiated id=${conv.id} crmClientId=${crmClientId}`);

    // Send first message — failure must not roll back the already-committed conversation
    if (firstMessage?.trim()) {
      try {
        await this.createAgentMessage(conv.id, firstMessage.trim(), "Agente");
      } catch (err) {
        this.logger.error(`firstMessage delivery failed convId=${conv.id}: ${String(err)}`);
      }
      // Re-fetch so the response carries the final status (pending → open) and preview,
      // letting the frontend open the conversation in the correct tab.
      const fresh = await this.prisma.conversation.findUnique({ where: { id: conv.id }, include: convInclude });
      if (fresh) return fresh;
    }

    return conv;
  }

  private sendWhatsappOutbound(
    crmClientId: string,
    phone: string | null | undefined,
    text: string,
    messageId: string,
    endCustomerId: string
  ): void {
    if (!phone) {
      this.logger.warn(`sendWhatsappOutbound skipped: no phone/jid for messageId=${messageId}`);
      return;
    }
    this.prisma.setting
      .findFirst({ where: { crmClientId, key: "wa_instance_name" } })
      .then(async (s) => {
        if (!s) {
          this.logger.warn(`sendWhatsappOutbound skipped: no wa_instance_name for crmClientId=${crmClientId}`);
          return;
        }
        this.logger.log(`sendWhatsappOutbound instance=${s.value} to=${phone}`);
        const { messageId: waMessageId, jid: resolvedJid } = await this.whatsapp.sendText(s.value, phone, text);
        if (!waMessageId) {
          this.logger.warn(`whatsapp outbound returned no messageId for to=${phone}`);
          return;
        }
        // Backfill whatsappJid on the customer when Evolution reveals the real JID
        // (crucial for LID accounts — prevents duplicate customers on reply)
        if (resolvedJid && resolvedJid !== phone) {
          const customer = await this.prisma.endCustomer.findUnique({
            where: { id: endCustomerId }, select: { whatsappJid: true }
          });
          if (customer && !customer.whatsappJid) {
            await this.prisma.endCustomer.update({
              where: { id: endCustomerId }, data: { whatsappJid: resolvedJid }
            }).catch(() => null); // ignore if another record already has this jid
            this.logger.log(`whatsappJid backfilled customerId=${endCustomerId} jid=${resolvedJid}`);
          }
        }
        try {
          await this.prisma.message.update({ where: { id: messageId }, data: { waMessageId } });
          this.logger.log(`whatsapp outbound ok waMessageId=${waMessageId}`);
        } catch (err: unknown) {
          // Corrida: o webhook fromMe do Evolution chegou primeiro e já gravou
          // esta mensagem com o mesmo waMessageId. Remove a duplicata local
          // (vazia) pra não aparecer a mesma mensagem duas vezes na thread.
          if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
            await this.prisma.message.delete({ where: { id: messageId } }).catch(() => null);
            this.logger.log(`removed local duplicate; webhook already stored waMessageId=${waMessageId}`);
          } else {
            throw err;
          }
        }
      })
      .catch((err: unknown) => this.logger.error(`whatsapp outbound failed to=${phone}: ${err}`));
  }

  // Envio fire-and-forget de áudio. Grava o waMessageId ou remove duplicata em corrida
  // com o webhook fromMe (mesmo padrão do texto).
  private sendWhatsappAudioOutbound(crmClientId: string, phone: string | null | undefined, audioDataUri: string, messageId: string): void {
    if (!phone) {
      this.logger.warn(`sendWhatsappAudioOutbound skipped: no phone/jid for messageId=${messageId}`);
      return;
    }
    this.prisma.setting
      .findFirst({ where: { crmClientId, key: "wa_instance_name" } })
      .then(async (s) => {
        if (!s) {
          this.logger.warn(`sendWhatsappAudioOutbound skipped: no wa_instance_name for crmClientId=${crmClientId}`);
          return;
        }
        this.logger.log(`sendWhatsappAudioOutbound instance=${s.value} to=${phone}`);
        const { messageId: waMessageId } = await this.whatsapp.sendAudio(s.value, phone, audioDataUri);
        if (!waMessageId) {
          this.logger.warn(`whatsapp audio outbound returned no messageId for to=${phone}`);
          return;
        }
        try {
          await this.prisma.message.update({ where: { id: messageId }, data: { waMessageId } });
          this.logger.log(`whatsapp audio outbound ok waMessageId=${waMessageId}`);
        } catch (err: unknown) {
          if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
            this.logger.log(`audio waMessageId duplicado (webhook chegou primeiro) waMessageId=${waMessageId}`);
          } else {
            throw err;
          }
        }
      })
      .catch((err: unknown) => this.logger.error(`whatsapp audio outbound failed to=${phone}: ${err}`));
  }

  // Envio fire-and-forget de mídia (imagem/vídeo/documento).
  private sendWhatsappMediaOutbound(
    crmClientId: string,
    phone: string | null | undefined,
    messageId: string,
    opts: { mediatype: "image" | "video" | "document"; base64: string; mimetype?: string; fileName?: string; caption?: string }
  ): void {
    if (!phone) {
      this.logger.warn(`sendWhatsappMediaOutbound skipped: no phone/jid for messageId=${messageId}`);
      return;
    }
    this.prisma.setting
      .findFirst({ where: { crmClientId, key: "wa_instance_name" } })
      .then(async (s) => {
        if (!s) {
          this.logger.warn(`sendWhatsappMediaOutbound skipped: no wa_instance_name for crmClientId=${crmClientId}`);
          return;
        }
        this.logger.log(`sendWhatsappMediaOutbound instance=${s.value} to=${phone} type=${opts.mediatype}`);
        const { messageId: waMessageId } = await this.whatsapp.sendMedia(s.value, phone, opts);
        if (!waMessageId) {
          this.logger.warn(`whatsapp media outbound returned no messageId for to=${phone}`);
          return;
        }
        try {
          await this.prisma.message.update({ where: { id: messageId }, data: { waMessageId } });
          this.logger.log(`whatsapp media outbound ok waMessageId=${waMessageId}`);
        } catch (err: unknown) {
          if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
            this.logger.log(`media waMessageId duplicado (webhook chegou primeiro) waMessageId=${waMessageId}`);
          } else {
            throw err;
          }
        }
      })
      .catch((err: unknown) => this.logger.error(`whatsapp media outbound failed to=${phone}: ${err}`));
  }

  private async getClientSettings(crmClientId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({ where: { crmClientId } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
