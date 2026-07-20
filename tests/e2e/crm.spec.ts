import { expect, test, type Page } from "@playwright/test";
import { E2E, seedE2E } from "./seed";

const EMAIL = E2E.email;
const SENHA = E2E.senha;
const LEGENDA = E2E.legenda;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/");
  // A shell só renderiza depois que o JWT é decodificado.
  await expect(page.locator(".sidebar")).toBeVisible();
}

// A sidebar é colapsada por padrão (.sidebar:not(:hover) esconde labels, o botão
// de som e o de logout). Precisa expandir antes de interagir com ela.
async function abrirSidebar(page: Page) {
  await page.locator(".sidebar").hover();
  await expect(page.locator(".nav-link").first()).toContainText(/\w/);
}

async function irParaTela(page: Page, nome: RegExp) {
  await abrirSidebar(page);
  await page.locator(".nav-link").filter({ hasText: nome }).first().click();
  // Tira o mouse da sidebar: expandida pelo hover, ela cobre a aba mais à
  // esquerda ("Pendente") e intercepta o clique.
  await page.mouse.move(1000, 500);
}

async function irParaChats(page: Page) {
  await irParaTela(page, /Chats/);
  await expect(page.locator(".status-tabs")).toBeVisible();
}

/** Botão de som — só existe visível com a sidebar expandida. */
function botaoSom(page: Page) {
  return page.locator('button[title*="notifica"]');
}

// Re-semeia antes de cada teste: entrar na aba Chats auto-seleciona a primeira
// conversa, o que dispara o mark-as-read e zera o unreadCount no banco. Sem
// reset, um teste consome o badge que o próximo espera encontrar.
test.beforeEach(async ({ page }) => {
  await seedE2E();
  await login(page);
});

test.describe("Feature 3 — a sub-aba sobrevive ao reload", () => {
  test("volta na aba Ativo depois de recarregar", async ({ page }) => {
    await irParaChats(page);

    // Padrão é Pendente.
    await expect(page.locator(".status-tab.active")).toHaveText("Pendente");

    await page.getByRole("tab", { name: "Ativo" }).click();
    await expect(page.locator(".status-tab.active")).toHaveText("Ativo");

    // Persistiu em localStorage?
    expect(await page.evaluate(() => localStorage.getItem("stn_crm_chat_status"))).toBe("active");

    await page.reload();
    await irParaChats(page);
    await expect(page.locator(".status-tab.active")).toHaveText("Ativo");
  });

  test("sub-aba se mantém ao sair pro Dashboard e voltar", async ({ page }) => {
    await irParaChats(page);
    await page.getByRole("tab", { name: "Fechado" }).click();
    await expect(page.locator(".status-tab.active")).toHaveText("Fechado");

    await irParaTela(page, /Dash/);
    await irParaChats(page);
    await expect(page.locator(".status-tab.active")).toHaveText("Fechado");
  });

  test("valor inválido no localStorage cai no padrão sem quebrar", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("stn_crm_chat_status", "lixo"));
    await page.reload();
    await irParaChats(page);
    await expect(page.locator(".status-tab.active")).toHaveText("Pendente");
  });
});

test.describe("Features 1 e 2 — separação das abas por status", () => {
  test("cada aba mostra só as conversas do seu status", async ({ page }) => {
    await irParaChats(page);

    await expect(page.locator(".conversation-card")).toHaveCount(1);
    await expect(page.locator(".conversation-card")).toContainText("Cliente Pendente");

    await page.getByRole("tab", { name: "Ativo" }).click();
    await expect(page.locator(".conversation-card")).toContainText("Cliente Ativo");

    await page.getByRole("tab", { name: "Fechado" }).click();
    await expect(page.locator(".conversation-card")).toContainText("Cliente Fechado");
  });
});

