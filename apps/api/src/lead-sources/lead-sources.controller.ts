import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { LeadSourcesService } from "./lead-sources.service";
import { CreateLeadSourceDto } from "./dto/create-lead-source.dto";
import { UpdateLeadSourceDto } from "./dto/update-lead-source.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("lead-sources")
export class LeadSourcesController {
  constructor(private readonly leadSourcesService: LeadSourcesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.leadSourcesService.findAll(user.crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateLeadSourceDto) {
    return this.leadSourcesService.create({ ...body, crmClientId: user.crmClientId });
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdateLeadSourceDto) {
    return this.leadSourcesService.update(id, body, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leadSourcesService.remove(id, user.crmClientId);
  }
}
