import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { PipelineStagesService } from "./pipeline-stages.service";
import { CreatePipelineStageDto } from "./dto/create-pipeline-stage.dto";
import { UpdatePipelineStageDto } from "./dto/update-pipeline-stage.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("pipeline-stages")
export class PipelineStagesController {
  constructor(private readonly pipelineStagesService: PipelineStagesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.pipelineStagesService.findAll(user.crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreatePipelineStageDto) {
    return this.pipelineStagesService.create({ ...body, crmClientId: user.crmClientId });
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdatePipelineStageDto) {
    return this.pipelineStagesService.update(id, body, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.pipelineStagesService.remove(id, user.crmClientId);
  }
}
