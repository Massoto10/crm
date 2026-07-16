# Deploy — STN CRM

## Topologia

- Frontend Next.js: Vercel, com **Root Directory = `apps/web`**.
- API NestJS: Railway, Render ou VPS usando `apps/api/Dockerfile`.
- Banco: PostgreSQL/Supabase.
- WhatsApp Evolution: VPS/Docker, nunca em funções serverless.

## Variáveis obrigatórias da API

Crie os valores no provedor de deploy; não os coloque no repositório:

- `DATABASE_URL`
- `JWT_SECRET` — segredo exclusivo para assinar sessões.
- `PROCESS_SECRET` — segredo exclusivo do processamento externo.
- `WA_WEBHOOK_TOKEN` — token longo e aleatório do webhook Evolution.
- `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`
- `WEB_ORIGIN` — domínio HTTPS do frontend.

A API falha ao iniciar se `DATABASE_URL`, `JWT_SECRET`, `PROCESS_SECRET` ou `WA_WEBHOOK_TOKEN` estiverem ausentes.

## Banco

Execute as migrations do diretório `packages/database/prisma/migrations` antes de publicar a API. Não execute `db:seed` em produção: ele exige confirmação explícita e apaga dados existentes.

## Evolution

No VPS, copie `.env.example` para `.env`, defina os segredos e então execute `docker compose up -d`. O `docker-compose.yml` exige `EVOLUTION_API_KEY` e `WA_WEBHOOK_TOKEN`; ele não fornece chaves padrão.

Configure o webhook global com a URL da API e o token em `WA_WEBHOOK_TOKEN`. Restrinja a rede da Evolution e da API a HTTPS e rotacione qualquer segredo que já tenha sido compartilhado ou registrado em logs.

## Pós-deploy

1. Crie o administrador inicial diretamente pelo processo de provisionamento seguro.
2. Faça login e conecte o WhatsApp em Configurações.
3. Verifique mensagens, agendamentos e webhooks em uma organização de teste antes de liberar usuários finais.

Mídias ainda são armazenadas no PostgreSQL como data URI. Para alta escala, migre para armazenamento de objetos antes de aumentar a retenção de mensagens.
