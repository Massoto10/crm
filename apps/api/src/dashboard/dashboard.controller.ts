import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { CurrentUser, JwtPayload, RequireView } from "../auth/decorators";
import { DashboardService } from "./dashboard.service";

function parseDate(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new BadRequestException(`Data inválida: ${label}`);
  return d;
}

@Controller("dashboard")
@RequireView("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getMetrics(
    @CurrentUser() user: JwtPayload,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("departmentId") departmentId?: string,
    @Query("agentId") agentId?: string,
    @Query("channelType") channelType?: string
  ) {
    const scope = user.permissions?.scope ?? "own";
    const effectiveAgentId = user.role !== "admin" && scope === "own" ? user.sub : agentId;
    return this.dashboardService.getMetrics({
      crmClientId: user.crmClientId,
      startDate: parseDate(startDate, "startDate"),
      endDate: parseDate(endDate, "endDate"),
      departmentId,
      agentId: effectiveAgentId,
      channelType
    });
  }
}
