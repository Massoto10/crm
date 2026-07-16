import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY, JwtPayload } from "./decorators";
import { PrismaService } from "../prisma/prisma.service";

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return secret;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const authHeader = req["headers"] as Record<string, string>;
    const bearer = authHeader["authorization"] ?? "";
    if (!bearer.startsWith("Bearer ")) throw new UnauthorizedException("Token ausente");

    try {
      const payload = jwt.verify(bearer.slice(7), jwtSecret()) as JwtPayload;
      const agent = await this.prisma.agent.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, crmClientId: true, authVersion: true }
      });
      if (!agent || !agent.isActive || agent.crmClientId !== payload.crmClientId || agent.authVersion !== payload.authVersion) {
        throw new UnauthorizedException("Sessão revogada");
      }
      req["user"] = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
  }
}
