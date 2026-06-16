import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ScheduledMessageStatus } from "@prisma/client";
import { ScheduledMessagesService } from "./scheduled-messages.service";
import { CreateScheduledMessageDto } from "./dto/create-scheduled-message.dto";
import { BulkScheduledMessageDto } from "./dto/bulk-scheduled-message.dto";
import { ProcessSecretGuard } from "../common/guards/process-secret.guard";
import { CurrentUser, JwtPayload, Public, RequireView } from "../auth/decorators";

@Controller("scheduled-messages")
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Get()
  @RequireView("scheduling")
  findAll(@Query("crmClientId") crmClientId: string, @Query("status") status?: ScheduledMessageStatus) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.scheduledMessagesService.findAll(crmClientId, status);
  }

  @Post()
  @RequireView("scheduling")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateScheduledMessageDto) {
    return this.scheduledMessagesService.create({ ...body, crmClientId: user.crmClientId });
  }

  @Post("bulk")
  @RequireView("scheduling")
  createBulk(@CurrentUser() user: JwtPayload, @Body() body: BulkScheduledMessageDto) {
    return this.scheduledMessagesService.createBulk({
      crmClientId: user.crmClientId,
      endCustomerIds: body.endCustomerIds,
      channelType: body.channelType,
      agentId: body.agentId,
      body: body.body,
      scheduledAt: body.scheduledAt
    });
  }

  @Delete(":id")
  @RequireView("scheduling")
  cancel(@Param("id") id: string) {
    return this.scheduledMessagesService.cancel(id);
  }

  // Disparo externo (cron). @Public para escapar do JwtAuthGuard global; protegido
  // pelo x-process-secret (ProcessSecretGuard). Sem @Public o JWT bloquearia antes.
  @Public()
  @Post("process")
  @UseGuards(ProcessSecretGuard)
  process() {
    return this.scheduledMessagesService.processDue();
  }
}
