import { BadRequestException, Body, Controller, Get, Param, Put } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { Roles } from "../auth/decorators";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(":crmClientId")
  getAll(@Param("crmClientId") crmClientId: string) {
    return this.settingsService.getAll(crmClientId);
  }

  @Put(":crmClientId")
  @Roles("admin")
  upsert(@Param("crmClientId") crmClientId: string, @Body() body: Record<string, unknown>) {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (FORBIDDEN_KEYS.has(k)) throw new BadRequestException(`Chave inválida: ${k}`);
      if (typeof v !== "string") throw new BadRequestException(`Valor da chave "${k}" deve ser texto`);
      if (k.length > 80) throw new BadRequestException(`Chave muito longa: ${k}`);
      if (v.length > 500) throw new BadRequestException(`Valor muito longo para a chave: ${k}`);
      sanitized[k] = v;
    }
    return this.settingsService.upsert(crmClientId, sanitized);
  }
}
