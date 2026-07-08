# Frontend Next.js (STN CRM) — servido no VPS atrás do Caddy
FROM node:20-slim
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm install
COPY apps/web/ ./
# Mesma origem do Caddy → chamadas relativas /api/*
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
