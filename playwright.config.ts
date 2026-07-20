import { defineConfig, devices } from "@playwright/test";

// O seed roda dentro dos testes (beforeEach), então precisa do banco de e2e —
// que é separado do da integração de propósito (ver tests/README.md).
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://test:test@localhost:55432/crm_e2e?schema=public";

// Stack isolado: API em 3334 e web em 3001, ambos contra o Postgres de teste
// (porta 55432). Não encosta no dev server do desenvolvedor (3000/3333).
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
