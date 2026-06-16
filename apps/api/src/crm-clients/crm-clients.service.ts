import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmClientsService {
  private readonly logger = new Logger(CrmClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    this.logger.log("findAll crm-clients");
    return this.prisma.crmClient.findMany({
      orderBy: { tradeName: "asc" },
      include: {
        _count: {
          select: {
            customers: true,
            conversations: true
          }
        }
      }
    });
  }
}
