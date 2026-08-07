import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EndCustomersService } from "../../apps/api/src/end-customers/end-customers.service";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.service";
import { CRM_CLIENT_ID, prisma, resetDb, seedCustomer, seedTenant } from "./helpers";

/**
 * Regressao: arrastar um card no kanban fazia o card sumir.
 *
 * O kanban agrupa os cards por `pipelineStage.id` — o objeto da relacao, nao o
 * escalar. O PATCH nao passava `select`, entao o Prisma devolvia a linha crua:
 * vinha `pipelineStageId`, faltava `pipelineStage`. O front lia `undefined`, o
 * card nao casava com coluna nenhuma e desaparecia da tela.
 *
 * O teste checa a FORMA da resposta, que e o contrato de que o front depende.
 */
let service: EndCustomersService;

beforeAll(async () => {
  service = new EndCustomersService(prisma as unknown as PrismaService);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  await seedTenant();
  await prisma.pipelineStage.createMany({
    data: [
      { id: "ps_novo", crmClientId: CRM_CLIENT_ID, name: "Novo", color: "#000", hint: "", order: 0, isActive: true },
      { id: "ps_proposta", crmClientId: CRM_CLIENT_ID, name: "Proposta", color: "#111", hint: "", order: 1, isActive: true }
    ]
  });
});

describe("PATCH /end-customers/:id — forma da resposta", () => {
  it("devolve a relacao pipelineStage, nao so o id escalar", async () => {
    const cliente = await seedCustomer("5521900000001");
    await prisma.endCustomer.update({ where: { id: cliente.id }, data: { pipelineStageId: "ps_novo" } });

    const resposta = await service.patch(cliente.id, { pipelineStageId: "ps_proposta" }, CRM_CLIENT_ID);

    // Sem isto o card some do kanban: e por aqui que o front descobre a coluna.
    expect(resposta.pipelineStage).toBeTruthy();
    expect(resposta.pipelineStage?.id).toBe("ps_proposta");
    expect(resposta.pipelineStage?.name).toBe("Proposta");
  });

  it("mantem labels na resposta — senao as tags do card somem junto", async () => {
    const cliente = await seedCustomer("5521900000002");
    const etiqueta = await prisma.label.create({
      data: { crmClientId: CRM_CLIENT_ID, name: "VIP", color: "#f00", category: "profile" }
    });
    await prisma.endCustomerLabel.create({
      data: { endCustomerId: cliente.id, labelId: etiqueta.id }
    });

    const resposta = await service.patch(cliente.id, { pipelineStageId: "ps_novo" }, CRM_CLIENT_ID);

    expect(resposta.labels).toHaveLength(1);
    expect(resposta.labels[0].label.name).toBe("VIP");
  });

  it("tirar a etapa devolve pipelineStage nulo, nao ausente", async () => {
    const cliente = await seedCustomer("5521900000003");
    await prisma.endCustomer.update({ where: { id: cliente.id }, data: { pipelineStageId: "ps_novo" } });

    const resposta = await service.patch(cliente.id, { pipelineStageId: null }, CRM_CLIENT_ID);

    expect(resposta.pipelineStage).toBeNull();
  });
});
