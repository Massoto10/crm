import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { assertFound } from "../common/assert-found";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EndCustomersService {
  private readonly logger = new Logger(EndCustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(crmClientId: string | undefined, query: string, limit = 15) {
    if (!crmClientId) throw new BadRequestException("crmClientId obrigatório");
    const q = query.trim();
    this.logger.log(`search crmClientId=${crmClientId} q="${q}" limit=${limit}`);
    return this.prisma.endCustomer.findMany({
      where: {
        crmClientId,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q.replace(/\D/g, "") || q } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        phone: true,
        whatsappJid: true,
        instagramHandle: true,
        email: true,
        leadTemperature: true,
        priority: true
      },
      orderBy: { lastContactAt: "desc" },
      take: limit
    });
  }

  private async assertCustomerInOrg(endCustomerId: string, crmClientId: string) {
    const c = await this.prisma.endCustomer.findUnique({ where: { id: endCustomerId }, select: { id: true, crmClientId: true } });
    assertFound(c, "Cliente");
    if (c.crmClientId !== crmClientId) throw new NotFoundException("Cliente não encontrado");
  }

  // ── Etiquetas ──────────────────────────────────────────────
  async addLabel(endCustomerId: string, crmClientId: string, name: string, color: string) {
    await this.assertCustomerInOrg(endCustomerId, crmClientId);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Nome da etiqueta é obrigatório");
    this.logger.log(`addLabel endCustomerId=${endCustomerId} name=${trimmed}`);
    // Reusa a etiqueta da org (mesmo nome) ou cria
    const label = await this.prisma.label.upsert({
      where: { crmClientId_name: { crmClientId, name: trimmed } },
      create: { crmClientId, name: trimmed, color, category: "profile" },
      update: {}
    });
    await this.prisma.endCustomerLabel
      .create({ data: { endCustomerId, labelId: label.id } })
      .catch((err: unknown) => {
        // já vinculada — ignora P2002
        if (!(typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002")) throw err;
      });
    return label;
  }

  async removeLabel(endCustomerId: string, labelId: string, crmClientId: string) {
    await this.assertCustomerInOrg(endCustomerId, crmClientId);
    this.logger.log(`removeLabel endCustomerId=${endCustomerId} labelId=${labelId}`);
    await this.prisma.endCustomerLabel.deleteMany({ where: { endCustomerId, labelId } });
    return { ok: true };
  }

  // ── Próximas ações (tasks) ─────────────────────────────────
  async addTask(endCustomerId: string, crmClientId: string, title: string, ownerName: string) {
    await this.assertCustomerInOrg(endCustomerId, crmClientId);
    const trimmed = title.trim();
    if (!trimmed) throw new BadRequestException("Título da ação é obrigatório");
    this.logger.log(`addTask endCustomerId=${endCustomerId} title=${trimmed}`);
    return this.prisma.task.create({
      data: { crmClientId, endCustomerId, title: trimmed, status: "open", ownerName: ownerName || "Agente" }
    });
  }

  async toggleTask(taskId: string, crmClientId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true, crmClientId: true, status: true } });
    assertFound(task, "Ação");
    if (task.crmClientId !== crmClientId) throw new NotFoundException("Ação não encontrada");
    const next = task.status === "done" ? "open" : "done";
    this.logger.log(`toggleTask id=${taskId} -> ${next}`);
    return this.prisma.task.update({ where: { id: taskId }, data: { status: next } });
  }

  async removeTask(taskId: string, crmClientId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true, crmClientId: true } });
    assertFound(task, "Ação");
    if (task.crmClientId !== crmClientId) throw new NotFoundException("Ação não encontrada");
    this.logger.log(`removeTask id=${taskId}`);
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true };
  }

  async remove(id: string, crmClientId: string) {
    const customer = await this.prisma.endCustomer.findUnique({ where: { id }, select: { id: true, crmClientId: true } });
    assertFound(customer, "Cliente");
    if (customer.crmClientId !== crmClientId) throw new NotFoundException("Cliente não encontrado");
    // Remove dependências e o cliente numa transação (mensagens caem por cascade da conversa).
    await this.prisma.$transaction([
      this.prisma.scheduledMessage.deleteMany({ where: { endCustomerId: id } }),
      this.prisma.task.deleteMany({ where: { endCustomerId: id } }),
      this.prisma.endCustomerLabel.deleteMany({ where: { endCustomerId: id } }),
      this.prisma.conversation.deleteMany({ where: { endCustomerId: id } }),
      this.prisma.endCustomer.delete({ where: { id } })
    ]);
    this.logger.warn(`removed endCustomer id=${id} crmClientId=${crmClientId}`);
    return { ok: true };
  }

  async patch(id: string, data: { estimatedValueCents?: number; assignedTo?: string | null; pipelineStageId?: string | null }, crmClientId: string) {
    this.logger.log(`patch endCustomerId=${id} crmClientId=${crmClientId}`);
    const customer = await this.prisma.endCustomer.findUnique({ where: { id }, select: { id: true, crmClientId: true } });
    assertFound(customer, "Cliente");
    if (customer.crmClientId !== crmClientId) throw new NotFoundException("Cliente não encontrado");
    return this.prisma.endCustomer.update({ where: { id }, data });
  }

  async findDuplicates(crmClientId: string) {
    this.logger.log(`findDuplicates crmClientId=${crmClientId}`);
    const all = await this.prisma.endCustomer.findMany({
      where: { crmClientId },
      select: { id: true, fullName: true, phone: true, whatsappJid: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    });

    const byPhone = new Map<string, typeof all>();
    for (const c of all) {
      if (!c.phone) continue;
      if (!byPhone.has(c.phone)) byPhone.set(c.phone, []);
      byPhone.get(c.phone)!.push(c);
    }

    return Array.from(byPhone.entries())
      .filter(([, group]) => group.length > 1)
      .map(([phone, customers]) => ({ phone, customers }));
  }

  async merge(primaryId: string, duplicateId: string, crmClientId: string) {
    this.logger.log(`merge primary=${primaryId} dupe=${duplicateId} crmClientId=${crmClientId}`);
    if (primaryId === duplicateId) throw new BadRequestException("Não é possível mesclar um cliente com ele mesmo");

    const [primary, dupe] = await Promise.all([
      this.prisma.endCustomer.findUnique({ where: { id: primaryId } }),
      this.prisma.endCustomer.findUnique({ where: { id: duplicateId } })
    ]);
    assertFound(primary, "Cliente principal");
    assertFound(dupe, "Cliente duplicado");
    if (primary.crmClientId !== crmClientId || dupe.crmClientId !== crmClientId) {
      throw new BadRequestException("Clientes não pertencem à sua organização");
    }

    const [primaryLabels, dupeLabels] = await Promise.all([
      this.prisma.endCustomerLabel.findMany({ where: { endCustomerId: primaryId } }),
      this.prisma.endCustomerLabel.findMany({ where: { endCustomerId: duplicateId } })
    ]);
    const primaryLabelIds = new Set(primaryLabels.map((l) => l.labelId));
    const newLabels = dupeLabels.filter((l) => !primaryLabelIds.has(l.labelId));

    const backfill: Record<string, string> = {};
    if (!primary.whatsappJid && dupe.whatsappJid) backfill.whatsappJid = dupe.whatsappJid;
    if (!primary.phone && dupe.phone) backfill.phone = dupe.phone;
    if (!primary.email && dupe.email) backfill.email = dupe.email;
    if (!primary.companyName && dupe.companyName) backfill.companyName = dupe.companyName;

    try {
      await this.prisma.$transaction([
        this.prisma.conversation.updateMany({ where: { endCustomerId: duplicateId }, data: { endCustomerId: primaryId } }),
        this.prisma.task.updateMany({ where: { endCustomerId: duplicateId }, data: { endCustomerId: primaryId } }),
        this.prisma.scheduledMessage.updateMany({ where: { endCustomerId: duplicateId }, data: { endCustomerId: primaryId } }),
        ...newLabels.map((l) => this.prisma.endCustomerLabel.create({ data: { endCustomerId: primaryId, labelId: l.labelId } })),
        ...(Object.keys(backfill).length ? [this.prisma.endCustomer.update({ where: { id: primaryId }, data: backfill })] : []),
        this.prisma.endCustomer.delete({ where: { id: duplicateId } })
      ]);
    } catch (err) {
      this.logger.error(`merge falhou primary=${primaryId} dupe=${duplicateId}: ${String(err)}`);
      throw err;
    }

    this.logger.log(`merge ok dupe=${duplicateId} -> primary=${primaryId}`);
    return { merged: duplicateId, into: primaryId };
  }
}