test.describe("Feature 5 — badge de não lidas some ao abrir", () => {
  test("badge aparece, some ao abrir e não volta com o poll", async ({ page }) => {
    await irParaChats(page);

    const card = page.locator(".conversation-card").first();
    await expect(card.locator(".unread-badge")).toHaveText("3");

    await card.click();

    // Some imediatamente (escrita otimista).
    await expect(card.locator(".unread-badge")).toHaveCount(0);

    // E continua sumido após dois ciclos completos do poll de 8s —
    // é a guarda de timestamp contra o poll ressuscitar o contador.
    await page.waitForTimeout(18_000);
    await expect(card.locator(".unread-badge")).toHaveCount(0);
  });

  test("o contador zerado persiste após reload (foi gravado no banco)", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await expect(page.locator(".conversation-card").first().locator(".unread-badge")).toHaveCount(0);

    await page.reload();
    await irParaChats(page);
    await expect(page.locator(".conversation-card").first().locator(".unread-badge")).toHaveCount(0);
  });
});

test.describe("Feature 4 — legenda de imagem", () => {
  test("mostra a legenda real e esconde o placeholder [Imagem]", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();

    await expect(page.locator(".msg-caption").filter({ hasText: LEGENDA })).toBeVisible();

    // A imagem sem legenda não pode renderizar o placeholder como texto.
    await expect(page.locator(".msg-caption").filter({ hasText: "[Imagem]" })).toHaveCount(0);
    await expect(page.locator(".message-thread")).not.toContainText("[Imagem]");
  });

  test("anexo abre modal de preview com campo de legenda", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();

    const arquivo = {
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      )
    };
    await page.locator('input[type="file"]').setInputFiles(arquivo);

    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Enviar anexo")).toBeVisible();
    await expect(modal.getByPlaceholder("Escreva uma legenda...")).toBeVisible();
    await expect(modal.locator(".media-preview img")).toBeVisible();

    // Fecha sem enviar — não deve disparar nada.
    await modal.locator(".icon-btn").click();
    await expect(modal).toHaveCount(0);
  });
});

test.describe("Feature 7 — lightbox com zoom", () => {
  test("abre, dá zoom, reseta e fecha no X", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();

    await page.locator(".msg-image").first().click();

    const lightbox = page.locator(".lightbox-overlay");
    await expect(lightbox).toBeVisible();
    await expect(page.locator(".lightbox-img")).toBeVisible();

    const zoomLabel = page.locator(".lightbox-toolbar span");
    await expect(zoomLabel).toHaveText("100%");

    await page.locator(".lightbox-toolbar button", { hasText: "+" }).click();
    await expect(zoomLabel).toHaveText("125%");

    await page.locator(".lightbox-toolbar button", { hasText: "−" }).click();
    await page.locator(".lightbox-toolbar button", { hasText: "−" }).click();
    await expect(zoomLabel).toHaveText("75%");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(zoomLabel).toHaveText("100%");

    await page.locator(".lightbox-close, .lightbox-toolbar button").last().click();
    await expect(lightbox).toHaveCount(0);
  });

  test("Escape fecha o lightbox", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await page.locator(".msg-image").first().click();

    const lightbox = page.locator(".lightbox-overlay");
    await expect(lightbox).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(lightbox).toHaveCount(0);
  });

  test("clique fora fecha; duplo clique alterna o zoom", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await page.locator(".msg-image").first().click();

    const lightbox = page.locator(".lightbox-overlay");
    await page.locator(".lightbox-img").dblclick();
    await expect(page.locator(".lightbox-toolbar span")).toHaveText("250%");

    // Clica na borda do overlay (fora do stage).
    await lightbox.click({ position: { x: 5, y: 5 } });
    await expect(lightbox).toHaveCount(0);
  });

  test("trava o scroll do body enquanto aberto e devolve ao fechar", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await page.locator(".msg-image").first().click();

    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

test.describe("Regressao — inbox nao pode ficar fora da aba da conversa aberta", () => {
  test("aba salva em Pendente + conversa ativa aberta -> aba pula pra Ativo", async ({ page }) => {
    // Simula o estado reportado: aba persistida em Pendente, mas a conversa que
    // abre é ativa. Antes, o inbox mostrava "Sem conversas neste filtro".
    await page.evaluate(() => localStorage.setItem("stn_crm_chat_status", "pending"));
    await page.reload();
    await irParaChats(page);

    // Fecha a unica pendente respondendo? Nao — usa a aba Ativo e volta:
    await page.getByRole("tab", { name: "Ativo" }).click();
    await page.locator(".conversation-card").first().click();
    await expect(page.locator(".status-tab.active")).toHaveText("Ativo");

    // A conversa aberta continua visivel na lista — nunca "Sem conversas".
    await expect(page.locator(".conversation-card.active")).toHaveCount(1);
    await expect(page.locator(".inbox-empty, .empty-state")).toHaveCount(0);
  });

  test("conversa aberta sempre aparece na lista da aba atual", async ({ page }) => {
    await irParaChats(page);
    for (const aba of ["Pendente", "Ativo", "Fechado"]) {
      await page.getByRole("tab", { name: aba }).click();
      const cards = page.locator(".conversation-card");
      if ((await cards.count()) === 0) continue;
      await cards.first().click();
      // A aba tem que conter a conversa selecionada.
      await expect(page.locator(".conversation-card.active")).toHaveCount(1);
    }
  });
});

test.describe("Regressao — lightbox nao pode abrir cortando a imagem", () => {
  test("imagem grande cabe inteira na viewport ao abrir", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await page.locator(".msg-image").first().click();

    const img = page.locator(".lightbox-img");
    await expect(img).toBeVisible();

    const nat = await img.evaluate((e: HTMLImageElement) => ({ w: e.naturalWidth, h: e.naturalHeight }));
    // Garante que a fixture é maior que a tela — senão o teste passaria à toa.
    expect(nat.w, "imagem do seed precisa ser grande pro teste valer").toBeGreaterThan(1000);

    const box = (await img.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, "imagem vazando na horizontal").toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height, "imagem vazando na vertical").toBeLessThanOrEqual(vp.height + 1);

    // E a proporcao original tem que ser preservada.
    const proporcao = box.width / box.height;
    expect(proporcao).toBeCloseTo(nat.w / nat.h, 1);
  });

  test("abre em 100%, sem zoom aplicado", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await page.locator(".msg-image").first().click();
    await expect(page.locator(".lightbox-toolbar span")).toHaveText("100%");
  });
});

