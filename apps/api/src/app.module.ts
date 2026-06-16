import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { CrmClientsModule } from "./crm-clients/crm-clients.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { DepartmentsModule } from "./departments/departments.module";
import { AgentsModule } from "./agents/agents.module";
import { QuickMessagesModule } from "./quick-messages/quick-messages.module";
import { ScheduledMessagesModule } from "./scheduled-messages/scheduled-messages.module";
import { LeadStatusesModule } from "./lead-statuses/lead-statuses.module";
import { LeadSourcesModule } from "./lead-sources/lead-sources.module";
import { SettingsModule } from "./settings/settings.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { EndCustomersModule } from "./end-customers/end-customers.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt.guard";
import { AccessGuard } from "./auth/access.guard";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    CrmClientsModule,
    ConversationsModule,
    DepartmentsModule,
    AgentsModule,
    QuickMessagesModule,
    ScheduledMessagesModule,
    LeadStatusesModule,
    LeadSourcesModule,
    SettingsModule,
    DashboardModule,
    WhatsappModule,
    EndCustomersModule
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }
  ]
})
export class AppModule {}
