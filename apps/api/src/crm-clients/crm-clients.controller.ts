import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/decorators";
import { CrmClientsService } from "./crm-clients.service";

@Controller("crm-clients")
export class CrmClientsController {
  constructor(private readonly crmClientsService: CrmClientsService) {}

  @Public()
  @Get()
  findAll() {
    return this.crmClientsService.findAll();
  }
}
