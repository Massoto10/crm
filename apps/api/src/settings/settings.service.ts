import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAll(crmClientId: string): Promise<Record<string, string>> {
    this.logger.log(`getAll settings crmClientId=${crmClientId}`);
    const rows = await this.prisma.setting.findMany({ where: { crmClientId } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async upsert(crmClientId: string, settings: Record<string, string>) {
    const ops = Object.entries(settings).map(([key, value]) =>
      this.prisma.setting.upsert({
        where: { crmClientId_key: { crmClientId, key } },
        create: { crmClientId, key, value },
        update: { value }
      })
    );
    try {
      await this.prisma.$transaction(ops);
    } catch (err) {
      this.logger.error(`upsert settings falhou crmClientId=${crmClientId}: ${String(err)}`);
      throw err;
    }
    this.logger.log(`upserted ${ops.length} settings for crmClientId=${crmClientId}`);
    return this.getAll(crmClientId);
  }
}
