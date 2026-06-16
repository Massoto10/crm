import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LeadSourcesService {
  private readonly logger = new Logger(LeadSourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    this.logger.log(`findAll lead-sources crmClientId=${crmClientId}`);
    return this.prisma.leadSource.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { order: "asc" }
    });
  }

  create(data: { crmClientId: string; name: string; color: string; code?: string | null; order?: number }) {
    this.logger.log(`create lead-source crmClientId=${data.crmClientId} name=${data.name}`);
    return this.prisma.leadSource.create({
      data: { ...data, code: data.code?.trim() || null }
    });
  }

  async update(id: string, data: { name?: string; color?: string; code?: string | null; order?: number; isActive?: boolean }) {
    assertFound(await this.prisma.leadSource.findUnique({ where: { id } }), "Origem");
    const result = await this.prisma.leadSource.update({
      where: { id },
      data: { ...data, ...(data.code !== undefined ? { code: data.code?.trim() || null } : {}) }
    });
    this.logger.log(`updated lead-source id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.leadSource.findUnique({ where: { id } }), "Origem");
    const result = await this.prisma.leadSource.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted lead-source id=${id}`);
    return result;
  }
}
