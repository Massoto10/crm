import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { AgentsService } from "./agents.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";
import { Roles } from "../auth/decorators";

@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@Query("crmClientId") crmClientId: string, @Query("departmentId") departmentId?: string) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.agentsService.findAll(crmClientId, departmentId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateAgentDto) {
    return this.agentsService.create(body);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdateAgentDto) {
    return this.agentsService.update(id, body);
  }

  @Post(":id/reset-password")
  @Roles("admin")
  resetPassword(@Param("id") id: string, @Body() body: { password?: string }) {
    return this.agentsService.resetPassword(id, body?.password);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.agentsService.remove(id);
  }
}
