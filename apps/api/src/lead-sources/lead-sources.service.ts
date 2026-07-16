import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LeadSourcesService {
  private readonly logger = new Logger(LeadSourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    return this.prisma.leadSource.findMany({ where: { crmClientId, isActive: true }, orderBy: { order: "asc" } });
  }

  create(data: { crmClientId: string; name: string; color: string; code?: string | null; order?: number }) {
    return this.prisma.leadSource.create({ data: { ...data, code: data.code?.trim() || null } });
  }

  async update(id: string, data: { name?: string; color?: string; code?: string | null; order?: number; isActive?: boolean }, crmClientId: string) {
    assertFound(await this.prisma.leadSource.findFirst({ where: { id, crmClientId } }), "Origem");
    return this.prisma.leadSource.update({
      where: { id }, data: { ...data, ...(data.code !== undefined ? { code: data.code?.trim() || null } : {}) }
    });
  }

  async remove(id: string, crmClientId: string) {
    assertFound(await this.prisma.leadSource.findFirst({ where: { id, crmClientId } }), "Origem");
    return this.prisma.leadSource.update({ where: { id }, data: { isActive: false } });
  }
}
