# --- Build stage ----------------------------------------------------------
FROM node:22-alpine3.20 AS builder
RUN apk add --no-cache libc6-compat git
WORKDIR /app

# Ensure pnpm is available
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy manifests first for efficient caching
COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml* ./

# Install dependencies (including dev deps needed for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Generate Prisma client (no-op if not configured) and build
RUN pnpm run db:generate || true
RUN pnpm run db:push || true
RUN pnpm run build

# --- Runtime stage --------------------------------------------------------
FROM node:22-alpine3.20 AS runtime
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
WORKDIR /app

# Copy the standalone build produced by Next.js
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE ${PORT}

USER nextjs
CMD ["node", "server.js"]