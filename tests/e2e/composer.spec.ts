import { expect, test } from "@playwright/test";
import { E2E, seedE2E } from "./seed";

/**
 * Regressao: o compositor de mensagem precisa ter emoji, anexo e audio.
 *
 * A reescrita do front deixou os botoes de emoji e anexo como casca — estavam
 * `disabled` e sem handler — e o de audio nem existia, embora a API sempre
 * tenha aceitado /conversations/:id/media e /conversations/:id/audio.
 *
 * O envio em si termina na Evolution, que nao existe em ambiente de teste, entao
 * o teste verifica ate a fronteira que e nossa: que a UI existe, responde, e
 * dispara a requisicao certa com o payload certo.
 */
test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await seedE2E();
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(E2E.email);
  await page.getByPlaceholder("Digite sua senha").fill(E2E.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("link", { name: "Atendimentos" }).click();
  await expect(page.locator("h1")).toContainText("Atendimentos");
});

test("os tres botoes do compositor estao habilitados", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Emoji" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Anexar arquivo" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeEnabled();
});

test("emoji entra no campo de texto", async ({ page }) => {
  await page.getByRole("button", { name: "Emoji" }).click();
  await page.getByRole("button", { name: "👍", exact: true }).click();
  await expect(page.getByPlaceholder("Digite sua mensagem...")).toHaveValue("👍");
});

test("anexo mostra previa com legenda e dispara POST /media com o payload certo", async ({ page }) => {
  await page.getByRole("button", { name: "Anexar arquivo" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "orcamento.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 conteudo de teste")
  });

  // A previa segura o arquivo ate a confirmacao — enviar sem poder revisar nem
  // legendar era justamente o que queriamos evitar.
  await expect(page.getByText("orcamento.pdf")).toBeVisible();
  await page.getByPlaceholder("Legenda (opcional)").fill("segue o orçamento");

  const requisicao = page.waitForRequest((req) =>
    req.url().includes("/api/conversations/") && req.url().endsWith("/media") && req.method() === "POST"
  );
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  const corpo = JSON.parse((await requisicao).postData() ?? "{}");
  expect(corpo.mediatype).toBe("document");
  expect(corpo.mimetype).toBe("application/pdf");
  expect(corpo.fileName).toBe("orcamento.pdf");
  expect(corpo.caption).toBe("segue o orçamento");
  expect(String(corpo.base64)).toContain("data:application/pdf;base64,");
});

test("imagem e classificada como image, nao como document", async ({ page }) => {
  await page.getByRole("button", { name: "Anexar arquivo" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    // PNG 1x1 valido, para a previa conseguir renderizar.
    buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082", "hex")
  });

  const requisicao = page.waitForRequest((req) => req.url().endsWith("/media") && req.method() === "POST");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  const corpo = JSON.parse((await requisicao).postData() ?? "{}");
  expect(corpo.mediatype).toBe("image");
  expect(corpo.mimetype).toBe("image/png");
  // Sem legenda preenchida, o campo nao vai no payload.
  expect(corpo.caption).toBeUndefined();
});
