import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string) {
    this.logger.log(`findAll departments crmClientId=${crmClientId}`);
    return this.prisma.department.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { agents: true, conversations: true } } }
    });
  }

  create(crmClientId: string, name: string, permissions: object = {}) {
    this.logger.log(`create department crmClientId=${crmClientId} name=${name}`);
    return this.prisma.department.create({
      data: { crmClientId, name, permissions: permissions as Prisma.InputJsonValue }
    });
  }

  async update(id: string, data: { name?: string; permissions?: object; isActive?: boolean }) {
    assertFound(await this.prisma.department.findUnique({ where: { id } }), "Departamento");
    const { permissions, ...rest } = data;
    const result = await this.prisma.department.update({
      where: { id },
      data: { ...rest, ...(permissions !== undefined ? { permissions: permissions as Prisma.InputJsonValue } : {}) }
    });
    this.logger.log(`updated department id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.department.findUnique({ where: { id } }), "Departamento");
    const result = await this.prisma.department.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted department id=${id}`);
    return result;
  }
}
