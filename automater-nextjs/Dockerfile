# Dependencies stage
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Configure pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Builder stage
FROM node:22-alpine AS builder
WORKDIR /app

# Configure pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Runner stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Configure pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and package.json for runtime dependencies
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Install production dependencies including Prisma CLI
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Copy and make entrypoint script executable
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
