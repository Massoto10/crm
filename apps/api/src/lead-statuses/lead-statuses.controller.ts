import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { LeadStatusesService } from "./lead-statuses.service";
import { CreateLeadStatusDto } from "./dto/create-lead-status.dto";
import { UpdateLeadStatusDto } from "./dto/update-lead-status.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("lead-statuses")
export class LeadStatusesController {
  constructor(private readonly leadStatusesService: LeadStatusesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.leadStatusesService.findAll(user.crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateLeadStatusDto) {
    return this.leadStatusesService.create({ ...body, crmClientId: user.crmClientId });
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdateLeadStatusDto) {
    return this.leadStatusesService.update(id, body, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leadStatusesService.remove(id, user.crmClientId);
  }
}
