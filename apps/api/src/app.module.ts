import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { CrmClientsModule } from "./crm-clients/crm-clients.module";
import { ConversationsModule } from "./conversations/conversations.module";

@Module({
  imports: [PrismaModule, CrmClientsModule, ConversationsModule],
  controllers: [AppController]
})
export class AppModule {}
