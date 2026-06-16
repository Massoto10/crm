import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ChannelType } from "@prisma/client";
import { CurrentUser, JwtPayload, RequireView } from "../auth/decorators";
import { ConversationsService } from "./conversations.service";
import { InitiateConversationDto } from "./dto/initiate-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { SendAudioDto } from "./dto/send-audio.dto";
import { SendMediaDto } from "./dto/send-media.dto";
import { AssignAgentDto } from "./dto/assign-agent.dto";
import { SetDepartmentDto } from "./dto/set-department.dto";

@Controller("conversations")
@RequireView("chats")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("chatStatus") chatStatus?: "pending" | "active" | "closed",
    @Query("channel") channel?: ChannelType,
    @Query("departmentId") departmentId?: string,
    @Query("agentId") agentId?: string,
    @Query("leadSourceId") leadSourceId?: string
  ) {
    // Escopo: agente com permissão "own" só vê as próprias conversas; "all" vê todas
    // do filtro. Admin sempre vê todas.
    const scope = user.permissions?.scope ?? "own";
    const effectiveAgentId = user.role !== "admin" && scope === "own" ? user.sub : agentId;
    return this.conversationsService.findAll({
      chatStatus, channel, departmentId, leadSourceId,
      agentId: effectiveAgentId,
      crmClientId: user.crmClientId
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.conversationsService.findOne(id);
  }

  @Post("initiate")
  initiate(@CurrentUser() user: JwtPayload, @Body() body: InitiateConversationDto) {
    return this.conversationsService.initiate({
      ...body,
      crmClientId: user.crmClientId,
      firstMessage: body.firstMessage
    });
  }

  @Post(":id/messages")
  createMessage(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: CreateMessageDto) {
    return this.conversationsService.createAgentMessage(id, body.text, body.senderName ?? user.name ?? "Agente");
  }

  @Post(":id/audio")
  createAudio(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: SendAudioDto) {
    return this.conversationsService.createAgentAudio(id, body.audioBase64, body.mimetype ?? "audio/ogg", body.senderName ?? user.name ?? "Agente");
  }

  @Post(":id/media")
  createMedia(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: SendMediaDto) {
    return this.conversationsService.createAgentMedia(
      id,
      { base64: body.base64, mimetype: body.mimetype, mediatype: body.mediatype, fileName: body.fileName, caption: body.caption },
      body.senderName ?? user.name ?? "Agente"
    );
  }

  @Put(":id/close")
  close(@Param("id") id: string) {
    return this.conversationsService.close(id);
  }

  @Put(":id/assign")
  assign(@Param("id") id: string, @Body() body: AssignAgentDto) {
    return this.conversationsService.assign(id, body.agentId);
  }

  @Put(":id/department")
  setDepartment(@Param("id") id: string, @Body() body: SetDepartmentDto) {
    return this.conversationsService.setDepartment(id, body.departmentId);
  }
}
