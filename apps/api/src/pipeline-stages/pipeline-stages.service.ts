import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PipelineStagesService {
  private readonly logger = new Logger(PipelineStagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    return this.prisma.pipelineStage.findMany({ where: { crmClientId, isActive: true }, orderBy: { order: "asc" } });
  }

  create(data: { crmClientId: string; name: string; color: string; hint?: string; order?: number }) {
    return this.prisma.pipelineStage.create({ data: { ...data, hint: data.hint ?? "" } });
  }

  async update(id: string, data: { name?: string; color?: string; hint?: string; order?: number; isActive?: boolean }, crmClientId: string) {
    assertFound(await this.prisma.pipelineStage.findFirst({ where: { id, crmClientId } }), "Etapa");
    return this.prisma.pipelineStage.update({ where: { id }, data });
  }

  async remove(id: string, crmClientId: string) {
    assertFound(await this.prisma.pipelineStage.findFirst({ where: { id, crmClientId } }), "Etapa");
    return this.prisma.$transaction(async (tx) => {
      await tx.endCustomer.updateMany({ where: { pipelineStageId: id, crmClientId }, data: { pipelineStageId: null } });
      return tx.pipelineStage.update({ where: { id }, data: { isActive: false } });
    });
  }
}
