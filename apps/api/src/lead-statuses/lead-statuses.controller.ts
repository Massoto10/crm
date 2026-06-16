import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { LeadStatusesService } from "./lead-statuses.service";
import { CreateLeadStatusDto } from "./dto/create-lead-status.dto";
import { UpdateLeadStatusDto } from "./dto/update-lead-status.dto";
import { Roles } from "../auth/decorators";

@Controller("lead-statuses")
export class LeadStatusesController {
  constructor(private readonly leadStatusesService: LeadStatusesService) {}

  @Get()
  findAll(@Query("crmClientId") crmClientId: string) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.leadStatusesService.findAll(crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateLeadStatusDto) {
    return this.leadStatusesService.create(body);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdateLeadStatusDto) {
    return this.leadStatusesService.update(id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.leadStatusesService.remove(id);
  }
}
