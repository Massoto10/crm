import { Controller, Get } from "@nestjs/common";
import { CurrentUser, JwtPayload } from "../auth/decorators";
import { CrmClientsService } from "./crm-clients.service";

@Controller("crm-clients")
export class CrmClientsController {
  constructor(private readonly crmClientsService: CrmClientsService) {}

  @Get()
  findCurrent(@CurrentUser() user: JwtPayload) {
    return this.crmClientsService.findCurrent(user.crmClientId);
  }
}
