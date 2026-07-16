import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./decorators";
import { ADMIN_PERMISSIONS, normalizePermissions } from "./permissions";

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return secret;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const candidates = await this.prisma.agent.findMany({
      where: { email: email.toLowerCase().trim(), isActive: true }
    });
    const matches = [] as typeof candidates;
    for (const candidate of candidates) {
      if (!candidate.passwordHash) continue;
      try {
        if (await bcrypt.compare(password, candidate.passwordHash)) matches.push(candidate);
      } catch (err) {
        this.logger.error(`bcrypt.compare falhou agentId=${candidate.id}: ${String(err)}`);
      }
    }
    // Email is unique only inside a tenant. Refuse ambiguity rather than
    // selecting an arbitrary tenant when the same credential exists twice.
    if (matches.length !== 1) throw new UnauthorizedException("Credenciais inválidas");
    const agent = matches[0];

    const token = await this.sign(agent);
    this.logger.log(`login agentId=${agent.id} role=${agent.role}`);
    return { token, user: this.toPublic(agent) };
  }

  async register(data: { name: string; email: string; password: string; crmClientId: string }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.agent.findFirst({ where: { email, crmClientId: data.crmClientId } });
    if (existing) throw new ConflictException("Email já cadastrado nesta organização");

    const passwordHash = await bcrypt.hash(data.password, 10);
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

  private async sign(agent: {
    id: string; email: string; name: string; role: string; crmClientId: string;
    departmentId?: string | null; authVersion: number;
  }) {
    let permissions = ADMIN_PERMISSIONS;
    if (agent.role !== "admin") {
      const dept = agent.departmentId
        ? await this.prisma.department.findFirst({ where: { id: agent.departmentId, isActive: true }, select: { permissions: true } })
        : null;
      permissions = normalizePermissions(dept?.permissions);
    }
    const payload: JwtPayload = {
      sub: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role as "admin" | "agent",
      crmClientId: agent.crmClientId,
      permissions,
      authVersion: agent.authVersion
    };
    return jwt.sign(payload, jwtSecret(), { expiresIn: "15m" });
  }

  private toPublic(a: { id: string; name: string; email: string; role: string; crmClientId: string }) {
    return { id: a.id, name: a.name, email: a.email, role: a.role, crmClientId: a.crmClientId };
  }
}
