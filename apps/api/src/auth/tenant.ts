import { NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "./decorators";

/** Never trust a tenant id supplied by the browser. */
export function assertCurrentTenant(user: JwtPayload, crmClientId: string): void {
  if (crmClientId !== user.crmClientId) {
    // A 404 avoids confirming that another tenant exists.
    throw new NotFoundException("Recurso não encontrado");
  }
}
