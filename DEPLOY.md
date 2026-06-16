# Deploy — STN CRM

Topologia de produção:

| Componente | Onde | Status |
|---|---|---|
| Frontend (Next.js, `apps/web`) | **Vercel** | a publicar |
| Banco (Postgres) | **Supabase** (`stn-crm`) | ✅ criado + schema + seed |
| API (NestJS, `apps/api`) | **Railway/Render** (Docker) | a publicar |
| Evolution (WhatsApp) | **VPS Docker** | a publicar |

---

## 1. Banco — Supabase ✅ (já feito)

- Projeto: **stn-crm** (ref `smnysnqwpkmrjptkpuhn`, região sa-east-1).
- URL: `https://smnysnqwpkmrjptkpuhn.supabase.co`
- Schema completo aplicado + seed:
  - Org **STN CRM** (`cli_stn`).
  - Admin: **admin@stn.crm** (senha definida no seed — troque no 1º acesso).
  - Origens: Direto, Instagram Ads, Site(`site`), TikTok(`tiktok`), LinkedIn(`linkedin`).
  - Status de lead: Novo, Qualificado, Proposta, Ganho.
- **Pegue a senha do banco**: Supabase → Project Settings → Database → Connection string →
  copie o "Session pooler" (porta 5432). É o `DATABASE_URL` da API.

## 2. API (NestJS) — Railway (recomendado) ou Render

A API é long-running (tem agendador `setInterval` + webhooks), então **não** vai na Vercel.

1. Crie um serviço no Railway a partir deste repositório (ou suba via `railway up`).
2. Use o **Dockerfile** em `apps/api/Dockerfile` (Railway detecta; ou aponte o build pra ele).
3. Variáveis de ambiente: copie de `apps/api/.env.production.example` e preencha:
   - `DATABASE_URL` → connection string do Supabase (com a senha real).
   - `PROCESS_SECRET`, `EVOLUTION_API_KEY`, `WA_WEBHOOK_TOKEN` → já gerados no example.
   - `WEB_ORIGIN` → domínio da Vercel (passo 3).
   - `EVOLUTION_API_URL` → URL do seu Evolution (passo 4).
   - `PORT` → o Railway injeta sozinho.
4. Após deploy, anote a URL pública da API (ex: `https://stn-crm-api.up.railway.app`).

> Não precisa rodar migration: o schema já está no Supabase. Se evoluir o schema depois,
> rode `prisma migrate diff` e aplique no Supabase.

## 3. Frontend (Next.js) — Vercel

1. Importe o repositório na Vercel.
2. **Root Directory** = `apps/web` (é um Next.js self-contained).
3. Framework: Next.js (autodetecta). Build: `next build`.
4. Env var: `NEXT_PUBLIC_API_URL` = URL pública da API (passo 2).
5. Deploy. Anote o domínio (ex: `https://stn-crm.vercel.app`) e coloque em `WEB_ORIGIN` da API.

## 4. Evolution (WhatsApp) — VPS Docker

Não roda em Vercel/Supabase (é processo longo + filesystem). Suba num VPS:

1. `docker run` da imagem `evoapicloud/evolution-api:v2.3.7` (veja `docker-compose.yml` como base).
2. Env principais:
   - `AUTHENTICATION_API_KEY` = mesmo `EVOLUTION_API_KEY` da API.
   - `WEBHOOK_GLOBAL_ENABLED=true`
   - `WEBHOOK_GLOBAL_URL=https://SUA-API-RAILWAY/api/whatsapp/webhook?token=<WA_WEBHOOK_TOKEN>`
   - Banco do Evolution: pode ser o próprio Supabase (schema `evolution_api`) ou um Postgres próprio.
3. Exponha com HTTPS (Caddy/Nginx) e use essa URL em `EVOLUTION_API_URL` da API.

## 5. Pós-deploy

1. Login no frontend com admin@stn.crm.
2. Configurações → WhatsApp → Conectar → escaneie o QR (cria a instância no Evolution).
3. Configurações → Origens → ajuste/gere os links rastreáveis (wa.me) por canal.
4. Teste: mande mensagem pro número conectado → vira conversa; origem é detectada.

## Notas de produção
- **Mídia (áudio/foto/arquivo)** é guardada como data URI no Postgres → cresce rápido.
  No Supabase free (500MB) enche logo. Migrar pra Supabase Storage é o próximo passo.
- Segredos no `.env.production.example` são reais (gerados nesta sessão) — mantenha fora do git público.
- Banco do CRM e do Evolution: se compartilhar o Supabase, use schemas separados (`public` x `evolution_api`).
