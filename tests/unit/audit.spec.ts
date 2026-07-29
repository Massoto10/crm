import { describe, expect, it } from "vitest";
import { createAuditRecordFromRequest } from "../../apps/api/src/audit/audit.service";

function request(overrides: Record<string, unknown> = {}) {
  return {
    method: "PATCH",
    path: "/api/end-customers/clx0qwerty123456789",
    params: { id: "clx0qwerty123456789" },
    body: { notes: "Conteúdo privado", password: "nunca-registrar", accessToken: "nunca-registrar" },
    ip: "203.0.113.5",
    get: (name: string) => name === "user-agent" ? "vitest" : undefined,
    user: {
      sub: "agent-1",
      email: "operator@example.test",
      name: "Operador",
      role: "agent",
      crmClientId: "tenant-1"
    },
    ...overrides
  };
}

describe("createAuditRecordFromRequest", () => {
  it("registra contexto da escrita sem registrar valores ou campos sensíveis", () => {
    const record = createAuditRecordFromRequest(request() as never, 200);

    expect(record).toMatchObject({
      crmClientId: "tenant-1",
      actorId: "agent-1",
      action: "patch.end-customers.id",
      route: "/api/end-customers/:id",
      targetType: "resource",
      targetId: "clx0qwerty123456789",
      statusCode: 200,
      metadata: { fields: ["notes"] }
    });
    expect(JSON.stringify(record)).not.toContain("Conteúdo privado");
    expect(JSON.stringify(record)).not.toContain("nunca-registrar");
  });

  it("não cria registro de auditoria para leitura", () => {
    expect(createAuditRecordFromRequest(request({ method: "GET" }) as never, 200)).toBeNull();
  });
});
