import { Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import type { JwtPayload } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "credential",
  "accesskey",
  "apikey",
  "secretaccesskey"
]);

type AuthenticatedRequest = Request & { user?: JwtPayload };

export type AuditRecord = {
  crmClientId?: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  method: string;
  route: string;
  statusCode: number;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

function truncate(value: string | undefined, maximum: number): string | undefined {
  if (!value) return undefined;
  return value.slice(0, maximum);
}

function normalizeRoute(request: Request): string {
  const route = request.route?.path;
  if (typeof route === "string") return `/api${route.startsWith("/") ? route : `/${route}`}`;
  return request.path
    .split("/")
    .map((segment) => /^(?:c[a-z0-9]{15,}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(segment) ? ":id" : segment)
    .join("/");
}

function isSensitiveFieldName(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return SENSITIVE_FIELD_NAMES.has(normalized) || /(?:token|secret|password)$/.test(normalized);
}

function bodyFieldNames(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body)
    .filter((key) => !isSensitiveFieldName(key))
    .slice(0, 30);
}

function targetFromParams(params: Record<string, string | string[]> | undefined) {
  if (!params) return {};
  const parameter = Object.entries(params).find(([key, value]) => key.toLowerCase().endsWith("id") && value);
  if (!parameter) return {};
  const targetId = Array.isArray(parameter[1]) ? parameter[1][0] : parameter[1];
  const targetType = parameter[0].toLowerCase() === "id" ? "resource" : parameter[0].replace(/Id$/i, "");
  return { targetType, targetId: truncate(targetId, 128) };
}

export function createAuditRequestContext(request: Request) {
  return {
    ipAddress: truncate(request.ip, 64),
    userAgent: truncate(request.get("user-agent"), 255)
  };
}

/**
 * Converte a escrita HTTP em um evento sem guardar payloads sensíveis ou conteúdo
 * conversacional. Leituras continuam apenas no logger técnico, sem poluir a tabela.
 */
export function createAuditRecordFromRequest(request: AuthenticatedRequest, statusCode: number): AuditRecord | null {
  if (!MUTATING_METHODS.has(request.method) || !request.user) return null;

  const route = normalizeRoute(request);
  const actionRoute = route
    .replace(/^\/api\/?/, "")
    .replace(/\//g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);

  return {
    ...createAuditRequestContext(request),
    crmClientId: request.user.crmClientId,
    actorId: request.user.sub,
    actorRole: request.user.role,
    action: `${request.method.toLowerCase()}.${actionRoute || "root"}`,
    method: request.method,
    route: truncate(route, 180) ?? "/api",
    statusCode,
    ...targetFromParams(request.params),
    metadata: { fields: bodyFieldNames(request.body) }
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(record: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          crmClientId: record.crmClientId,
          actorId: record.actorId,
          actorRole: record.actorRole,
          action: record.action,
          method: record.method,
          route: record.route,
          statusCode: record.statusCode,
          targetType: record.targetType,
          targetId: record.targetId,
          metadata: record.metadata ?? {},
          ipAddress: record.ipAddress,
          userAgent: record.userAgent
        }
      });
    } catch (error) {
      // A falha da trilha de auditoria nunca pode derrubar a ação principal.
      this.logger.error("Falha ao persistir evento de auditoria", error instanceof Error ? error.stack : undefined);
    }
  }

  async list(crmClientId: string, limit: number, cursor?: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { crmClientId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        method: true,
        route: true,
        statusCode: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } }
      }
    });
    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;

    return {
      data,
      nextCursor: hasMore ? data.at(-1)?.id ?? null : null
    };
  }
}
