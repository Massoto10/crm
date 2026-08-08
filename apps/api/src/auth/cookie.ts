import type { CookieOptions, Response } from "express";

/**
 * Sessão em cookie httpOnly.
 *
 * O ponto de httpOnly é que `document.cookie` não enxerga o valor: um script
 * injetado na página não consegue ler nem exfiltrar a sessão, ao contrário do
 * localStorage. Em troca, o cookie viaja sozinho em toda requisição para a
 * origem — e é isso que abre CSRF, fechado aqui por SameSite=strict e, em
 * profundidade, pela checagem de Origin (ver csrf.guard.ts).
 *
 * Existem DUAS sessões independentes: a do CRM e a do painel de plataforma.
 * Nomes distintos para as duas coexistirem no mesmo navegador — o dono pode ter
 * o CRM numa aba e o painel na outra, e o logout de um não derruba o outro.
 */
export const AUTH_COOKIE = "stn_crm_session";
export const PLATFORM_AUTH_COOKIE = "stn_platform_session";

/**
 * Toda sessão do sistema. O CsrfGuard percorre esta lista: se ele conhecesse só
 * o cookie do CRM, todo POST do painel pularia a checagem de Origin — que é
 * justamente onde ficam as ações mais destrutivas (criar e suspender
 * departamento, resetar senha de qualquer operador).
 */
export const SESSION_COOKIES = [AUTH_COOKIE, PLATFORM_AUTH_COOKIE] as const;

const isProd = process.env.NODE_ENV === "production";

/** Precisa acompanhar o expiresIn do JWT — cookie vivo com token morto só gera 401. */
const MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Uma função só, parametrizada pelo nome. Copiar o objeto para o cookie do
 * painel faria as duas versões divergirem no primeiro ajuste de segurança —
 * e a que ficasse para trás seria a que ninguém lembra de revisar.
 */
export function sessionCookieOptions(): CookieOptions {
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

export function setSessionCookie(res: Response, name: string, token: string): void {
  res.cookie(name, token, sessionCookieOptions());
}

export function clearSessionCookie(res: Response, name: string): void {
  // maxAge não entra no clear: o navegador só casa o cookie a apagar por
  // nome + path + sameSite/secure, e um maxAge divergente deixa o cookie vivo.
  const { maxAge: _ignored, ...rest } = sessionCookieOptions();
  res.clearCookie(name, rest);
}

/** Compatibilidade: os chamadores do CRM continuam sem saber que há dois realms. */
export const authCookieOptions = sessionCookieOptions;
export const setAuthCookie = (res: Response, token: string) => setSessionCookie(res, AUTH_COOKIE, token);
export const clearAuthCookie = (res: Response) => clearSessionCookie(res, AUTH_COOKIE);
