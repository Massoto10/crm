import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";
import { SESSION_COOKIES } from "./cookie";

/** Métodos sem efeito colateral não precisam de proteção CSRF. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defesa em profundidade contra CSRF.
 *
 * A proteção principal é o SameSite=strict do cookie de sessão. Esta guarda
 * cobre o resto: navegador antigo que ignore SameSite, e qualquer caminho futuro
 * que afrouxe o atributo sem que ninguém lembre desta consequência.
 *
 * Só age quando a requisição é autenticada POR COOKIE. Requisição com Bearer,
 * com x-process-secret ou o webhook da Evolution não carrega credencial
 * ambiente, então não é forjável a partir de outro site — e a Evolution nem
 * manda Origin, o que quebraria o webhook se a checagem fosse cega.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  private allowedOrigins(): string[] {
    return (process.env.WEB_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { cookies?: Record<string, string> }>();

    if (SAFE_METHODS.has(req.method)) return true;
    // Sem cookie de sessão não há credencial ambiente para o navegador anexar.
    // Percorre TODAS as sessões: checar só a do CRM deixaria o painel de
    // plataforma inteiro fora da proteção, e é lá que estão as ações mais
    // destrutivas do sistema.
    if (!SESSION_COOKIES.some((nome) => req.cookies?.[nome])) return true;

    // O navegador manda Origin em toda requisição não-GET, inclusive same-origin.
    // Referer é fallback para casos raros em que Origin vem ausente.
    const origin = req.headers.origin ?? this.originFromReferer(req.headers.referer);
    if (!origin) {
      this.logger.warn(`CSRF: ${req.method} ${req.path} sem Origin nem Referer, com cookie de sessão`);
      throw new ForbiddenException("Origem ausente");
    }

    if (!this.allowedOrigins().includes(origin.replace(/\/$/, ""))) {
      this.logger.warn(`CSRF: origem recusada "${origin}" em ${req.method} ${req.path}`);
      throw new ForbiddenException("Origem não permitida");
    }

    return true;
  }

  private originFromReferer(referer: string | undefined): string | null {
    if (!referer) return null;
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }
}
