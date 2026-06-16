import { Injectable, Logger } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QuickMessagesService {
  private readonly logger = new Logger(QuickMessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(crmClientId: string, search?: string, departmentId?: string) {
    this.logger.log(`findAll quick-messages crmClientId=${crmClientId}${search ? ` search="${search}"` : ""}`);
    return this.prisma.quickMessage.findMany({
      where: {
        crmClientId,
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
        ...(search
          ? { OR: [{ shortcut: { contains: search, mode: "insensitive" } }, { title: { contains: search, mode: "insensitive" } }] }
          : {})
      },
      orderBy: { shortcut: "asc" }
    });
  }

  create(data: { crmClientId: string; shortcut: string; title: string; body: string; departmentId?: string }) {
    this.logger.log(`create quick-message crmClientId=${data.crmClientId} shortcut=${data.shortcut}`);
    return this.prisma.quickMessage.create({ data });
  }

  async update(id: string, data: { shortcut?: string; title?: string; body?: string; isActive?: boolean }) {
    assertFound(await this.prisma.quickMessage.findUnique({ where: { id } }), "Mensagem rápida");
    const result = await this.prisma.quickMessage.update({ where: { id }, data });
    this.logger.log(`updated quick-message id=${id}`);
    return result;
  }

  async remove(id: string) {
    assertFound(await this.prisma.quickMessage.findUnique({ where: { id } }), "Mensagem rápida");
    const result = await this.prisma.quickMessage.update({ where: { id }, data: { isActive: false } });
    this.logger.log(`soft-deleted quick-message id=${id}`);
    return result;
  }
}
