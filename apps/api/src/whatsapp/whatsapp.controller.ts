import { BadRequestException, Body, Controller, Get, Logger, Param, Post, Delete, Query, UnauthorizedException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentUser, JwtPayload, Public, Roles } from "../auth/decorators";
import { assertCurrentTenant } from "../auth/tenant";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

@Controller("whatsapp")
@Roles("admin")
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
    if (received !== expected) {
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
  async getStatus(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string) {
    assertCurrentTenant(user, crmClientId);
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

  // Garante uma instância nova (ou reaproveita a já conectada) antes de connect/pareamento.
  // Retorna "open" se já estava conectada, "fresh" se criou/recriou a sessão.
  private async prepareInstance(crmClientId: string, instanceName: string, number?: string): Promise<"open" | "fresh"> {
    await this.prisma.setting.upsert({
      where: { crmClientId_key: { crmClientId, key: "wa_instance_name" } },
      create: { crmClientId, key: "wa_instance_name", value: instanceName },
      update: { value: instanceName }
    });

    // Delete stale QR from previous attempt
    await this.prisma.setting.deleteMany({ where: { crmClientId, key: "wa_qr" } });

    // Check current instance state — avoid recreating a connecting instance
    const current = await this.whatsapp.getInstanceStatus(instanceName);
    if (current?.state === "open") return "open";

    // Para pareamento por código o Evolution só devolve o pairingCode quando a
    // instância é criada COM o número, então recriamos sempre nesse fluxo.
    if (current || number) {
      await this.whatsapp.deleteInstance(instanceName).catch((e) => this.logger.warn(`deleteInstance falhou name=${instanceName}: ${e}`));
      await new Promise((r) => setTimeout(r, 500));
    }

    await this.whatsapp.createInstance(instanceName, number).catch((e) => this.logger.warn(`createInstance falhou name=${instanceName}: ${e}`));
    return "fresh";
  }

  @Post(":crmClientId/connect")
  @Roles("admin")
  async connect(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string) {
    assertCurrentTenant(user, crmClientId);
    const instanceName = `crm-${crmClientId}`;

    if ((await this.prepareInstance(crmClientId, instanceName)) === "open") {
      return { instanceName, qr: null };
    }

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

  // Login por código de pareamento (alternativa ao QR). Recebe o número do
  // aparelho e devolve um código pra digitar no WhatsApp: Aparelhos conectados
  // → Conectar com número de telefone.
  @Post(":crmClientId/connect-code")
  @Roles("admin")
  async connectWithCode(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string, @Body() body: { phone?: string }) {
    assertCurrentTenant(user, crmClientId);
    const phone = body?.phone?.trim();
    if (!phone) throw new BadRequestException("Número de telefone é obrigatório");

    const instanceName = `crm-${crmClientId}`;

    if ((await this.prepareInstance(crmClientId, instanceName, phone)) === "open") {
      return { instanceName, pairingCode: null, alreadyConnected: true };
    }

    // Aguarda a instância subir antes de pedir o código de pareamento
    await new Promise((r) => setTimeout(r, 3000));
    const { pairingCode } = await this.whatsapp.requestPairingCode(instanceName, phone).catch((e) => {
      this.logger.warn(`requestPairingCode falhou name=${instanceName}: ${e}`);
      return { pairingCode: null };
    });

    return { instanceName, pairingCode };
  }

  @Get(":crmClientId/qr")
  async getQr(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string) {
    assertCurrentTenant(user, crmClientId);
    const qrSetting = await this.prisma.setting.findFirst({
      where: { crmClientId, key: "wa_qr" }
    });
    return { qr: qrSetting?.value ?? null };
  }

  @Delete(":crmClientId/disconnect")
  @Roles("admin")
  async disconnect(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string) {
    assertCurrentTenant(user, crmClientId);
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
    // Ao desconectar, zera as conversas/mensagens do WhatsApp do número antigo
    // (mensagens caem por cascade). Não mexe em Instagram nem em contatos.
    const wiped = await this.prisma.conversation.deleteMany({
      where: { crmClientId, channelType: "whatsapp" }
    });
    this.logger.warn(`disconnect wipe crmClientId=${crmClientId} conversas_whatsapp=${wiped.count}`);
    return { ok: true, wipedConversations: wiped.count };
  }
}
