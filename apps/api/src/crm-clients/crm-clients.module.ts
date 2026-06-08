import { Module } from "@nestjs/common";
import { CrmClientsController } from "./crm-clients.controller";
import { CrmClientsService } from "./crm-clients.service";

@Module({
  controllers: [CrmClientsController],
  providers: [CrmClientsService]
})
export class CrmClientsModule {}
