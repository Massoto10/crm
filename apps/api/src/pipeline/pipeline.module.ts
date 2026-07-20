import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PipelineStageService } from "./pipeline-stage.service";

@Module({
  imports: [PrismaModule],
  providers: [PipelineStageService],
  exports: [PipelineStageService]
})
export class PipelineModule {}
