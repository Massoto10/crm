import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-process-secret"]
  });

  // Limita tamanho do body — maior pra acomodar áudio em base64 (notas de voz)
  app.use(json({ limit: "16mb" }));
  app.use(urlencoded({ extended: false, limit: "16mb" }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  // Captura e loga toda exceção, com resposta JSON padronizada
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix("api");
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  logger.log(`API ouvindo na porta ${port}`);
}

bootstrap().catch((err) => {
  new Logger("Bootstrap").error(`Falha ao iniciar a API: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
