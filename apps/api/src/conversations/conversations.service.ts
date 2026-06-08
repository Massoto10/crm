import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ChannelType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(channel?: ChannelType) {
    return this.prisma.conversation.findMany({
      where: channel ? { channelType: channel } : undefined,
      orderBy: { lastMessageAt: "desc" },
      include: {
        crmClient: true,
        endCustomer: {
          include: {
            labels: {
              include: { label: true }
            },
            tasks: true
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        crmClient: true,
        endCustomer: {
          include: {
            labels: {
              include: { label: true }
            },
            tasks: true
          }
        },
        messages: {
          orderBy: { sentAt: "asc" }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  async createAgentMessage(conversationId: string, text: string, senderName: string) {
    const body = text?.trim();
    if (!body) {
      throw new BadRequestException("Message body is required");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const sentAt = new Date();
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderType: "agent",
        senderName,
        body,
        sentAt
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessagePreview: body,
        lastMessageAt: sentAt,
        unreadCount: 0,
        status: "waiting_customer"
      }
    });

    return message;
  }
}
