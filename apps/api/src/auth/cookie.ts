import type { CookieOptions, Response } from "express";

/**
 * Sessão em cookie httpOnly.
 *
 * O ponto de httpOnly é que `document.cookie` não enxerga o valor: um script
 * injetado na página não consegue ler nem exfiltrar a sessão, ao contrário do
 * localStorage. Em troca, o cookie viaja sozinho em toda requisição para a
 * origem — e é isso que abre CSRF, fechado aqui por SameSite=strict e, em
 * profundidade, pela checagem de Origin (ver csrf.guard.ts).
 */
export const AUTH_COOKIE = "stn_crm_session";

const isProd = process.env.NODE_ENV === "production";

/** Precisa acompanhar o expiresIn do JWT — cookie vivo com token morto só gera 401. */
const MAX_AGE_MS = 15 * 60 * 1000;

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Sem Secure o cookie iria em claro num acesso http://. Fora de produção
    // fica desligado, senão o cookie não gruda em http://localhost.
    secure: isProd,
    // strict porque front e API são a mesma origem atrás do Caddy: nada neste
    // app depende de o cookie sobreviver a uma navegação vinda de outro site.
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_MS
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  // maxAge não entra no clear: o navegador só casa o cookie a apagar por
  // nome + path + sameSite/secure, e um maxAge divergente deixa o cookie vivo.
  const { maxAge: _ignored, ...rest } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, rest);
}
