import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";
import { redactUrl } from "../redact";

const isProd = process.env.NODE_ENV === "production";

/**
 * Mensagem fixa por classe de status, usada só em produção. Quem sonda a API não
 * distingue "rota não existe" de "rota existe mas não é sua", nem descobre os
 * campos de um DTO pela mensagem de validação.
 */
const GENERIC_MESSAGE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "Requisição inválida",
  [HttpStatus.UNAUTHORIZED]: "Não autorizado",
  [HttpStatus.FORBIDDEN]: "Acesso negado",
  [HttpStatus.NOT_FOUND]: "Recurso não encontrado",
  [HttpStatus.CONFLICT]: "Conflito",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "Conteúdo muito grande",
  [HttpStatus.TOO_MANY_REQUESTS]: "Muitas requisições"
};

/**
 * Captura TODA exceção não tratada, loga (warn em 4xx, error+stack em 5xx) e
 * devolve um JSON padronizado. Garante que nenhum erro passe sem log nem vaze
 * stack pro cliente.
 *
 * Em produção a resposta é deliberadamente pobre — todo o detalhe fica no log do
 * servidor, nada dele chega ao cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Detalhe real — só para o log.
    let detail: string | string[];
    if (isHttp) {
      const body = exception.getResponse();
      detail = typeof body === "string" ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else {
      detail = exception instanceof Error ? exception.message : String(exception);
    }

    const safePath = redactUrl(req.originalUrl).split("?", 1)[0];
    const where = `${req.method} ${safePath}`;
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${status} ${where} -> ${detail}`, stack);
    } else {
      this.logger.warn(`${status} ${where} -> ${Array.isArray(detail) ? detail.join("; ") : detail}`);
    }

    // Detalhe interno de 5xx nunca sai, nem em dev.
    let message: string | string[];
    if (status >= 500) message = "Erro interno do servidor";
    else if (isProd) message = GENERIC_MESSAGE[status] ?? "Requisição inválida";
    else message = detail;

    // `path` só em dev: em produção ele devolve ao cliente o caminho que ele
    // mesmo mandou, servindo de eco para sondagem e de refletor de payload.
    res.status(status).json({
      statusCode: status,
      message,
      ...(isProd ? {} : { path: safePath }),
      timestamp: new Date().toISOString()
    });
  }
}
