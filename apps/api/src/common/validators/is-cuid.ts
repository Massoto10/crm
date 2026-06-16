import { Matches } from "class-validator";

/**
 * IDs do banco são cuid do Prisma (ex: cmq9ko1wg001zo78tgpq7ek84) ou IDs
 * legados do seed (ex: conv_mariana_wpp, cli_studio_rocha). `@IsUUID()`
 * rejeitaria todos — este validador aceita os dois formatos e bloqueia lixo.
 */
export function IsCuid() {
  return Matches(/^[a-z][a-z0-9_-]{5,39}$/i, { message: "$property deve ser um ID válido" });
}
