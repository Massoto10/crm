# API NestJS (STN CRM) — para Railway/Render/VPS
FROM node:20-slim AS base
# openssl p/ Prisma; ffmpeg p/ transcodificar áudio do navegador (webm) -> ogg/opus (PTT WhatsApp)
RUN apt-get update -y && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Instala deps do monorepo (raiz + workspaces api e database)
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/database/package*.json packages/database/
RUN npm install

# Copia o código e gera o Prisma Client
COPY . .
RUN npx prisma generate --schema packages/database/prisma/schema.prisma

# Build do NestJS
RUN npm run build --workspace @stn-crm/api

ENV NODE_ENV=production
EXPOSE 3333
# Railway injeta PORT; main.ts já lê process.env.PORT
CMD ["node", "apps/api/dist/main.js"]
