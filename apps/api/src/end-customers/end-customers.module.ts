import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EndCustomersController } from "./end-customers.controller";
import { EndCustomersService } from "./end-customers.service";

@Module({
  imports: [PrismaModule],
  controllers: [EndCustomersController],
  providers: [EndCustomersService]
})
export class EndCustomersModule {}
