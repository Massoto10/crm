# Testes

Três camadas. Nenhuma encosta na VPS de produção.

| Camada | Onde | O que cobre |
|---|---|---|
| `tests/unit` | Vitest, sem infra | Helpers puros: agrupamento de abas, legenda vs placeholder, extensão de download, parsing do payload do WhatsApp |
| `tests/integration` | Vitest + Postgres de teste | Webhook (status/carência/mídia/idempotência) e `markRead` (incluindo controle de acesso e isolamento entre tenants) |
| `tests/e2e` | Playwright + stack isolado | As 7 features na tela |

## Unitários

```bash
npm test
```

Não precisa de banco nem de servidor.

## Integração

Sobe um Postgres dedicado na porta **55432** (banco `crm_test`), separado do banco de desenvolvimento:

```bash
npm run test:db:up

# schema — usa db push, NÃO migrate deploy (ver aviso abaixo)
cd packages/database
DATABASE_URL="postgresql://test:test@localhost:55432/crm_test?schema=public" npx prisma db push
cd ../..

DATABASE_URL="postgresql://test:test@localhost:55432/crm_test?schema=public" npm run test:integration
```

Ao terminar: `npm run test:db:down`.

> **Aviso — as migrations estão defasadas em relação ao `schema.prisma`.**
> `prisma migrate deploy` produz um banco **sem** `end_customers.lead_source_id`,
> `source_url`, `source_ref` nem a tabela `lead_sources`, embora o schema e o código
> em produção usem tudo isso. Um ambiente novo criado só a partir das migrations
> quebra em qualquer query de origem de lead. Por isso os testes usam `db push`.
> A correção de verdade é gerar a migration que falta.

## E2E (tela)

Precisa de um stack isolado, pra não brigar com o dev server (3000/3333):

> **O e2e usa o banco `crm_e2e`, NÃO o `crm_test`.** Os testes de integração fazem
> `TRUNCATE ... CASCADE` em `agents`/`crm_clients` a cada caso; se as duas suítes
> compartilhassem banco, rodar a integração durante o e2e apaga o usuário de login
> e todos os testes de tela caem com 401. Bancos separados, no mesmo container.

```bash
# 1) Banco do e2e + schema + dados
docker exec crm-test-pg psql -U test -d postgres -c "CREATE DATABASE crm_e2e OWNER test;"
cd packages/database
DATABASE_URL="postgresql://test:test@localhost:55432/crm_e2e?schema=public" npx prisma db push
cd ../..
DATABASE_URL="postgresql://test:test@localhost:55432/crm_e2e?schema=public" npx tsx tests/e2e/seed.ts

# 2) API isolada na 3334
cd apps/api
DATABASE_URL="postgresql://test:test@localhost:55432/crm_e2e?schema=public" \
PORT=3334 WEB_ORIGIN="http://localhost:3010" \
JWT_SECRET="e2e-jwt-secret-nao-usar-em-prod" PROCESS_SECRET="e2e-process-secret" \
WA_WEBHOOK_TOKEN="e2e-webhook-token" \
EVOLUTION_API_URL="http://localhost:9999" EVOLUTION_API_KEY="e2e" \
npx nest start

# 3) Web isolada na 3010, com distDir próprio
cd apps/web
NEXT_DIST_DIR=".next-e2e" NEXT_PUBLIC_API_URL="http://localhost:3334" npx next dev -p 3010

# 4) Os testes
npm run test:e2e
```

O `NEXT_DIST_DIR` existe porque duas instâncias do `next dev` não compartilham o
mesmo `.next` — a segunda morre com `EPERM` no `.next/trace`.

O teste de badge espera ~18s de propósito: valida que o poll de 8s não ressuscita
o contador zerado.
