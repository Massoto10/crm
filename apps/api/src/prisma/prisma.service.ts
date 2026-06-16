import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Prisma conectado ao banco");
    } catch (err) {
      this.logger.error(`Falha ao conectar no banco: ${err instanceof Error ? err.stack : String(err)}`);
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log("Prisma desconectado");
    } catch (err) {
      this.logger.error(`Falha ao desconectar do banco: ${String(err)}`);
    }
  }
}
