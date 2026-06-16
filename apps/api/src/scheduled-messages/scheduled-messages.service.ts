import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ChannelType, ScheduledMessageStatus } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

const PROCESS_INTERVAL_MS = 60_000;

@Injectable()
export class ScheduledMessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledMessagesService.name);
  private processTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService
  ) {}

  // Processa mensagens agendadas a cada minuto — sem isso elas nunca seriam enviadas
  onModuleInit() {
    this.processTimer = setInterval(() => {
      this.processDue().catch((err) => this.logger.error(`processDue tick failed: ${err}`));
    }, PROCESS_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.processTimer) clearInterval(this.processTimer);
  }

  findAll(crmClientId: string, status?: ScheduledMessageStatus) {
    this.logger.log(`findAll scheduled-messages crmClientId=${crmClientId}${status ? ` status=${status}` : ""}`);
    return this.prisma.scheduledMessage.findMany({
      where: { crmClientId, ...(status ? { status } : {}) },
      orderBy: { scheduledAt: "asc" },
      include: {
        conversation: { include: { endCustomer: true } },
        endCustomer: true
      }
    });
  }

  create(data: {
    crmClientId: string;
    conversationId?: string;
    endCustomerId?: string;
    agentId?: string;
    body: string;
    scheduledAt: string;
  }) {
    this.logger.log(`create scheduled-message crmClientId=${data.crmClientId} scheduledAt=${data.scheduledAt}`);
    return this.prisma.scheduledMessage.create({
      data: { ...data, scheduledAt: new Date(data.scheduledAt) }
    });
  }

  // Agenda a mesma mensagem para vários clientes. Para cada cliente garante uma
  // conversa (reusa a aberta ou cria pendente) — o processDue exige conversationId.
  async createBulk(data: {
    crmClientId: string;
    endCustomerIds: string[];
    channelType: ChannelType;
    agentId?: string;
    body: string;
    scheduledAt: string;
  }) {
    const scheduledAt = new Date(data.scheduledAt);
    const ids = [...new Set(data.endCustomerIds)];
    let scheduled = 0;
    let skipped = 0;

    this.logger.log(`createBulk start crmClientId=${data.crmClientId} targets=${ids.length} channel=${data.channelType}`);

    for (const endCustomerId of ids) {
      try {
        const customer = await this.prisma.endCustomer.findUnique({
          where: { id: endCustomerId },
          select: { id: true, crmClientId: true }
        });
        if (!customer || customer.crmClientId !== data.crmClientId) {
          this.logger.warn(`createBulk skip endCustomerId=${endCustomerId}: nao pertence ao crmClient ou inexistente`);
          skipped++;
          continue;
        }

        const conversationId = await this.resolveBulkConversation(data.crmClientId, endCustomerId, data.channelType);

        await this.prisma.scheduledMessage.create({
          data: { crmClientId: data.crmClientId, conversationId, endCustomerId, agentId: data.agentId, body: data.body, scheduledAt }
        });
        scheduled++;
      } catch (err) {
        this.logger.error(`createBulk falhou endCustomerId=${endCustomerId}: ${String(err)}`);
        skipped++;
      }
    }

    this.logger.log(`createBulk done crmClientId=${data.crmClientId} scheduled=${scheduled} skipped=${skipped}/${ids.length}`);
    return { scheduled, requested: ids.length };
  }

  // Reusa a conversa não-fechada do cliente ou cria uma pendente. Trata corrida:
  // se um create paralelo criar a conversa ao mesmo tempo, re-busca em vez de duplicar.
  private async resolveBulkConversation(crmClientId: string, endCustomerId: string, channelType: ChannelType): Promise<string> {
    const existing = await this.prisma.conversation.findFirst({
      where: { crmClientId, endCustomerId, channelType, status: { not: "closed" } },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true }
    });
    if (existing) return existing.id;

    try {
      const created = await this.prisma.conversation.create({
        data: {
          crmClientId, endCustomerId, channelType,
          status: "pending", stage: "Primeiro contato", slaStatus: "on_time",
          lastMessagePreview: "Mensagem agendada", lastMessageAt: new Date()
        },
        select: { id: true }
      });
      return created.id;
    } catch (err) {
      // Corrida: outro request criou a conversa em paralelo — re-busca em vez de duplicar.
      this.logger.warn(`resolveBulkConversation corrida endCustomerId=${endCustomerId}, re-buscando: ${String(err)}`);
      const winner = await this.prisma.conversation.findFirst({
        where: { crmClientId, endCustomerId, channelType, status: { not: "closed" } },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true }
      });
      if (winner) return winner.id;
      throw err;
    }
  }

  async cancel(id: string) {
    assertFound(await this.prisma.scheduledMessage.findUnique({ where: { id } }), "Mensagem agendada");
    const result = await this.prisma.scheduledMessage.update({ where: { id }, data: { status: "canceled" } });
    this.logger.log(`canceled scheduled-message id=${id}`);
    return result;
  }

  async processDue() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: { status: "pending", scheduledAt: { lte: new Date() } },
      include: { conversation: { include: { endCustomer: true } } }
    });

    this.logger.log(`processDue found=${due.length} pending messages`);

    const results = await Promise.allSettled(
      due.map(async (sm) => {
        if (!sm.conversationId || !sm.conversation) return;
        const now = new Date();
        const message = await this.prisma.message.create({
          data: { conversationId: sm.conversationId, senderType: "agent", senderName: "Agendado", body: sm.body, sentAt: now }
        });
        await this.prisma.conversation.update({
          where: { id: sm.conversationId },
          data: { lastMessagePreview: sm.body, lastMessageAt: now, status: "waiting_customer" }
        });
        await this.prisma.scheduledMessage.update({ where: { id: sm.id }, data: { status: "sent", sentAt: now } });

        // Entrega real no WhatsApp — mesma regra de destino do envio manual:
        // prefere o telefone real; usa o jid @lid só quando o número real é desconhecido
        if (sm.conversation.channelType === "whatsapp") {
          const customer = sm.conversation.endCustomer;
          const jid = customer?.whatsappJid ?? null;
          const phone = customer?.phone?.replace(/\D/g, "") ?? null;
          const lidDigits = jid?.endsWith("@lid") ? jid.replace(/@.+$/, "") : null;
          const target = lidDigits && phone === lidDigits ? jid : phone ?? jid;
          if (target) {
            const setting = await this.prisma.setting.findFirst({
              where: { crmClientId: sm.crmClientId, key: "wa_instance_name" }
            });
            if (setting) {
              const { messageId: waMessageId } = await this.whatsapp.sendText(setting.value, target, sm.body).catch((err) => {
                this.logger.error(`scheduled whatsapp send failed id=${sm.id}: ${err}`);
                return { messageId: null, jid: null };
              });
              if (waMessageId) {
                await this.prisma.message.update({ where: { id: message.id }, data: { waMessageId } });
              }
            }
          }
        }

        this.logger.log(`sent scheduled-message id=${sm.id} convId=${sm.conversationId}`);
      })
    );

    const errors = results.filter((r) => r.status === "rejected");
    if (errors.length > 0) {
      errors.forEach((r) => {
        if (r.status === "rejected") this.logger.error(`processDue failed for a message: ${r.reason}`);
      });
    }

    return { processed: due.length, errors: errors.length };
  }
}
