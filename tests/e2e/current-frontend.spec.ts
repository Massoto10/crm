import { expect, test, type Page } from "@playwright/test";
import { E2E, seedE2E } from "./seed";

test.setTimeout(90_000);

const apiBase = "http://localhost:4334/api";

async function login(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta!" })).toBeVisible();
  await page.getByPlaceholder("seu@email.com").fill(E2E.email);
  await page.getByPlaceholder("Digite sua senha").fill(E2E.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator("h1")).toContainText("Admin");
}

async function goTo(page: Page, label: string, heading: string) {
  await page.getByRole("link", { name: label }).click();
  await expect(page.locator("h1")).toContainText(heading);
}

test("front atual autentica, navega e grava dados no Postgres sem mocks", async ({ page }) => {
  const consoleErrors: string[] = [];
  const apiErrors: Array<{ url: string; status: number }> = [];
  await seedE2E();
  await login(page);
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon/i.test(message.text())) consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const expectedUnauthenticatedBootstrap = response.url().endsWith("/api/auth/me") && response.status() === 401;
    if (response.url().includes("localhost:4334/api") && response.status() >= 400 && !expectedUnauthenticatedBootstrap) {
      apiErrors.push({ url: response.url(), status: response.status() });
    }
  });

  await expect(page.getByText("Conversas abertas")).toBeVisible();
  await expect(page.locator("main").getByText("Contatos", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  const stageOneResponse = await page.request.post(`${apiBase}/pipeline-stages`, {
    data: { name: "Qualification E2E", color: "#2563eb", order: 1 },
    headers: { Origin: "http://localhost:4010" },
  });
  expect(stageOneResponse.status()).toBe(201);
  const stageOne = await stageOneResponse.json() as { id: string };
  const stageTwoResponse = await page.request.post(`${apiBase}/pipeline-stages`, {
    data: { name: "Proposal E2E", color: "#22c55e", order: 2 },
    headers: { Origin: "http://localhost:4010" },
  });
  expect(stageTwoResponse.status()).toBe(201);
  const stageTwo = await stageTwoResponse.json() as { id: string };

  await page.reload();
  await expect(page.locator("h1")).toContainText("Admin");

  await goTo(page, "Contatos", "Contatos");
  await page.getByRole("button", { name: /Novo contato/ }).click();
  await page.getByLabel("Nome completo").fill("Contato E2E");
  await page.getByLabel("Telefone").fill("11999990000");
  await page.getByLabel("E-mail").fill("contato.e2e@crm.test");
  await page.getByLabel("Etapa inicial").selectOption(stageOne.id);
  await page.getByLabel("Valor estimado").fill("2500");
  await page.getByRole("button", { name: "Criar contato" }).click();
  await expect(page.getByText("Contato criado no banco com sucesso.")).toBeVisible();
  await expect(page.getByText("Contato E2E", { exact: true })).toBeVisible();

  await goTo(page, "Funil de vendas", "Funil de vendas");
  await expect(page.getByText("Qualification E2E", { exact: true })).toBeVisible();
  await expect(page.getByText("Proposal E2E", { exact: true })).toBeVisible();
  const contactCard = page.locator(".kanban-card").filter({ hasText: "Contato E2E" });
  const proposalColumn = page.locator(".kanban-column").filter({ hasText: "Proposal E2E" });
  await contactCard.dragTo(proposalColumn);
  await expect(page.getByText("Contato movido para Proposal E2E.")).toBeVisible();
  const customersResponse = await page.request.get(`${apiBase}/end-customers?limit=100`);
  expect(customersResponse.ok()).toBe(true);
  const customers = await customersResponse.json() as Array<{ fullName: string; pipelineStage?: { id: string } | null }>;
  expect(customers.find((customer) => customer.fullName === "Contato E2E")?.pipelineStage?.id).toBe(stageTwo.id);

  await goTo(page, "Agendamentos", "Agendamentos");
  await page.getByRole("button", { name: /Novo agendamento/ }).click();
  await page.getByLabel("Mensagem").fill("Follow-up E2E persisted");
  await page.getByLabel("Cliente").selectOption({ label: "Cliente Ativo" });
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByText("Agendamento gravado no banco.")).toBeVisible();
  await expect(page.getByText("Follow-up E2E persisted", { exact: true })).toBeVisible();

  await goTo(page, "Equipe", "Equipe");
  await page.getByRole("button", { name: /Novo operador/ }).click();
  await page.getByLabel("Nome completo").fill("Operador E2E");
  await page.getByLabel("E-mail de acesso").fill("operador.e2e@crm.test");
  await page.getByRole("button", { name: "Criar operador" }).click();
  await expect(page.getByText("Operador criado no banco.")).toBeVisible();
  await expect(page.getByText("Operador E2E", { exact: true })).toBeVisible();

  await page.locator('a[href="/configuracoes"]').click();
  await expect(page.locator("h1")).toBeVisible();
  await page.getByPlaceholder("contato@empresa.com").fill("operacao.e2e@crm.test");
  await page.getByRole("button", { name: /Salvar/ }).click();
  await expect(page.getByText(/salvas no banco/)).toBeVisible();
  const meResponse = await page.request.get(`${apiBase}/auth/me`);
  const me = await meResponse.json() as { crmClientId: string };
  const settingsResponse = await page.request.get(`${apiBase}/settings/${me.crmClientId}`);
  expect(settingsResponse.ok()).toBe(true);
  expect((await settingsResponse.json() as Record<string, string>).company_email).toBe("operacao.e2e@crm.test");

  await goTo(page, "Atendimentos", "Atendimentos");
  await page.locator(".conversation-tabs button").filter({ hasText: "Pendente" }).click();
  await page.locator(".conversation-list button").filter({ hasText: "Cliente Pendente" }).click();
  await expect(page.getByText("bom dia", { exact: true })).toBeVisible();
  await expect(page.locator("img[alt='Imagem recebida']").first()).toBeVisible();
  await expect(page.locator("img[alt='Figurinha recebida']")).toBeVisible();
  await expect(page.locator("audio.message-audio")).toBeVisible();
  await expect(page.locator("video.message-video")).toBeVisible();
  await expect(page.getByRole("link", { name: /contrato\.pdf/i })).toBeVisible();
  await page.getByRole("button", { name: /Fechar conversa/ }).click();
  await expect(page.getByText("Conversa encerrada no banco.")).toBeVisible();
  const conversationsResponse = await page.request.get(`${apiBase}/conversations`);
  expect(conversationsResponse.ok()).toBe(true);
  const conversations = await conversationsResponse.json() as Array<{ status: string; endCustomer: { fullName: string } }>;
  expect(conversations.find((conversation) => conversation.endCustomer.fullName === "Cliente Pendente")?.status).toBe("closed");

  expect(apiErrors, `HTTP errors from the interface: ${JSON.stringify(apiErrors)}`).toHaveLength(0);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toHaveLength(0);
});
