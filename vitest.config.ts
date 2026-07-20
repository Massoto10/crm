import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Só unit/integration. Os testes de tela rodam no Playwright (tests/e2e).
    include: ["tests/unit/**/*.spec.ts", "tests/integration/**/*.spec.ts"],
    environment: "node",
    // Integração sobe schema no Postgres de teste — precisa de folga.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Um worker: os testes de integração compartilham o mesmo banco.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } }
  }
});
