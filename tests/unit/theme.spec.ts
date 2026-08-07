import { describe, expect, it } from "vitest";
import { normalizeThemePreference } from "../../apps/web/src/lib/theme";

/**
 * Regressao: o CRM abria escuro para quem usa o sistema operacional no escuro.
 *
 * O padrao era 'system', que herda o modo do SO. Ninguem tinha pedido tema
 * escuro — ele so aparecia. O padrao passa a ser claro; escolha explicita
 * continua valendo.
 */
describe("normalizeThemePreference", () => {
  it("sem preferencia salva, abre no claro", () => {
    expect(normalizeThemePreference(undefined)).toBe("light");
    expect(normalizeThemePreference(null)).toBe("light");
    expect(normalizeThemePreference("")).toBe("light");
  });

  it("valor invalido tambem cai no claro, em vez de herdar o SO", () => {
    expect(normalizeThemePreference("lixo")).toBe("light");
    expect(normalizeThemePreference("Dark")).toBe("light");
  });

  it("escolha explicita do operador e respeitada", () => {
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("light")).toBe("light");
    // 'system' continua disponivel para quem quiser seguir o SO de proposito.
    expect(normalizeThemePreference("system")).toBe("system");
  });
});
