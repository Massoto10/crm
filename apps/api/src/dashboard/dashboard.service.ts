import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface DashboardFilters {
  crmClientId?: string;
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  agentId?: string;
  channelType?: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(filters: DashboardFilters) {
    this.logger.log(`getMetrics filters=${JSON.stringify(filters)}`);
    const where: Prisma.ConversationWhereInput = {};
    if (filters.crmClientId) where.crmClientId = filters.crmClientId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.agentId) where.assignedAgentId = filters.agentId;
    if (filters.channelType) where.channelType = filters.channelType as Prisma.EnumChannelTypeFilter;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {})
      };
    }

    const [totalConversations, byStatus, byChannel, byDepartment, closedConvs, agentVolume, allConvs] =
      await Promise.all([
        this.prisma.conversation.count({ where }),
        this.prisma.conversation.groupBy({ by: ["status"], where, _count: { _all: true } }),
        this.prisma.conversation.groupBy({ by: ["channelType"], where, _count: { _all: true } }),
        this.prisma.conversation.groupBy({ by: ["departmentId"], where, _count: { _all: true } }),
        this.prisma.conversation.findMany({
          where: { ...where, status: "closed", closedAt: { not: null } },
          select: {
            createdAt: true,
            closedAt: true,
            messages: { orderBy: { sentAt: "asc" }, take: 1, where: { senderType: "agent" }, select: { sentAt: true } }
          }
        }),
        this.prisma.conversation.groupBy({
          by: ["assignedAgentId"],
          where: { ...where, assignedAgentId: { not: null } },
          _count: { _all: true }
        }),
        this.prisma.conversation.findMany({
          where,
          select: {
            createdAt: true,
            endCustomer: { select: { leadSourceId: true, leadSource: { select: { name: true, color: true } } } }
          }
        })
      ]);

    const avgAttendanceTimeSeconds = this.calcAvgMs(
      closedConvs.map((c) => ({ from: c.createdAt, to: c.closedAt! }))
    );
    const avgFirstResponseSeconds = this.calcAvgMs(
      closedConvs.filter((c) => c.messages[0]).map((c) => ({ from: c.createdAt, to: c.messages[0].sentAt }))
    );

    const agentIds = agentVolume.filter((a) => a.assignedAgentId).map((a) => a.assignedAgentId as string);
    const deptIds = byDepartment.filter((d) => d.departmentId).map((d) => d.departmentId as string);

    const [agents, depts] = await Promise.all([
      agentIds.length ? this.prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } }) : [],
      deptIds.length ? this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : []
    ]);

    const agentMap = Object.fromEntries(agents.map((a) => [a.id, a.name]));
    const deptMap = Object.fromEntries(depts.map((d) => [d.id, d.name]));

    // Leads por origem (agregado em JS — origem fica no endCustomer, não dá groupBy direto)
    const originAgg = new Map<string, { name: string; color: string; count: number }>();
    for (const c of allConvs) {
      const src = c.endCustomer?.leadSource;
      const key = c.endCustomer?.leadSourceId ?? "none";
      const name = src?.name ?? "Direto";
      const color = src?.color ?? "#94a7ad";
      const cur = originAgg.get(key) ?? { name, color, count: 0 };
      cur.count++;
      originAgg.set(key, cur);
    }
    const byOrigin = Array.from(originAgg.entries())
      .map(([sourceId, v]) => ({
        sourceId: sourceId === "none" ? null : sourceId,
        sourceName: v.name,
        color: v.color,
        count: v.count,
        percentage: totalConversations ? Math.round((v.count / totalConversations) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalConversations,
      avgAttendanceTimeSeconds,
      avgFirstResponseSeconds,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byChannel: byChannel.map((c) => ({
        channel: c.channelType,
        count: c._count._all,
        percentage: totalConversations ? Math.round((c._count._all / totalConversations) * 100) : 0
      })),
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentId ? (deptMap[d.departmentId] ?? "Sem departamento") : "Sem departamento",
        count: d._count._all,
        percentage: totalConversations ? Math.round((d._count._all / totalConversations) * 100) : 0
      })),
      byOrigin,
      volumeByDay: this.groupByDay(allConvs.map((c) => c.createdAt)),
      volumeByHour: this.groupByHour(allConvs.map((c) => c.createdAt)),
      byAgent: agentVolume.map((a) => ({
        agentId: a.assignedAgentId,
        agentName: a.assignedAgentId ? (agentMap[a.assignedAgentId] ?? "Desconhecido") : "Nao atribuido",
        count: a._count._all
      }))
    };
  }

  private calcAvgMs(pairs: Array<{ from: Date; to: Date }>): number {
    if (!pairs.length) return 0;
    return Math.round(pairs.reduce((s, p) => s + (p.to.getTime() - p.from.getTime()), 0) / pairs.length / 1000);
  }

  private groupByDay(dates: Date[]) {
    const map = new Map<string, number>();
    for (const d of dates) {
      const k = d.toISOString().split("T")[0];
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  private groupByHour(dates: Date[]) {
    const map = new Map<number, number>();
    for (const d of dates) map.set(d.getHours(), (map.get(d.getHours()) ?? 0) + 1);
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map.get(h) ?? 0 }));
  }
}
