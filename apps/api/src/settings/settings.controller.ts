import { BadRequestException, Body, Controller, Get, Param, Put } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";
import { assertCurrentTenant } from "../auth/tenant";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ALLOWED_KEYS = new Set([
  "appearance_theme",
  "company_email",
  "company_phone",
  "locale",
  "pipeline_auto_enabled",
  "pipeline_proposta_keywords",
  "pipeline_qualificacao_keywords",
  "post_closure_department_id",
  "post_closure_return_days",
  "security_access_notifications",
  "timezone",
  "trigger_close_enabled",
  "trigger_close_keywords",
  "trigger_value_enabled",
  "trigger_value_keywords"
]);
const MAX_SETTINGS_PER_REQUEST = 20;

@Controller("settings")
@Roles("admin")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(":crmClientId")
  getAll(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string) {
    assertCurrentTenant(user, crmClientId);
    return this.settingsService.getAll(user.crmClientId);
  }

  @Put(":crmClientId")
  upsert(@CurrentUser() user: JwtPayload, @Param("crmClientId") crmClientId: string, @Body() body: Record<string, unknown>) {
    assertCurrentTenant(user, crmClientId);
    const keys = Object.keys(body);
    if (keys.length > MAX_SETTINGS_PER_REQUEST) {
      throw new BadRequestException(`Maximum ${MAX_SETTINGS_PER_REQUEST} settings per request`);
    }
    const unsupportedKey = keys.find((key) => !ALLOWED_KEYS.has(key));
    if (unsupportedKey) throw new BadRequestException(`Unsupported setting: ${unsupportedKey}`);

    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (FORBIDDEN_KEYS.has(k)) throw new BadRequestException(`Chave inválida: ${k}`);
      if (typeof v !== "string") throw new BadRequestException(`Valor da chave "${k}" deve ser texto`);
      if (k.length > 80) throw new BadRequestException(`Chave muito longa: ${k}`);
      if (v.length > 500) throw new BadRequestException(`Valor muito longo para a chave: ${k}`);
      sanitized[k] = v;
    }
    return this.settingsService.upsert(user.crmClientId, sanitized);
  }
}
