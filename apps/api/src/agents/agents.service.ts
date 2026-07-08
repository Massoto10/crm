import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Senha forte legível: 14 chars base64url (sem +/=). Só é exibida uma vez ao admin.
  private genPassword(): string {
    return randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 14);
  }

  findAll(crmClientId: string, departmentId?: string) {
    this.logger.log(`findAll agents crmClientId=${crmClientId}${departmentId ? ` dept=${departmentId}` : ""}`);
    return this.prisma.agent.findMany({
      where: { crmClientId, isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      include: { department: true }
    });
  }

  async create(data: { crmClientId: string; name: string; email: string; role?: UserRole; departmentId?: string }) {
    this.logger.log(`create agent crmClientId=${data.crmClientId} email=${data.email}`);
    const tempPassword = this.genPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const agent = await this.prisma.agent.create({
      data: { crmClientId: data.crmClientId, name: data.name, email: data.email.toLowerCase().trim(), role: data.role ?? "agent", departmentId: data.departmentId, passwordHash },
      include: { department: true }
    });
    // tempPassword vai UMA vez pro admin — nunca é persistido em claro nem exibido de novo.
    return { ...agent, tempPassword };
  }

  // Redefine a senha (admin). Se `password` vier, usa-a; senão gera uma forte.
  // Retorna a senha em claro UMA vez.
  async resetPassword(id: string, password?: string) {
    assertFound(await this.prisma.agent.findUnique({ where: { id } }), "Agente");
    const newPassword = password && password.length >= 6 ? password : this.genPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.agent.update({ where: { id }, data: { passwordHash } });
    this.logger.log(`reset password agentId=${id}`);
    return { ok: true, tempPassword: newPassword };
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
