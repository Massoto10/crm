FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @stn-crm/web --include-workspace-root

COPY apps/web/ apps/web/
WORKDIR /app/apps/web

# O Caddy atende a API e o front na mesma origem em produção.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]
