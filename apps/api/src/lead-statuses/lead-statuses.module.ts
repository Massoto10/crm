import { Module } from "@nestjs/common";
import { LeadStatusesController } from "./lead-statuses.controller";
import { LeadStatusesService } from "./lead-statuses.service";

@Module({
  controllers: [LeadStatusesController],
  providers: [LeadStatusesService]
})
export class LeadStatusesModule {}
