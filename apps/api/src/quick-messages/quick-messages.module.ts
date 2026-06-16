import { Module } from "@nestjs/common";
import { QuickMessagesController } from "./quick-messages.controller";
import { QuickMessagesService } from "./quick-messages.service";

@Module({
  controllers: [QuickMessagesController],
  providers: [QuickMessagesService]
})
export class QuickMessagesModule {}
