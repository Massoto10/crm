import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { AgentsService } from "./agents.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query("departmentId") departmentId?: string) {
    return this.agentsService.findAll(user.crmClientId, departmentId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateAgentDto) {
    return this.agentsService.create(user.crmClientId, body);
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdateAgentDto) {
    return this.agentsService.update(id, body, user.crmClientId);
  }

  @Post(":id/reset-password")
  @Roles("admin")
  resetPassword(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: { password?: string }) {
    return this.agentsService.resetPassword(id, body?.password, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.agentsService.remove(id, user.crmClientId);
  }
}
