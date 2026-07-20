import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ChannelType } from "@prisma/client";
import { CurrentUser, JwtPayload, RequireView, Roles } from "../auth/decorators";
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
    const scope = user.permissions?.scope ?? "own";
    const effectiveAgentId = user.role !== "admin" && scope === "own" ? user.sub : agentId;
    return this.conversationsService.findAll({ chatStatus, channel, departmentId, leadSourceId, agentId: effectiveAgentId, crmClientId: user.crmClientId });
  }

  @Get(":id")
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.conversationsService.findOne(id, user);
  }

  @Post("initiate")
  initiate(@CurrentUser() user: JwtPayload, @Body() body: InitiateConversationDto) {
    return this.conversationsService.initiate({ ...body, crmClientId: user.crmClientId, assignedAgentId: user.sub });
  }

  @Post(":id/read")
  markRead(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.conversationsService.markRead(id, user);
  }

  @Post(":id/messages")
  createMessage(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: CreateMessageDto) {
    return this.conversationsService.createAgentMessage(id, body.text, user.name || "Agente", user);
  }

  @Post(":id/audio")
  createAudio(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: SendAudioDto) {
    return this.conversationsService.createAgentAudio(id, body.audioBase64, body.mimetype ?? "audio/ogg", user.name || "Agente", user);
  }

  @Post(":id/media")
  createMedia(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: SendMediaDto) {
    return this.conversationsService.createAgentMedia(
      id,
      { base64: body.base64, mimetype: body.mimetype, mediatype: body.mediatype, fileName: body.fileName, caption: body.caption },
      user.name || "Agente",
      user
    );
  }

  @Put(":id/close")
  close(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.conversationsService.close(id, user);
  }

  @Put(":id/assign")
  assign(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: AssignAgentDto) {
    return this.conversationsService.assign(id, body.agentId, user);
  }

  @Put(":id/department")
  setDepartment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: SetDepartmentDto) {
    return this.conversationsService.setDepartment(id, body.departmentId, user);
  }

  @Delete("all")
  @Roles("admin")
  clearAll(@CurrentUser() user: JwtPayload, @Body() body: { confirm?: string }) {
    if (body?.confirm !== "confirmar") throw new BadRequestException('Digite "confirmar" para confirmar a exclusão');
    return this.conversationsService.clearAllChats(user.crmClientId);
  }
}
