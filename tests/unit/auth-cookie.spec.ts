import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { CsrfGuard } from "../../apps/api/src/auth/csrf.guard";
import { AUTH_COOKIE, PLATFORM_AUTH_COOKIE, authCookieOptions } from "../../apps/api/src/auth/cookie";

/** Contexto mínimo do Nest com só o que as guardas leem. */
function ctx(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req })
  } as unknown as ExecutionContext;
}

function req(over: Partial<{
  method: string;
  path: string;
  cookies: Record<string, string>;
  headers: Record<string, string>;
}> = {}) {
  return {
    method: "POST",
    path: "/api/conversations",
    cookies: { [AUTH_COOKIE]: "token-qualquer" },
    headers: { origin: "https://scaletonext.com.br" },
    ...over
  };
}

describe("authCookieOptions", () => {
  it("é httpOnly e SameSite=strict — o que tira o token do alcance do JS e fecha CSRF", () => {
    const o = authCookieOptions();
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("strict");
    expect(o.path).toBe("/");
  });

  it("expira junto com o JWT (15 min), senão sobra cookie vivo com token morto", () => {
    expect(authCookieOptions().maxAge).toBe(15 * 60 * 1000);
  });
});

describe("CsrfGuard", () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    vi.stubEnv("WEB_ORIGIN", "https://scaletonext.com.br");
    guard = new CsrfGuard();
  });

  it("deixa passar método seguro sem olhar origem", () => {
    expect(guard.canActivate(ctx(req({ method: "GET", headers: {} })))).toBe(true);
  });

  it("aceita origem permitida em requisição com cookie", () => {
    expect(guard.canActivate(ctx(req()))).toBe(true);
  });

  it("recusa origem de outro site — o caso CSRF clássico", () => {
    expect(() => guard.canActivate(ctx(req({ headers: { origin: "https://evil.example" } }))))
      .toThrow(ForbiddenException);
  });

  it("recusa quando não há Origin nem Referer e existe cookie de sessão", () => {
    expect(() => guard.canActivate(ctx(req({ headers: {} })))).toThrow(ForbiddenException);
  });

  it("cai no Referer quando o Origin vem ausente", () => {
    const r = req({ headers: { referer: "https://scaletonext.com.br/chats" } });
    expect(guard.canActivate(ctx(r))).toBe(true);
  });

  // Sem cookie não há credencial ambiente: outro site não consegue forjar a
  // requisição, então exigir Origin só quebraria cliente legítimo.
  it("ignora requisição sem cookie de sessão (Bearer, x-process-secret)", () => {
    expect(guard.canActivate(ctx(req({ cookies: {}, headers: {} })))).toBe(true);
  });

  // O webhook da Evolution é @Public(), chega sem cookie e sem Origin. Se a
  // guarda exigisse origem às cegas, o WhatsApp parava de entregar mensagem.
  it("deixa o webhook da Evolution passar", () => {
    const r = req({ path: "/api/whatsapp/webhook", cookies: {}, headers: {} });
    expect(guard.canActivate(ctx(r))).toBe(true);
  });

  it("tolera barra final na origem configurada", () => {
    vi.stubEnv("WEB_ORIGIN", "https://scaletonext.com.br/");
    expect(new CsrfGuard().canActivate(ctx(req()))).toBe(true);
  });

  it("respeita lista de várias origens", () => {
    vi.stubEnv("WEB_ORIGIN", "https://a.example,https://scaletonext.com.br");
    expect(new CsrfGuard().canActivate(ctx(req()))).toBe(true);
  });

  /**
   * Regressão: a guarda conhecia só o cookie do CRM. Quando o painel de
   * plataforma ganhou o seu, TODO POST/PUT/DELETE do painel passou a pular a
   * checagem de Origin — justamente onde ficam as ações mais destrutivas do
   * sistema (criar e suspender departamento, resetar senha de qualquer
   * operador). Estes dois casos passariam antes da correção.
   */
  it("protege sessão do painel de plataforma contra origem forasteira", () => {
    const r = req({
      path: "/api/platform/departments",
      cookies: { [PLATFORM_AUTH_COOKIE]: "token-do-painel" },
      headers: { origin: "https://evil.example" }
    });
    expect(() => guard.canActivate(ctx(r))).toThrow(ForbiddenException);
  });

  it("exige Origin também quando só a sessão do painel está presente", () => {
    const r = req({
      path: "/api/platform/departments",
      cookies: { [PLATFORM_AUTH_COOKIE]: "token-do-painel" },
      headers: {}
    });
    expect(() => guard.canActivate(ctx(r))).toThrow(ForbiddenException);
  });

  it("aceita a sessão do painel vinda de origem permitida", () => {
    const r = req({
      path: "/api/platform/departments",
      cookies: { [PLATFORM_AUTH_COOKIE]: "token-do-painel" },
      headers: { origin: "https://scaletonext.com.br" }
    });
    expect(guard.canActivate(ctx(r))).toBe(true);
  });

  // As duas sessões coexistem no mesmo navegador: CRM numa aba, painel na outra.
  it("protege quando as duas sessões estão presentes", () => {
    const r = req({
      cookies: { [AUTH_COOKIE]: "crm", [PLATFORM_AUTH_COOKIE]: "painel" },
      headers: { origin: "https://evil.example" }
    });
    expect(() => guard.canActivate(ctx(r))).toThrow(ForbiddenException);
  });
});
