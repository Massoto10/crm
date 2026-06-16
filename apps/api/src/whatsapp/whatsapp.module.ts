import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";
import { WhatsappController } from "./whatsapp.controller";

@Module({
  imports: [PrismaModule],
  providers: [WhatsappService, WhatsappWebhookService],
  exports: [WhatsappService],
  controllers: [WhatsappController]
})
export class WhatsappModule {}
