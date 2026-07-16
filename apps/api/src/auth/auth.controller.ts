import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser, JwtPayload, Public, Roles } from "./decorators";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: { email?: string; password?: string }) {
    if (!body.email?.trim() || !body.password) throw new BadRequestException("Email e senha obrigatórios");
    return this.authService.login(body.email, body.password);
  }

  // Agent enrollment is an administrative action. The tenant always comes
  // from the authenticated administrator, never from a browser-supplied id.
  @Post("register")
  @Roles("admin")
  register(@CurrentUser() user: JwtPayload, @Body() body: { name?: string; email?: string; password?: string }) {
    if (!body.name?.trim()) throw new BadRequestException("Nome obrigatório");
    if (!body.email?.trim()) throw new BadRequestException("Email obrigatório");
    if (!body.password || body.password.length < 12) throw new BadRequestException("Senha deve ter ao menos 12 caracteres");
    return this.authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
      crmClientId: user.crmClientId
    });
  }

  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
