import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QuickMessagesService {
  private readonly logger = new Logger(QuickMessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string, search?: string, departmentId?: string) {
    return this.prisma.quickMessage.findMany({
      where: {
        crmClientId, isActive: true, ...(departmentId ? { departmentId } : {}),
        ...(search ? { OR: [{ shortcut: { contains: search, mode: "insensitive" } }, { title: { contains: search, mode: "insensitive" } }] } : {})
      },
      orderBy: { shortcut: "asc" }
    });
  }

  private async assertDepartmentInTenant(departmentId: string | undefined, crmClientId: string) {
    if (!departmentId) return;
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, crmClientId, isActive: true } });
    if (!department) throw new BadRequestException("Departamento não encontrado nesta organização");
  }

  async create(data: { crmClientId: string; shortcut: string; title: string; body: string; departmentId?: string }) {
    await this.assertDepartmentInTenant(data.departmentId, data.crmClientId);
    return this.prisma.quickMessage.create({ data });
  }

  async update(id: string, data: { shortcut?: string; title?: string; body?: string; isActive?: boolean }, crmClientId: string) {
    assertFound(await this.prisma.quickMessage.findFirst({ where: { id, crmClientId } }), "Mensagem rápida");
    return this.prisma.quickMessage.update({ where: { id }, data });
  }

  async remove(id: string, crmClientId: string) {
    assertFound(await this.prisma.quickMessage.findFirst({ where: { id, crmClientId } }), "Mensagem rápida");
    return this.prisma.quickMessage.update({ where: { id }, data: { isActive: false } });
  }
}
