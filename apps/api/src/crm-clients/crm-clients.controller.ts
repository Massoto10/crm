import { Controller, Get } from "@nestjs/common";
import { CrmClientsService } from "./crm-clients.service";

@Controller("crm-clients")
export class CrmClientsController {
  constructor(private readonly crmClientsService: CrmClientsService) {}

  @Get()
  findAll() {
    return this.crmClientsService.findAll();
  }
}
