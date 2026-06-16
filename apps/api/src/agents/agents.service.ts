import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string, departmentId?: string) {
    this.logger.log(`findAll agents crmClientId=${crmClientId}${departmentId ? ` dept=${departmentId}` : ""}`);
    return this.prisma.agent.findMany({
      where: { crmClientId, isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      include: { department: true }
    });
  }

  create(data: { crmClientId: string; name: string; email: string; role?: UserRole; departmentId?: string }) {
    this.logger.log(`create agent crmClientId=${data.crmClientId} email=${data.email}`);
    return this.prisma.agent.create({
      data: { crmClientId: data.crmClientId, name: data.name, email: data.email, role: data.role ?? "agent", departmentId: data.departmentId },
      include: { department: true }
    });
  }

  async update(id: string, data: { name?: string; email?: string; role?: UserRole; departmentId?: string | null; isActive?: boolean }) {
    assertFound(await this.prisma.agent.findUnique({ where: { id } }), "Agente");
    const result = await this.prisma.agent.update({ where: { id }, data, include: { department: true } });
    this.logger.log(`updated agent id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.agent.findUnique({ where: { id } }), "Agente");
    const result = await this.prisma.agent.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted agent id=${id}`);
    return result;
  }
}
