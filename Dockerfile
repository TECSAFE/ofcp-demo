FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /build

# --- API build ---
FROM base AS api-build
COPY api ./
# corepack install pins pnpm from the "packageManager" field — one source of truth.
RUN corepack install && pnpm install --frozen-lockfile
RUN pnpm run build && pnpm prune --prod

# --- UI build ---
FROM base AS ui-build
COPY ui ./
RUN corepack install && pnpm install --frozen-lockfile
RUN pnpm run build

# --- Production ---
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-build /build/dist ./api/dist
COPY --from=api-build /build/node_modules ./api/node_modules
COPY --from=api-build /build/package.json ./api/package.json
# Nitro output is self-contained (bundled deps) — no ui node_modules needed.

ENV PORT=4000
ENV NITRO_PORT=80
ENV DATA_DIR=/data
ENV API_PROXY_TARGET=http://127.0.0.1:4000
ENV NUXT_PUBLIC_API_BASE=/api

COPY --from=ui-build /build/.output ./ui
COPY docker/start.sh ./start.sh
EXPOSE 80
CMD ["sh", "./start.sh"]
