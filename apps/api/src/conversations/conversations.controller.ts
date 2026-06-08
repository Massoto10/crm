import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ChannelType } from "@prisma/client";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll(@Query("channel") channel?: ChannelType) {
    return this.conversationsService.findAll(channel);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.conversationsService.findOne(id);
  }

  @Post(":id/messages")
  createMessage(@Param("id") id: string, @Body() body: { text: string; senderName?: string }) {
    return this.conversationsService.createAgentMessage(id, body.text, body.senderName ?? "Agente");
  }
}
