import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class ProcessSecretGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const secret = process.env.PROCESS_SECRET;
    if (!secret) throw new UnauthorizedException("PROCESS_SECRET não configurado");
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (req.headers["x-process-secret"] !== secret) {
      throw new UnauthorizedException("Segredo de processamento inválido");
    }
    return true;
  }
}
