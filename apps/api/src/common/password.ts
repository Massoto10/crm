import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";

/**
 * Geração e hash de senha temporária.
 *
 * Vive aqui, e não dentro de um service, porque a criação de conta acontece em
 * dois lugares — o CRM criando operador e o painel de plataforma criando o admin
 * de um departamento. Duas implementações de geração de senha divergem: uma
 * ganha um caractere a mais, a outra baixa o custo do bcrypt, e ninguém percebe
 * porque as duas "funcionam".
 */

/** Custo do bcrypt para senha temporária. O seed usa 12 para senha definitiva. */
const BCRYPT_ROUNDS = 10;

/**
 * 14 caracteres alfanuméricos vindos de 12 bytes aleatórios. Sem símbolos de
 * propósito: a senha é ditada por telefone e digitada uma vez antes da troca.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 14);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
