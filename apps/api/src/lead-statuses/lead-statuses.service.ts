import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LeadStatusesService {
  private readonly logger = new Logger(LeadStatusesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    return this.prisma.leadStatus.findMany({ where: { crmClientId, isActive: true }, orderBy: { order: "asc" } });
  }

  create(data: { crmClientId: string; name: string; color: string; order?: number }) {
    return this.prisma.leadStatus.create({ data });
  }

  async update(id: string, data: { name?: string; color?: string; order?: number; isActive?: boolean }, crmClientId: string) {
    assertFound(await this.prisma.leadStatus.findFirst({ where: { id, crmClientId } }), "Status de lead");
    return this.prisma.leadStatus.update({ where: { id }, data });
  }

  async remove(id: string, crmClientId: string) {
    assertFound(await this.prisma.leadStatus.findFirst({ where: { id, crmClientId } }), "Status de lead");
    return this.prisma.leadStatus.update({ where: { id }, data: { isActive: false } });
  }
}
