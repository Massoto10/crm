import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { LeadSourcesService } from "./lead-sources.service";
import { CreateLeadSourceDto } from "./dto/create-lead-source.dto";
import { UpdateLeadSourceDto } from "./dto/update-lead-source.dto";
import { Roles } from "../auth/decorators";

@Controller("lead-sources")
export class LeadSourcesController {
  constructor(private readonly leadSourcesService: LeadSourcesService) {}

  @Get()
  findAll(@Query("crmClientId") crmClientId: string) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.leadSourcesService.findAll(crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateLeadSourceDto) {
    return this.leadSourcesService.create(body);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdateLeadSourceDto) {
    return this.leadSourcesService.update(id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.leadSourcesService.remove(id);
  }
}
