import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { ScheduledMessagesController } from "./scheduled-messages.controller";
import { ScheduledMessagesService } from "./scheduled-messages.service";

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService]
})
export class ScheduledMessagesModule {}
