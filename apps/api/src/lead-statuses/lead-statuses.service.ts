import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LeadStatusesService {
  private readonly logger = new Logger(LeadStatusesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    this.logger.log(`findAll lead-statuses crmClientId=${crmClientId}`);
    return this.prisma.leadStatus.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { order: "asc" }
    });
  }

  create(data: { crmClientId: string; name: string; color: string; order?: number }) {
    this.logger.log(`create lead-status crmClientId=${data.crmClientId} name=${data.name}`);
    return this.prisma.leadStatus.create({ data });
  }

  async update(id: string, data: { name?: string; color?: string; order?: number; isActive?: boolean }) {
    assertFound(await this.prisma.leadStatus.findUnique({ where: { id } }), "Status de lead");
    const result = await this.prisma.leadStatus.update({ where: { id }, data });
    this.logger.log(`updated lead-status id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.leadStatus.findUnique({ where: { id } }), "Status de lead");
    const result = await this.prisma.leadStatus.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted lead-status id=${id}`);
    return result;
  }
}
