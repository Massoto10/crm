import { Module } from "@nestjs/common";
import { PipelineStagesController } from "./pipeline-stages.controller";
import { PipelineStagesService } from "./pipeline-stages.service";

@Module({
  controllers: [PipelineStagesController],
  providers: [PipelineStagesService]
})
export class PipelineStagesModule {}
