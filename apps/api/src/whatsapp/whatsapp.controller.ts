import { Body, Controller, Get, Logger, Param, Post, Delete, Query, UnauthorizedException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public, Roles } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

@Controller("whatsapp")
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly webhook: WhatsappWebhookService,
    private readonly prisma: PrismaService
  ) {}

  // Evolution API calls this — skip rate limit. Token na URL impede que
  // terceiros injetem mensagens falsas no CRM.
  @Public()
  @SkipThrottle()
  @Post("webhook")
  async handleWebhook(@Body() body: unknown, @Query("token") token?: string): Promise<{ ok: boolean }> {
    const expected = process.env.WA_WEBHOOK_TOKEN;
    // Evolution pode anexar "/nome-do-evento" após a query string — compara só o primeiro segmento
    const received = token?.split("/")[0];
    if (expected && received !== expected) {
      throw new UnauthorizedException("Token de webhook inválido");
    }
    // Não propaga erro: se a gravação falhar, logamos mas respondemos ok pra
    // o Evolution não reenviar o mesmo evento em loop.
    try {
      await this.webhook.handle(body as { event: string });
    } catch (err) {
      this.logger.error(`webhook handle falhou: ${err instanceof Error ? err.stack : String(err)}`);
    }
    return { ok: true };
  }

  @Get(":crmClientId/status")
  async getStatus(@Param("crmClientId") crmClientId: string) {
    const [instanceSetting, statusSetting, qrSetting] = await Promise.all([
      this.prisma.setting.findFirst({ where: { crmClientId, key: "wa_instance_name" } }),
      this.prisma.setting.findFirst({ where: { crmClientId, key: "wa_status" } }),
      this.prisma.setting.findFirst({ where: { crmClientId, key: "wa_qr" } })
    ]);
    return {
      instanceName: instanceSetting?.value ?? null,
      status: statusSetting?.value ?? "disconnected",
      qr: qrSetting?.value ?? null
    };
  }

  @Post(":crmClientId/connect")
  @Roles("admin")
  async connect(@Param("crmClientId") crmClientId: string) {
    const instanceName = `crm-${crmClientId}`;

    await this.prisma.setting.upsert({
      where: { crmClientId_key: { crmClientId, key: "wa_instance_name" } },
      create: { crmClientId, key: "wa_instance_name", value: instanceName },
      update: { value: instanceName }
    });

    // Delete stale QR from previous attempt
    await this.prisma.setting.deleteMany({ where: { crmClientId, key: "wa_qr" } });

    // Check current instance state — avoid recreating a connecting instance
    const current = await this.whatsapp.getInstanceStatus(instanceName);

    if (current?.state === "open") {
      // Already connected — nothing to do
      return { instanceName, qr: null };
    }

    if (current) {
      // Exists but not connected — delete stale session then recreate fresh
      await this.whatsapp.deleteInstance(instanceName).catch((e) => this.logger.warn(`deleteInstance falhou name=${instanceName}: ${e}`));
      await new Promise((r) => setTimeout(r, 500));
    }

    await this.whatsapp.createInstance(instanceName).catch((e) => this.logger.warn(`createInstance falhou name=${instanceName}: ${e}`));

    // v1: QR available via REST immediately after create; also refreshed via qrcode.updated webhook
    await new Promise((r) => setTimeout(r, 3000));
    const qrData = await this.whatsapp.connectInstance(instanceName).catch((e) => {
      this.logger.warn(`connectInstance falhou name=${instanceName}: ${e}`);
      return null;
    });
    if (qrData?.base64) {
      await this.prisma.setting.upsert({
        where: { crmClientId_key: { crmClientId, key: "wa_qr" } },
        create: { crmClientId, key: "wa_qr", value: qrData.base64 },
        update: { value: qrData.base64 }
      });
    }

    return { instanceName, qr: qrData?.base64 ?? null };
  }

  @Get(":crmClientId/qr")
  async getQr(@Param("crmClientId") crmClientId: string) {
    const qrSetting = await this.prisma.setting.findFirst({
      where: { crmClientId, key: "wa_qr" }
    });
    return { qr: qrSetting?.value ?? null };
  }

  @Delete(":crmClientId/disconnect")
  @Roles("admin")
  async disconnect(@Param("crmClientId") crmClientId: string) {
    const setting = await this.prisma.setting.findFirst({
      where: { crmClientId, key: "wa_instance_name" }
    });
    if (setting) {
      await this.whatsapp.deleteInstance(setting.value).catch((e) => this.logger.warn(`disconnect deleteInstance falhou name=${setting.value}: ${e}`));
      await this.prisma.setting.upsert({
        where: { crmClientId_key: { crmClientId, key: "wa_status" } },
        create: { crmClientId, key: "wa_status", value: "disconnected" },
        update: { value: "disconnected" }
      });
    }
    return { ok: true };
  }
}
