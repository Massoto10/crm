import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./decorators";
import { ADMIN_PERMISSIONS, normalizePermissions } from "./permissions";

const jwtSecret = () => process.env.PROCESS_SECRET ?? "fallback-jwt-secret";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const agent = await this.prisma.agent.findFirst({ where: { email: email.toLowerCase().trim(), isActive: true } });
    if (!agent?.passwordHash) throw new UnauthorizedException("Credenciais inválidas");

    let ok = false;
    try {
      ok = await bcrypt.compare(password, agent.passwordHash);
    } catch (err) {
      this.logger.error(`bcrypt.compare falhou agentId=${agent.id}: ${String(err)}`);
      throw new UnauthorizedException("Credenciais inválidas");
    }
    if (!ok) throw new UnauthorizedException("Credenciais inválidas");

    const token = await this.sign(agent);
    this.logger.log(`login agentId=${agent.id} role=${agent.role}`);
    return { token, user: this.toPublic(agent) };
  }

  async register(data: { name: string; email: string; password: string; crmClientId: string }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.agent.findFirst({ where: { email, crmClientId: data.crmClientId } });
    if (existing) throw new ConflictException("Email já cadastrado nesta organização");

    // Admin role can only be set via direct DB insert — register always creates agents
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(data.password, 10);
    } catch (err) {
      this.logger.error(`bcrypt.hash falhou no register email=${email}: ${String(err)}`);
      throw err;
    }
    const agent = await this.prisma.agent.create({
      data: { name: data.name.trim(), email, passwordHash, crmClientId: data.crmClientId, role: "agent" }
    });

    const token = await this.sign(agent);
    this.logger.log(`register agentId=${agent.id} role=${agent.role}`);
    return { token, user: this.toPublic(agent) };
  }

  async me(agentId: string) {
    return this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, role: true, crmClientId: true, departmentId: true }
    });
  }

  private async sign(agent: { id: string; email: string; name: string; role: string; crmClientId: string; departmentId?: string | null }) {
    // Admin tem acesso total; agente herda as permissões do seu departamento.
    let permissions = ADMIN_PERMISSIONS;
    if (agent.role !== "admin") {
      const dept = agent.departmentId
        ? await this.prisma.department.findUnique({ where: { id: agent.departmentId }, select: { permissions: true } })
        : null;
      permissions = normalizePermissions(dept?.permissions);
    }
    const payload: JwtPayload = {
      sub: agent.id, email: agent.email, name: agent.name,
      role: agent.role as "admin" | "agent", crmClientId: agent.crmClientId, permissions
    };
    try {
      return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
    } catch (err) {
      this.logger.error(`jwt.sign falhou agentId=${agent.id}: ${String(err)}`);
      throw err;
    }
  }

  private toPublic(a: { id: string; name: string; email: string; role: string; crmClientId: string }) {
    return { id: a.id, name: a.name, email: a.email, role: a.role, crmClientId: a.crmClientId };
  }
}
