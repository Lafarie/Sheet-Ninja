# Base Dockerfile
FROM node:22-alpine3.20 AS base
# Configure pnpm global
ENV PNPM_HOME="/pnpm"
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm install --global turbo corepack && \
    corepack enable && \
    corepack prepare pnpm@9.0.0 --activate && \
    pnpm --version && turbo --version

# Pruner - removes development dependencies
FROM base AS pruner
COPY . .
RUN turbo prune --scope=automater-nextjs --docker --out-dir /automater-pruned 

# Builder - builds the application
FROM base AS builder
COPY --from=pruner /automater-pruned/json/ .
COPY --from=pruner /automater-pruned/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /automater-pruned/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /automater-pruned/full/ .
COPY turbo.json turbo.json

RUN pnpm run db:generate
RUN pnpm run build

# Runtime - use Node.js instead of Bun
FROM node:22-alpine3.20 AS runtime
RUN apk add --no-cache tzdata
RUN adduser --system --uid 1001 nextjs
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:node /app/package.json ./package.json
COPY --from=builder --chown=nextjs:node /app/.next/standalone ./
COPY --from=builder --chown=nextjs:node /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:node /app/public ./public
COPY --from=builder --chown=nextjs:node /app/.env.local ./.env

# Remove .env copy - use docker-compose environment instead
ENV PORT=3000
EXPOSE ${PORT}
USER nextjs
CMD ["node", "server.js"]