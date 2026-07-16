# STN CRM

Monorepo do CRM:

- `apps/api`: API NestJS.
- `apps/web`: frontend Next.js.
- `packages/database`: schema, migrations e seed Prisma.
- `docker-compose.yml`: PostgreSQL, Redis e Evolution para desenvolvimento local.

## Desenvolvimento local

1. Instale as dependências:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example` e substitua todos os valores de exemplo de segredos por valores aleatórios fortes. A API não inicia sem `JWT_SECRET`, `PROCESS_SECRET` e `WA_WEBHOOK_TOKEN`.

3. Suba a infraestrutura local:

```bash
docker compose up -d
```

4. Gere o cliente Prisma e aplique as migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Opcionalmente, carregue dados de demonstração. Este comando apaga os dados existentes e exige confirmação explícita:

```bash
$env:ALLOW_DESTRUCTIVE_SEED="true"
$env:SEED_ADMIN_PASSWORD="uma-senha-forte-com-12-ou-mais-caracteres"
npm run db:seed
```

6. Inicie API e web em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

API: `http://localhost:3333/api`

Web: `http://localhost:3000`

## Segurança e multiempresa

- A empresa ativa é sempre derivada do token JWT; o navegador não define o tenant.
- Cadastros de atendentes são feitos por administradores autenticados.
- Tokens são invalidados quando o usuário é desativado, tem senha, função ou departamento alterados.
- Nunca versione `.env` ou tokens de webhooks.
