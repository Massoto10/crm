import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PipelineStageService } from "../../apps/api/src/pipeline/pipeline-stage.service";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.service";
import { CRM_CLIENT_ID, prisma, resetDb, seedCustomer, seedTenant } from "./helpers";

let pipeline: PipelineStageService;

const ETAPAS = [
  { id: "ps_entrada", name: "Entrada", order: 0 },
  { id: "ps_qualificacao", name: "Qualificacao", order: 1 },
  { id: "ps_proposta", name: "Proposta", order: 2 },
  { id: "ps_fechados", name: "Fechados", order: 3 }
];

async function seedFunil() {
  await prisma.pipelineStage.createMany({
    data: ETAPAS.map((e) => ({
      id: e.id,
      crmClientId: CRM_CLIENT_ID,
      name: e.name,
      color: "#000",
      hint: "",
      order: e.order,
      isActive: true
    }))
  });
}

async function etapaDe(customerId: string): Promise<string | null> {
  const c = await prisma.endCustomer.findUnique({
    where: { id: customerId },
    select: { pipelineStage: { select: { name: true } } }
  });
  return c?.pipelineStage?.name ?? null;
}

beforeAll(() => {
  pipeline = new PipelineStageService(prisma as unknown as PrismaService);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  await seedTenant();
  await seedFunil();
});

describe("classificação automática do funil — mensagem do cliente", () => {
  it("pergunta de preço move para Qualificacao", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "boa tarde, quanto custa o servico?",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBe("Qualificacao");
  });

  it("casa palavra-chave com acento (orçamento)", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "consegue me mandar um orçamento?",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBe("Qualificacao");
  });

  it("conversa fiada não move ninguém", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "bom dia, tudo bem?",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBeNull();
  });

  it("cliente falando de preço NÃO pula direto pra Proposta", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "qual o valor? R$ 5.000 esta no meu orcamento",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBe("Qualificacao");
  });
});

describe("classificação automática do funil — mensagem do operador", () => {
  it("a palavra 'proposta' move para Proposta", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "segue a proposta em anexo",
      origem: "agente"
    });
    expect(await etapaDe(c.id)).toBe("Proposta");
  });

  it("orçamento COM valor move para Proposta", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "o valor total fica em R$ 2.500,00",
      origem: "agente"
    });
    expect(await etapaDe(c.id)).toBe("Proposta");
  });

  it("operador PERGUNTANDO valor, sem número, não vira Proposta", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "qual valor voce tinha em mente?",
      origem: "agente"
    });
    expect(await etapaDe(c.id)).toBeNull();
  });

  it("valor estimado preenchido move para Proposta", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromEstimatedValue(CRM_CLIENT_ID, c.id);
    expect(await etapaDe(c.id)).toBe("Proposta");
  });
});

describe("funil — só avança, nunca regride", () => {
  it("quem está em Proposta não volta para Qualificacao", async () => {
    const c = await seedCustomer();
    await prisma.endCustomer.update({ where: { id: c.id }, data: { pipelineStageId: "ps_proposta" } });

    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "quanto custa mesmo?",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBe("Proposta");
  });

  it("quem está em Fechados não é movido — fechar é decisão do operador", async () => {
    const c = await seedCustomer();
    await prisma.endCustomer.update({ where: { id: c.id }, data: { pipelineStageId: "ps_fechados" } });

    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "segue a proposta",
      origem: "agente"
    });
    expect(await etapaDe(c.id)).toBe("Fechados");
  });

  it("aplicar duas vezes é idempotente", async () => {
    const c = await seedCustomer();
    const msg = { crmClientId: CRM_CLIENT_ID, endCustomerId: c.id, texto: "segue a proposta", origem: "agente" as const };
    await pipeline.applyFromMessage(msg);
    await pipeline.applyFromMessage(msg);
    expect(await etapaDe(c.id)).toBe("Proposta");
  });
});

describe("funil — configuração e robustez", () => {
  it("pode ser desligado por Settings", async () => {
    await prisma.setting.create({
      data: { crmClientId: CRM_CLIENT_ID, key: "pipeline_auto_enabled", value: "false" }
    });
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID,
      endCustomerId: c.id,
      texto: "quanto custa?",
      origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBeNull();
  });

  it("palavras-chave customizadas em Settings substituem o padrão", async () => {
    await prisma.setting.create({
      data: {
        crmClientId: CRM_CLIENT_ID,
        key: "pipeline_qualificacao_keywords",
        value: "quero um robo, automatizar"
      }
    });
    const c = await seedCustomer();

    // termo padrão deixa de valer
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID, endCustomerId: c.id, texto: "quanto custa?", origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBeNull();

    // termo customizado passa a valer
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID, endCustomerId: c.id, texto: "quero automatizar meu atendimento", origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBe("Qualificacao");
  });

  it("funil sem a etapa alvo não quebra nem move ninguém", async () => {
    await prisma.pipelineStage.deleteMany({ where: { id: "ps_proposta" } });
    const c = await seedCustomer();
    await expect(
      pipeline.applyFromMessage({
        crmClientId: CRM_CLIENT_ID, endCustomerId: c.id, texto: "segue a proposta", origem: "agente"
      })
    ).resolves.toBeUndefined();
    expect(await etapaDe(c.id)).toBeNull();
  });

  it("texto vazio não faz nada", async () => {
    const c = await seedCustomer();
    await pipeline.applyFromMessage({
      crmClientId: CRM_CLIENT_ID, endCustomerId: c.id, texto: "   ", origem: "cliente"
    });
    expect(await etapaDe(c.id)).toBeNull();
  });
});
