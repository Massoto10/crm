import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
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
