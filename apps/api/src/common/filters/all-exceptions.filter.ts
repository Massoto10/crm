import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Captura TODA exceção não tratada, loga (warn em 4xx, error+stack em 5xx) e
 * devolve um JSON padronizado. Garante que nenhum erro passe sem log nem vaze
 * stack pro cliente.
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

    // Mensagem: respeita a do HttpException; genérica em 500 (não vaza detalhe interno).
    let message: string | string[];
    if (isHttp) {
      const body = exception.getResponse();
      message = typeof body === "string" ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else {
      message = "Erro interno do servidor";
    }

    const where = `${req.method} ${req.originalUrl}`;
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${status} ${where} -> ${exception instanceof Error ? exception.message : String(exception)}`, stack);
    } else {
      this.logger.warn(`${status} ${where} -> ${Array.isArray(message) ? message.join("; ") : message}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
}
