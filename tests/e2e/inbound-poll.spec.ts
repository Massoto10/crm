import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E, seedE2E } from "./seed";

/**
 * Regressao: mensagem que chega pelo WhatsApp precisa aparecer na tela SEM o
 * operador recarregar a pagina.
 *
 * O webhook grava direto no banco, entao o navegador nao fica sabendo de nada
 * por conta propria. A reescrita do front perdeu o poll que existia antes, e o
 * sintoma para quem usa foi exatamente "o CRM nao recebe mensagem": a mensagem
 * chegava, ficava gravada, e a tela nunca mudava ate um F5.
 *
 * A mensagem e inserida direto no banco de proposito — simula o webhook e prova
 * que a tela reage a mudanca no banco, nao a uma acao do proprio navegador.
 */
const prisma = new PrismaClient();

test.setTimeout(90_000);

test("mensagem recebida aparece na lista sem recarregar a pagina", async ({ page }) => {
  await seedE2E();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E.email);
  await page.getByLabel("Senha", { exact: true }).fill(E2E.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");

  await page.getByRole("link", { name: "Atendimentos" }).click();
  await expect(page.locator("h1")).toContainText("Atendimentos");

  const conversa = await prisma.conversation.findFirst({ orderBy: { lastMessageAt: "desc" } });
  expect(conversa, "o seed precisa criar ao menos uma conversa").not.toBeNull();

  // Mensagem de cliente entra como `pending`; a aba precisa ser a mesma, senao
  // o teste passaria/falharia por causa do filtro e nao por causa do poll.
  await prisma.conversation.update({ where: { id: conversa!.id }, data: { status: "pending" } });
  await page.getByRole("button", { name: /Pendente/ }).first().click();

  const texto = `chegou-sem-reload-${Date.now()}`;

  // Daqui para baixo nao ha nenhuma interacao com a pagina: se o texto
  // aparecer, foi o poll que o trouxe.
  await prisma.message.create({
    data: {
      conversationId: conversa!.id,
      senderType: "end_customer",
      senderName: "Cliente Teste",
      body: texto,
      sentAt: new Date()
    }
  });
  await prisma.conversation.update({
    where: { id: conversa!.id },
    data: {
      lastMessagePreview: texto,
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 }
    }
  });

  // Janela generosa: o intervalo do poll e 8s.
  await expect(page.getByText(texto).first()).toBeVisible({ timeout: 40_000 });

  await prisma.$disconnect();
});
