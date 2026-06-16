import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { DeptPermissions, ViewKey } from "./permissions";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restringe um endpoint a um papel (ex.: @Roles("admin")).
export const ROLES_KEY = "requiredRoles";
export const Roles = (...roles: Array<"admin" | "agent">) => SetMetadata(ROLES_KEY, roles);

// Exige que o departamento do usuário tenha acesso a uma tela (admin ignora).
export const VIEW_KEY = "requiredView";
export const RequireView = (view: ViewKey) => SetMetadata(VIEW_KEY, view);

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: "admin" | "agent";
  crmClientId: string;
  permissions?: DeptPermissions;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user
);
