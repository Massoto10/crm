import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
@Roles("admin")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query("cursor") cursor?: string,
    @Query("limit") rawLimit?: string
  ) {
    const parsedLimit = Number.parseInt(rawLimit ?? "50", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    return this.auditService.list(user.crmClientId, limit, cursor);
  }
}
