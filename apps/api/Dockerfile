# API NestJS (STN CRM) — para Railway/Render/VPS
FROM node:20-slim AS base
# openssl p/ Prisma; ffmpeg p/ transcodificar áudio do navegador (webm) -> ogg/opus (PTT WhatsApp)
RUN apt-get update -y && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Instala exatamente as versões travadas no lockfile. Isso evita que uma nova
# versão seja puxada de forma silenciosa durante um deploy.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci --workspace @stn-crm/api --workspace @stn-crm/database --include-workspace-root

# Copia o código e gera o Prisma Client
COPY . .
RUN npx prisma generate --schema packages/database/prisma/schema.prisma

# Build do NestJS
RUN npm run build --workspace @stn-crm/api

ENV NODE_ENV=production
EXPOSE 3333
# Railway injeta PORT; main.ts já lê process.env.PORT
CMD ["node", "apps/api/dist/main.js"]
