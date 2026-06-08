# STN CRM

Monorepo inicial do CRM com:

- `apps/api`: backend Nest.js.
- `apps/web`: frontend Next.js.
- `packages/database`: Prisma schema, client e seed.
- `docker-compose.yml`: Postgres local.

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Crie o `.env` a partir do exemplo:

```bash
copy .env.example .env
```

3. Suba o Postgres:

```bash
docker compose up -d
```

4. Gere o Prisma Client:

```bash
npm run db:generate
```

5. Rode migration e seed:

```bash
npm run db:migrate
npm run db:seed
```

6. Rode API e web em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

API: `http://localhost:3333/api`

Web: `http://localhost:3000`

## Endpoints iniciais

- `GET /api/health`
- `GET /api/crm-clients`
- `GET /api/conversations`
- `GET /api/conversations?channel=whatsapp`
- `GET /api/conversations?channel=instagram`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id/messages`

## Modelo de dados

`CrmClient` representa empresas que usam o CRM.

`EndCustomer` representa clientes finais dessas empresas.

`Label` classifica clientes finais por perfil, comportamento, negocio, risco e canal.

`Conversation` liga cliente do CRM, cliente final e canal.

`Message` guarda o historico da conversa.

`Task` guarda proximas acoes.