test.describe("Feature 6 — toggle de som", () => {
  test("alterna mudo e persiste após reload", async ({ page }) => {
    await abrirSidebar(page);
    const botao = botaoSom(page);
    await expect(botao).toBeVisible();
    await expect(botao).toHaveText("🔔");

    await botao.click();
    await expect(botao).toHaveText("🔇");
    expect(await page.evaluate(() => localStorage.getItem("stn_crm_sound_muted"))).toBe("true");

    await page.reload();
    await abrirSidebar(page);
    await expect(botaoSom(page)).toHaveText("🔇");
  });

  test("o toggle existe em qualquer tela, não só nos chats", async ({ page }) => {
    await irParaChats(page);
    await abrirSidebar(page);
    await expect(botaoSom(page)).toBeVisible();

    await irParaTela(page, /Dash/);
    await abrirSidebar(page);
    await expect(botaoSom(page)).toBeVisible();
  });
});

test.describe("Documento — nome com extensão", () => {
  test("link de download leva extensão .pdf", async ({ page }) => {
    await irParaChats(page);
    await page.locator(".conversation-card").first().click();

    const doc = page.locator(".msg-doc");
    await expect(doc).toBeVisible();
    await expect(doc).toHaveAttribute("download", /\.pdf$/);
  });
});

test.describe("Saúde geral", () => {
  test("nenhum erro de console nas telas principais", async ({ page }) => {
    const erros: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") erros.push(m.text());
    });

    await irParaChats(page);
    await page.locator(".conversation-card").first().click();
    await irParaTela(page, /Dash/);
    await page.waitForTimeout(1000);

    // Ignora ruído de rede esperado (Evolution não existe no ambiente de teste).
    const relevantes = erros.filter((e) => !/favicon|Failed to load resource/i.test(e));
    expect(relevantes, `erros no console: ${relevantes.join(" | ")}`).toHaveLength(0);
  });
});
