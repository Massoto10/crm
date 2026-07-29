import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuditService, createAuditRequestContext } from "../audit/audit.service";
import { AuthService } from "./auth.service";
import { clearAuthCookie, setAuthCookie } from "./cookie";
import { CurrentUser, JwtPayload, Public, Roles } from "./decorators";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService
  ) {}

  /**
   * O token sai apenas no cookie httpOnly — nunca no corpo. Se voltasse no JSON,
   * o JavaScript da página o teria em mãos e a migração não teria servido para
   * nada: bastaria um XSS ler a resposta do login.
   */
  @Public()
  @Post("login")
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!body.email?.trim() || !body.password) throw new BadRequestException("Email e senha obrigatórios");
    const { token, user } = await this.authService.login(body.email, body.password);
    setAuthCookie(res, token);
    void this.auditService.record({
      ...createAuditRequestContext(req),
      crmClientId: user.crmClientId,
      actorId: user.id,
      actorRole: user.role,
      action: "auth.login",
      method: "POST",
      route: "/api/auth/login",
      statusCode: 201
    });
    return { user };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    // Sem estado de sessão no servidor, apagar o cookie É o logout. Para cortar
    // um token já emitido antes de ele expirar, incremente Agent.authVersion —
    // o JwtAuthGuard confere esse campo a cada requisição.
    clearAuthCookie(res);
    return { ok: true };
  }

  // Agent enrollment is an administrative action. The tenant always comes
  // from the authenticated administrator, never from a browser-supplied id.
  //
  // Não emite cookie: quem chama é o administrador criando OUTRA pessoa. Trocar
  // o cookie aqui jogaria a sessão do admin para dentro da conta recém-criada.
  @Post("register")
  @Roles("admin")
  async register(@CurrentUser() user: JwtPayload, @Body() body: { name?: string; email?: string; password?: string }) {
    if (!body.name?.trim()) throw new BadRequestException("Nome obrigatório");
    if (!body.email?.trim()) throw new BadRequestException("Email obrigatório");
    if (!body.password || body.password.length < 12) throw new BadRequestException("Senha deve ter ao menos 12 caracteres");
    const created = await this.authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
      crmClientId: user.crmClientId
    });
    return { user: created.user };
  }

  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
