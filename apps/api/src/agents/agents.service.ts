import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { assertFound } from "../common/assert-found";
import { generateTemporaryPassword, hashPassword } from "../common/password";
import { PrismaService } from "../prisma/prisma.service";

const publicAgentSelect = {
  id: true,
  crmClientId: true,
  departmentId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, isActive: true } }
} satisfies Prisma.AgentSelect;

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertDepartmentInTenant(departmentId: string | undefined | null, crmClientId: string) {
    if (!departmentId) return;
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, crmClientId, isActive: true } });
    if (!dept) throw new BadRequestException("Departamento não encontrado nesta organização");
  }

  findAll(crmClientId: string, departmentId?: string) {
    return this.prisma.agent.findMany({
      where: { crmClientId, isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      select: publicAgentSelect
    });
  }

  async create(crmClientId: string, data: { name: string; email: string; role?: UserRole; departmentId?: string }) {
    await this.assertDepartmentInTenant(data.departmentId, crmClientId);
    const email = data.email.toLowerCase().trim();
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const existing = await this.prisma.agent.findFirst({ where: { crmClientId, email } });
    if (existing) {
      const agent = await this.prisma.agent.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          role: data.role ?? "agent",
          departmentId: data.departmentId ?? null,
          isActive: true,
          passwordHash,
          authVersion: { increment: 1 }
        },
        select: publicAgentSelect
      });
      return { ...agent, tempPassword };
    }
    const agent = await this.prisma.agent.create({
      data: { crmClientId, name: data.name, email, role: data.role ?? "agent", departmentId: data.departmentId, passwordHash },
      select: publicAgentSelect
    });
    return { ...agent, tempPassword };
  }

  async resetPassword(id: string, password: string | undefined, crmClientId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, crmClientId } });
    assertFound(agent, "Agente");
    if (password && password.length < 12) throw new BadRequestException("Senha deve ter ao menos 12 caracteres");
    const newPassword = password ?? generateTemporaryPassword();
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.agent.update({ where: { id }, data: { passwordHash, authVersion: { increment: 1 } } });
    return { ok: true, tempPassword: newPassword };
  }

  async update(id: string, data: { name?: string; email?: string; role?: UserRole; departmentId?: string | null; isActive?: boolean }, crmClientId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, crmClientId } });
    assertFound(agent, "Agente");
    await this.assertDepartmentInTenant(data.departmentId, crmClientId);
    const result = await this.prisma.agent.update({
      where: { id },
      data: {
        ...data,
        ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
        authVersion: { increment: 1 }
      },
      select: publicAgentSelect
    });
    return result;
  }

  async remove(id: string, crmClientId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, crmClientId } });
    assertFound(agent, "Agente");
    return this.prisma.agent.update({ where: { id }, data: { isActive: false, authVersion: { increment: 1 } } });
  }
}
