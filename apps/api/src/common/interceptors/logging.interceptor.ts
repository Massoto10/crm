import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { AuditService, createAuditRecordFromRequest } from "../../audit/audit.service";
import type { JwtPayload } from "../../auth/decorators";
import { redactUrl } from "../redact";

/**
 * Loga TODA requisição HTTP: método, rota, status, duração e usuário (se autenticado).
 * Erros são logados pelo AllExceptionsFilter — aqui o tap de error só mede a duração.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { user?: JwtPayload }>();
    const res = ctx.getResponse<Response>();
    const start = Date.now();
    const safePath = redactUrl(req.originalUrl).split("?", 1)[0];
    const actor = req.user ? ` actor=${req.user.sub}/${req.user.role}` : "";

    const logRequest = (statusCode: number, failed: boolean) => {
      const durationMs = Date.now() - start;
      const suffix = failed ? " result=error" : "";
      const message = `${req.method} ${safePath} status=${statusCode} duration=${durationMs}ms${actor}${suffix}`;
      if (failed) this.logger.warn(message);
      else this.logger.log(message);

      const auditRecord = createAuditRecordFromRequest(req, statusCode);
      if (auditRecord) void this.auditService.record(auditRecord);
    };

    return next.handle().pipe(
      tap({
        next: () => logRequest(res.statusCode, false),
        error: (err) => {
          const status = (err as { status?: number }).status ?? 500;
          logRequest(status, true);
        }
      })
    );
  }
}
