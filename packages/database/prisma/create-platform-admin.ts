import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/**
 * Cria (ou atualiza) um administrador da plataforma.
 *
 * Existe como script de linha de comando, e NÃO como endpoint HTTP, de
 * propósito. Uma rota do tipo "cria o primeiro admin se ainda não existir
 * nenhum" parece segura enquanto a tabela tem linhas — mas basta um wipe
 * parcial, uma restauração de backup malfeita ou uma corrida entre duas
 * requisições para ela virar uma porta dos fundos permanente, exposta na
 * internet, que cria conta com poder sobre todos os departamentos.
 *
 * Diferente do seed.ts, este script NÃO é destrutivo: faz upsert por e-mail e
 * pode ser rodado quantas vezes for preciso, inclusive para trocar a senha de
 * um admin que se perdeu.
 *
 * Uso:
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... \
 *     npx tsx prisma/create-platform-admin.ts
 *
 * Na VPS:
 *   docker exec -e PLATFORM_ADMIN_EMAIL=... -e PLATFORM_ADMIN_PASSWORD=... \
 *     crm-api npx tsx packages/database/prisma/create-platform-admin.ts
 */

const prisma = new PrismaClient();

// Mais alto que o custo 10 da senha temporária de operador: esta é uma senha
// definitiva, digitada com pouca frequência, numa conta com poder sobre todos
// os departamentos. O seed.ts já usa 12 pelo mesmo motivo.
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 16;

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Administrador da plataforma";

  if (!email || !email.includes("@")) {
    throw new Error("Defina PLATFORM_ADMIN_EMAIL com um e-mail válido.");
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Defina PLATFORM_ADMIN_PASSWORD com pelo menos ${MIN_PASSWORD_LENGTH} caracteres. ` +
        "Esta conta administra todos os departamentos — não reaproveite a senha do CRM."
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existente = await prisma.platformAdmin.findUnique({ where: { email } });

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { name, email, passwordHash, role: "owner", isActive: true },
    // Trocar a senha precisa derrubar as sessões vivas daquele admin, senão um
    // token roubado continua valendo por até 15 minutos depois da troca.
    update: { name, passwordHash, isActive: true, authVersion: { increment: 1 } },
    select: { id: true, email: true, name: true, role: true }
  });

  console.log(existente ? "Admin da plataforma ATUALIZADO:" : "Admin da plataforma CRIADO:");
  console.log(`  ${admin.name} <${admin.email}>  papel=${admin.role}  id=${admin.id}`);
  if (existente) console.log("  Sessões anteriores desta conta foram revogadas.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
