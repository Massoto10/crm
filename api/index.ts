import "reflect-metadata";
import express from "express";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { IncomingMessage, ServerResponse } from "http";
// Importa o app já compilado (buildCommand roda nest build antes)
import { AppModule } from "../apps/api/dist/app.module";
import { AllExceptionsFilter } from "../apps/api/dist/common/filters/all-exceptions.filter";

let cached: express.Express | null = null;

async function getServer(): Promise<express.Express> {
  if (cached) return cached;
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ["error", "warn", "log"]
  });
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-process-secret"]
  });
  app.use(json({ limit: "16mb" }));
  app.use(urlencoded({ extended: false, limit: "16mb" }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } })
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix("api");
  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = await getServer();
  (server as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
}
