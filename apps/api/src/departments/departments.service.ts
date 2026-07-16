import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    return this.prisma.department.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { agents: true, conversations: true } } }
    });
  }

  create(crmClientId: string, name: string, permissions: object = {}) {
    return this.prisma.department.create({
      data: { crmClientId, name, permissions: permissions as Prisma.InputJsonValue }
    });
  }

  async update(id: string, data: { name?: string; permissions?: object; isActive?: boolean }, crmClientId: string) {
    const department = await this.prisma.department.findFirst({ where: { id, crmClientId } });
    assertFound(department, "Departamento");
    const { permissions, ...rest } = data;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: { ...rest, ...(permissions !== undefined ? { permissions: permissions as Prisma.InputJsonValue } : {}) }
      });
      // Permission and membership changes must revoke tokens that embed permissions.
      await tx.agent.updateMany({ where: { departmentId: id }, data: { authVersion: { increment: 1 } } });
      return updated;
    });
    this.logger.log(`updated department id=${id}`);
    return result;
  }

  async remove(id: string, crmClientId: string) {
    const department = await this.prisma.department.findFirst({ where: { id, crmClientId } });
    assertFound(department, "Departamento");
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.department.update({ where: { id }, data: { isActive: false } });
      await tx.agent.updateMany({ where: { departmentId: id }, data: { authVersion: { increment: 1 } } });
      return result;
    });
  }
}
