import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { PipelineStagesService } from "./pipeline-stages.service";
import { CreatePipelineStageDto } from "./dto/create-pipeline-stage.dto";
import { UpdatePipelineStageDto } from "./dto/update-pipeline-stage.dto";
import { Roles } from "../auth/decorators";

@Controller("pipeline-stages")
export class PipelineStagesController {
  constructor(private readonly pipelineStagesService: PipelineStagesService) {}

  @Get()
  findAll(@Query("crmClientId") crmClientId: string) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.pipelineStagesService.findAll(crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreatePipelineStageDto) {
    return this.pipelineStagesService.create(body);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdatePipelineStageDto) {
    return this.pipelineStagesService.update(id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.pipelineStagesService.remove(id);
  }
}
