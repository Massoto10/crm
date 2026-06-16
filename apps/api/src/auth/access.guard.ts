import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY, JwtPayload, ROLES_KEY, VIEW_KEY } from "./decorators";
import type { ViewKey } from "./permissions";

/**
 * Roda depois do JwtAuthGuard. Aplica:
 *  - @Roles("admin"): só o papel indicado passa.
 *  - @RequireView("settings"): admin sempre passa; agente precisa da tela liberada
 *    nas permissões do seu departamento.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<Array<"admin" | "agent">>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const view = this.reflector.getAllAndOverride<ViewKey>(VIEW_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles && !view) return true;

    const user = context.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user) throw new ForbiddenException("Acesso negado");

    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException("Requer perfil administrativo");
    }

    if (view && user.role !== "admin" && !user.permissions?.views?.[view]) {
      throw new ForbiddenException(`Sem acesso à área "${view}"`);
    }

    return true;
  }
}
