import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

const isProd = process.env.NODE_ENV === "production";

// Uploads de mídia em base64 podem levar dezenas de segundos em conexão ruim,
// então o teto é generoso — o objetivo é matar conexão pendurada, não cortar
// upload legítimo. headersTimeout precisa ser > keepAliveTimeout, senão o Node
// derruba conexão keep-alive saudável no meio do request seguinte.
const REQUEST_TIMEOUT_MS = 60_000;
const KEEPALIVE_TIMEOUT_MS = 65_000;
const HEADERS_TIMEOUT_MS = 70_000;

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const required = ["DATABASE_URL", "JWT_SECRET", "PROCESS_SECRET", "WA_WEBHOOK_TOKEN"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sem isto o Express usa o IP do socket — que atrás do Caddy é sempre o mesmo
  // container, fazendo o rate limit de 120 req/min virar um teto GLOBAL em vez
  // de por cliente. O número é a quantidade de proxies à frente da API:
  //   1 = só o Caddy (Cloudflare em cinza)
  //   2 = Cloudflare (laranja) + Caddy
  // Não deixar maior que a realidade: hop a mais permite forjar X-Forwarded-For
  // e escapar do rate limit.
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

  app.use(helmet());

  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-process-secret"],
    // A sessão vive num cookie httpOnly; sem isto o navegador não o envia.
    // Exige lista explícita de origens (nunca "*") — já é o caso acima.
    credentials: true
  });

  // Precisa vir antes dos guards: o JwtAuthGuard lê a sessão de req.cookies.
  app.use(cookieParser());

  // Limita tamanho do body — maior pra acomodar áudio em base64 (notas de voz)
  app.use(json({ limit: "16mb" }));
  app.use(urlencoded({ extended: false, limit: "16mb" }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Em produção a mensagem detalhada do class-validator vira um mapa do
      // schema pra quem sonda a API ("property X should not exist", "email must
      // be an email"). O detalhe continua no log do servidor via filtro.
      disableErrorMessages: isProd
    })
  );

  // Captura e loga toda exceção, com resposta JSON padronizada
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix("api");
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);

  // Conexão que abre e não completa o request segura um socket indefinidamente
  // por padrão no Node. Com estes limites ela morre sozinha.
  const server = app.getHttpServer() as import("http").Server;
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = KEEPALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;

  logger.log(`API ouvindo na porta ${port} (prod=${isProd}, trustProxy=${process.env.TRUST_PROXY_HOPS ?? 1})`);
}

bootstrap().catch((err) => {
  new Logger("Bootstrap").error(`Falha ao iniciar a API: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
