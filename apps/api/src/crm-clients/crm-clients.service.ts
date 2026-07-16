import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmClientsService {
  private readonly logger = new Logger(CrmClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findCurrent(crmClientId: string) {
    this.logger.log(`findCurrent crmClientId=${crmClientId}`);
    return this.prisma.crmClient.findUnique({
      where: { id: crmClientId },
      select: { id: true, tradeName: true, legalName: true, planName: true, status: true }
    });
  }
}
