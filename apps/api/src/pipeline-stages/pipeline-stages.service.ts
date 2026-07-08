import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PipelineStagesService {
  private readonly logger = new Logger(PipelineStagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    this.logger.log(`findAll pipeline-stages crmClientId=${crmClientId}`);
    return this.prisma.pipelineStage.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { order: "asc" }
    });
  }

  create(data: { crmClientId: string; name: string; color: string; hint?: string; order?: number }) {
    this.logger.log(`create pipeline-stage crmClientId=${data.crmClientId} name=${data.name}`);
    return this.prisma.pipelineStage.create({ data: { ...data, hint: data.hint ?? "" } });
  }

  async update(id: string, data: { name?: string; color?: string; hint?: string; order?: number; isActive?: boolean }) {
    assertFound(await this.prisma.pipelineStage.findUnique({ where: { id } }), "Etapa");
    const result = await this.prisma.pipelineStage.update({ where: { id }, data });
    this.logger.log(`updated pipeline-stage id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.pipelineStage.findUnique({ where: { id } }), "Etapa");
    // Solta os clientes dessa etapa antes de desativá-la (vão pro fallback da 1ª coluna no board).
    await this.prisma.endCustomer.updateMany({ where: { pipelineStageId: id }, data: { pipelineStageId: null } });
    const result = await this.prisma.pipelineStage.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted pipeline-stage id=${id}`);
    return result;
  }
}
