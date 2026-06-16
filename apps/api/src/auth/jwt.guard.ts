import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY, JwtPayload } from "./decorators";

const jwtSecret = () => process.env.PROCESS_SECRET ?? "fallback-jwt-secret";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
      req["user"] = jwt.verify(bearer.slice(7), jwtSecret()) as JwtPayload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
  }
}
