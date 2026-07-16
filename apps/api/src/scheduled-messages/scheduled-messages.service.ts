import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ChannelType, Prisma, ScheduledMessageStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

const PROCESS_INTERVAL_MS = 60_000;
const PROCESSING_LEASE_MS = 5 * 60_000;

type DueMessage = Prisma.ScheduledMessageGetPayload<{
  include: { conversation: { include: { endCustomer: true } } };
}>;

@Injectable()
export class ScheduledMessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledMessagesService.name);
  private processTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly whatsapp: WhatsappService) {}

  onModuleInit() {
    this.processTimer = setInterval(() => {
      this.processDue().catch((err) => this.logger.error(`processDue tick failed: ${String(err)}`));
    }, PROCESS_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.processTimer) clearInterval(this.processTimer);
  }

  findAll(crmClientId: string, status?: ScheduledMessageStatus, agentId?: string) {
    return this.prisma.scheduledMessage.findMany({
      where: { crmClientId, ...(status ? { status } : {}), ...(agentId ? { agentId } : {}) },
      orderBy: { scheduledAt: "asc" },
      include: { conversation: { include: { endCustomer: true } }, endCustomer: true }
    });
  }

  private parseFutureDate(value: string) {
    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException("Agendamento deve estar no futuro");
    }
    return scheduledAt;
  }

  private async assertAgentInTenant(agentId: string | undefined, crmClientId: string) {
    if (!agentId) return;
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, crmClientId, isActive: true } });
    if (!agent) throw new NotFoundException("Agente não encontrado");
  }

  private async assertConversationInTenant(conversationId: string, crmClientId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, crmClientId },
      select: { id: true, endCustomerId: true, channelType: true }
    });
    if (!conversation) throw new NotFoundException("Conversa não encontrada");
    if (conversation.channelType !== "whatsapp") {
      throw new BadRequestException("Agendamentos só estão disponíveis para WhatsApp");
    }
    return conversation;
  }

  async create(data: {
    crmClientId: string; conversationId?: string; endCustomerId?: string; agentId?: string; body: string; scheduledAt: string;
  }) {
    const body = data.body.trim();
    if (!body) throw new BadRequestException("Mensagem é obrigatória");
    if (!data.conversationId) throw new BadRequestException("Conversa é obrigatória");
    const [scheduledAt, conversation] = await Promise.all([
      Promise.resolve(this.parseFutureDate(data.scheduledAt)),
      this.assertConversationInTenant(data.conversationId, data.crmClientId),
      this.assertAgentInTenant(data.agentId, data.crmClientId)
    ]);
    if (data.endCustomerId && data.endCustomerId !== conversation.endCustomerId) {
      throw new BadRequestException("Contato não pertence à conversa");
    }
    return this.prisma.scheduledMessage.create({
      data: {
        crmClientId: data.crmClientId,
        conversationId: conversation.id,
        endCustomerId: conversation.endCustomerId,
        agentId: data.agentId,
        body,
        scheduledAt
      }
    });
  }

  async createBulk(data: {
    crmClientId: string; endCustomerIds: string[]; channelType: ChannelType; agentId?: string; body: string; scheduledAt: string;
  }) {
    if (data.channelType !== "whatsapp") throw new BadRequestException("Agendamentos só estão disponíveis para WhatsApp");
    const body = data.body.trim();
    if (!body) throw new BadRequestException("Mensagem é obrigatória");
    const scheduledAt = this.parseFutureDate(data.scheduledAt);
    await this.assertAgentInTenant(data.agentId, data.crmClientId);

    const ids = [...new Set(data.endCustomerIds)];
    let scheduled = 0;
    let skipped = 0;
    for (const endCustomerId of ids) {
      try {
        const customer = await this.prisma.endCustomer.findFirst({ where: { id: endCustomerId, crmClientId: data.crmClientId }, select: { id: true } });
        if (!customer) {
          skipped++;
          continue;
        }
        const conversationId = await this.resolveBulkConversation(data.crmClientId, endCustomerId, data.channelType);
        await this.prisma.scheduledMessage.create({
          data: { crmClientId: data.crmClientId, conversationId, endCustomerId, agentId: data.agentId, body, scheduledAt }
        });
        scheduled++;
      } catch (err) {
        this.logger.error(`createBulk failed endCustomerId=${endCustomerId}: ${String(err)}`);
        skipped++;
      }
    }
    return { scheduled, requested: ids.length, skipped };
  }

  private async resolveBulkConversation(crmClientId: string, endCustomerId: string, channelType: ChannelType): Promise<string> {
    const existing = await this.prisma.conversation.findFirst({
      where: { crmClientId, endCustomerId, channelType, status: { not: "closed" } },
      orderBy: { lastMessageAt: "desc" }, select: { id: true }
    });
    if (existing) return existing.id;
    const created = await this.prisma.conversation.create({
      data: {
        crmClientId, endCustomerId, channelType, status: "pending", stage: "Primeiro contato", slaStatus: "on_time",
        lastMessagePreview: "Mensagem agendada", lastMessageAt: new Date()
      },
      select: { id: true }
    });
    return created.id;
  }

  async cancel(id: string, crmClientId: string, agentId?: string) {
    const result = await this.prisma.scheduledMessage.updateMany({
      where: { id, crmClientId, status: "pending", ...(agentId ? { agentId } : {}) },
      data: { status: "canceled", processingAt: null }
    });
    if (!result.count) throw new NotFoundException("Agendamento pendente não encontrado");
    return { ok: true };
  }

  async processDue() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const candidates = await this.prisma.scheduledMessage.findMany({
      where: {
        OR: [
          { status: "pending", scheduledAt: { lte: now } },
          { status: "processing", processingAt: { lt: staleBefore } }
        ]
      },
      select: { id: true, status: true }
    });

    const claimedIds: string[] = [];
    for (const candidate of candidates) {
      const where: Prisma.ScheduledMessageWhereInput = candidate.status === "pending"
        ? { id: candidate.id, status: "pending", scheduledAt: { lte: now } }
        : { id: candidate.id, status: "processing", processingAt: { lt: staleBefore } };
      const claim = await this.prisma.scheduledMessage.updateMany({
        where,
        data: { status: "processing", processingAt: now }
      });
      if (claim.count) claimedIds.push(candidate.id);
    }
    if (!claimedIds.length) return { processed: 0, errors: 0 };

    const due = await this.prisma.scheduledMessage.findMany({
      where: { id: { in: claimedIds }, status: "processing" },
      include: { conversation: { include: { endCustomer: true } } }
    });
    const results = await Promise.allSettled(due.map((message) => this.deliver(message)));
    const errors = results.filter((result) => result.status === "rejected").length;
    return { processed: due.length, errors };
  }

  private async deliver(scheduled: DueMessage) {
    try {
      if (!scheduled.conversationId || !scheduled.conversation?.endCustomer) {
        throw new Error("Agendamento sem conversa ou contato");
      }
      if (scheduled.conversation.channelType !== "whatsapp") {
        throw new Error("Canal de agendamento não suportado");
      }
      const customer = scheduled.conversation.endCustomer;
      const jid = customer.whatsappJid ?? null;
      const phone = customer.phone?.replace(/\D/g, "") ?? null;
      const lidDigits = jid?.endsWith("@lid") ? jid.replace(/@.+$/, "") : null;
      const target = lidDigits && phone === lidDigits ? jid : phone ?? jid;
      if (!target) throw new Error("Contato sem destino WhatsApp");

      const setting = await this.prisma.setting.findFirst({ where: { crmClientId: scheduled.crmClientId, key: "wa_instance_name" } });
      if (!setting) throw new Error("WhatsApp não conectado");
      const result = await this.whatsapp.sendText(setting.value, target, scheduled.body);
      const sentAt = new Date();
      await this.prisma.$transaction([
        this.prisma.message.create({
          data: {
            conversationId: scheduled.conversationId,
            senderType: "agent",
            senderName: "Agendado",
            body: scheduled.body,
            sentAt,
            waMessageId: result.messageId ?? undefined
          }
        }),
        this.prisma.conversation.update({
          where: { id: scheduled.conversationId },
          data: { lastMessagePreview: scheduled.body, lastMessageAt: sentAt, unreadCount: 0, status: "waiting_customer" }
        }),
        this.prisma.scheduledMessage.update({
          where: { id: scheduled.id },
          data: { status: "sent", sentAt, processingAt: null }
        })
      ]);
    } catch (err) {
      await this.prisma.scheduledMessage.updateMany({
        where: { id: scheduled.id, status: "processing" },
        data: { status: "failed", processingAt: null }
      });
      this.logger.error(`scheduled delivery failed id=${scheduled.id}: ${String(err)}`);
      throw err;
    }
  }
}
