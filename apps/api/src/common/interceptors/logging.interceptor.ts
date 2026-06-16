import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

/**
 * Loga TODA requisição HTTP: método, rota, status, duração e usuário (se autenticado).
 * Erros são logados pelo AllExceptionsFilter — aqui o tap de error só mede a duração.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { user?: { sub?: string; role?: string } }>();
    const res = ctx.getResponse<Response>();
    const start = Date.now();
    const who = req.user ? ` user=${req.user.sub}/${req.user.role}` : "";

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms${who}`),
        error: (err) => {
          const status = (err as { status?: number }).status ?? 500;
          this.logger.warn(`${req.method} ${req.originalUrl} ${status} ${Date.now() - start}ms${who} (erro)`);
        }
      })
    );
  }
}
