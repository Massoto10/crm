import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ScheduledMessageStatus } from "@prisma/client";
import { ScheduledMessagesService } from "./scheduled-messages.service";
import { CreateScheduledMessageDto } from "./dto/create-scheduled-message.dto";
import { BulkScheduledMessageDto } from "./dto/bulk-scheduled-message.dto";
import { ProcessSecretGuard } from "../common/guards/process-secret.guard";
import { CurrentUser, JwtPayload, Public, RequireView } from "../auth/decorators";

@Controller("scheduled-messages")
@RequireView("scheduling")
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query("status") status?: ScheduledMessageStatus) {
    const ownOnly = user.role !== "admin" && (user.permissions?.scope ?? "own") === "own";
    return this.scheduledMessagesService.findAll(user.crmClientId, status, ownOnly ? user.sub : undefined);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateScheduledMessageDto) {
    return this.scheduledMessagesService.create({ ...body, crmClientId: user.crmClientId, agentId: user.sub });
  }

  @Post("bulk")
  createBulk(@CurrentUser() user: JwtPayload, @Body() body: BulkScheduledMessageDto) {
    return this.scheduledMessagesService.createBulk({
      crmClientId: user.crmClientId,
      endCustomerIds: body.endCustomerIds,
      channelType: body.channelType,
      agentId: user.sub,
      body: body.body,
      scheduledAt: body.scheduledAt
    });
  }

  @Delete(":id")
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const ownOnly = user.role !== "admin" && (user.permissions?.scope ?? "own") === "own";
    return this.scheduledMessagesService.cancel(id, user.crmClientId, ownOnly ? user.sub : undefined);
  }

  @Public()
  @Post("process")
  @UseGuards(ProcessSecretGuard)
  process() {
    return this.scheduledMessagesService.processDue();
  }
}
