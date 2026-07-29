import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY, JwtPayload } from "./decorators";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_COOKIE } from "./cookie";
import { JWT_ALGORITHMS, JWT_AUDIENCE, JWT_CLOCK_TOLERANCE_S, JWT_ISSUER, jwtSecret } from "./jwt.options";

type AuthedRequest = Request & { cookies?: Record<string, string>; user?: JwtPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  /**
   * O navegador autentica pelo cookie httpOnly — é a via preferida, porque o
   * token nunca fica ao alcance do JavaScript da página.
   *
   * O Bearer continua aceito para cliente que não é navegador (script, teste de
   * integração, ferramenta de linha de comando). Não enfraquece nada: quem tem
   * XSS não consegue ler o cookie httpOnly de qualquer forma, e quem já tem um
   * Bearer válido não precisava de XSS.
   */
  private extractToken(req: AuthedRequest): string | null {
    const fromCookie = req.cookies?.[AUTH_COOKIE];
    if (fromCookie) return fromCookie;

    const bearer = req.headers.authorization ?? "";
    return bearer.startsWith("Bearer ") ? bearer.slice(7) : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException("Token ausente");

    try {
      const payload = jwt.verify(token, jwtSecret(), {
        algorithms: JWT_ALGORITHMS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        clockTolerance: JWT_CLOCK_TOLERANCE_S
      }) as JwtPayload;
      const agent = await this.prisma.agent.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, crmClientId: true, authVersion: true }
      });
      if (!agent || !agent.isActive || agent.crmClientId !== payload.crmClientId || agent.authVersion !== payload.authVersion) {
        throw new UnauthorizedException("Sessão revogada");
      }
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
  }
}
