# syntax=docker/dockerfile:1.7
#
# CSM — Dockerfile multi-stage para self-hosting.
#
# Stages:
#   1. deps   → npm install con cache de capas
#   2. build  → next build (genera .next/standalone)
#   3. runner → imagen final ligera (alpine + node + standalone build)
#
# La imagen final pesa ~180MB y arranca en <2s. Ejecuta como user no-root
# `nextjs:nodejs` (uid/gid 1001) para no correr el server como root.
#
# Uso:
#   docker build -t csm:latest .
#   docker compose up -d
#
# Migration de schema: el contenedor ejecuta `npm run db:push --force` al
# arrancar (idempotente — si la BD ya tiene las tablas, no las toca).

# ============================================================
# Stage 1 — deps (cache de node_modules)
# ============================================================
FROM node:24-alpine AS deps

# libc6-compat: requerido por algunos binarios nativos (sharp, bcrypt-like)
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Solo copiamos lo necesario para invalidar cache solo cuando cambian deps
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ============================================================
# Stage 2 — build (next build → standalone)
# ============================================================
FROM node:24-alpine AS builder
WORKDIR /app

# Reusa node_modules del stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables que `next build` necesita en build-time. SKIP_ENV_VALIDATION=1
# permite construir sin tener .env todavía (las vars reales se inyectan
# en runtime via docker compose).
ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1 \
    NODE_ENV=production

RUN npm run build

# ============================================================
# Stage 3 — runner (imagen final mínima)
# ============================================================
FROM node:24-alpine AS runner
WORKDIR /app

# Crea usuario no-root para mejor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copiamos solo lo que el server necesita en runtime
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# drizzle-kit + scripts para `db:push` al arrancar — los necesitamos en
# runtime para auto-migrar el schema. Copiamos node_modules completo
# para tener drizzle-kit y tsx disponibles.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./

# Entry script: aplica migrations + arranca server
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000

# Healthcheck contra una ruta ligera
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
