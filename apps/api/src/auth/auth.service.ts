import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./decorators";
import { ADMIN_PERMISSIONS, normalizePermissions } from "./permissions";
import { JWT_ALGORITHM, JWT_AUDIENCE, JWT_EXPIRES_IN, JWT_ISSUER, jwtSecret } from "./jwt.options";

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

  /**
   * Com a sessão em cookie httpOnly o front não consegue mais decodificar o JWT
   * para saber quem está logado e o que pode ver. Este endpoint passa a ser a
   * única fonte dessa informação, então precisa devolver `permissions` — sem
   * isso a UI não consegue montar o menu nem esconder tela sem acesso.
   */
  async me(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, role: true, crmClientId: true, departmentId: true }
    });
    if (!agent) return null;
    return { ...agent, permissions: await this.resolvePermissions(agent) };
  }

  /** Admin ignora departamento; agente herda as permissões do seu. */
  private async resolvePermissions(agent: { role: string; departmentId?: string | null }) {
    if (agent.role === "admin") return ADMIN_PERMISSIONS;
    const dept = agent.departmentId
      ? await this.prisma.department.findFirst({ where: { id: agent.departmentId, isActive: true }, select: { permissions: true } })
      : null;
    return normalizePermissions(dept?.permissions);
  }

  private async sign(agent: {
    id: string; email: string; name: string; role: string; crmClientId: string;
    departmentId?: string | null; authVersion: number;
  }) {
    const permissions = await this.resolvePermissions(agent);
    const payload: JwtPayload = {
      sub: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role as "admin" | "agent",
      crmClientId: agent.crmClientId,
      permissions,
      authVersion: agent.authVersion
    };
    return jwt.sign(payload, jwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  }

  private toPublic(a: { id: string; name: string; email: string; role: string; crmClientId: string }) {
    return { id: a.id, name: a.name, email: a.email, role: a.role, crmClientId: a.crmClientId };
  }
}
