This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting started

Follow these steps to run the project locally and what environment variables you need to provide.

Prerequisites
- Node.js (recommended v22+)
- pnpm (this repo uses pnpm; npm or yarn can also work but commands below use pnpm)
- Docker and docker-compose (optional — used by the provided docker scripts)

Install dependencies

```powershell
pnpm install
```

Run in development

```powershell
pnpm dev
```

Build for production

```powershell
pnpm build
pnpm start
```

Docker (dev) postgres only:

```powershell
pnpm run docker:dev
```

## Environment variables (.env)

This project reads a handful of environment variables used for auth, encryption, database, and the client API base URL. Create a `.env` file in the project root with the values below (example values shown):

```
# NextAuth secret used to sign session/JWT tokens. Use a long, random string.
NEXTAUTH_SECRET=replace-with-a-secure-random-string

# Encryption key used to encrypt saved credentials. Can be a 64-char hex string or a 32-byte string.
ENCRYPTION_KEY=your-32-or-64-char-key-here

# Database connection URL (Postgres). Required by Prisma.
DATABASE_URL=postgresql://user:password@localhost:5434/dbname?schema=public

# Public API base used by client code to talk to the backend service (defaults to http://localhost:3000 if unset)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000

# Optional: NODE_ENV=development|production
NODE_ENV=development
```

Notes and guidance
- NEXTAUTH_SECRET: Required for next-auth. If not set you will see a runtime warning and authentication may be insecure. Use a random 32+ character value.
- ENCRYPTION_KEY: Used by `src/lib/encryption.ts` to encrypt/decrypt saved service account JSON and tokens. You can provide a 64-character hex string (it will be parsed as hex) or a UTF-8 string; the code will pad or truncate to 32 bytes. For best security, use a 64-char hex value or a 32-byte random string.
- DATABASE_URL: This must point to a Postgres instance. The Prisma schema at `prisma/schema.prisma` expects PostgreSQL.
- NEXT_PUBLIC_API_BASE_URL: Used in the browser to target the API. If you're running an external API server (for example a sync service) set this to the correct origin. The client falls back to `http://localhost:5001` when the env is unset.

## Google Sheets / Service account

This app expects Google service account credentials when you want to sync with Google Sheets. Example project stores an example path `uploads/service_account.json` in the repo — in production you should keep credentials out of source control and provide the JSON file path or contents via a secret management system.

Saved configs stored in the DB may contain the `serviceAccount` JSON (encrypted). The Prisma model `SavedConfig.serviceAccount` is a `Json?` field (see `prisma/schema.prisma`).

## Database (Prisma)

Run migrations and generate the client:

```powershell
pnpm run db:migrate
pnpm run db:generate
pnpm run db:studio
```

## What to configure in the UI

- GitLab URL and personal access token — stored per saved configuration.
- Google Spreadsheet ID and optional service account — stored per saved configuration (service account JSON may be encrypted).
- Column mappings and project mappings can be saved to the DB for reuse.

## Useful npm scripts


## Troubleshooting



Running with Nginx
------------------

This repository includes an `nginx` service in `docker-compose.yml` that proxies host port 80 to the Next.js `app` service (container port 3000).

To start the stack:

1. Ensure your `.env.production` is present and configured.
2. Run `docker compose up --build` from the project root. On Windows Powershell you can run:

```powershell
docker compose up --build
```

Nginx will listen on port 80 of the host and proxy requests to the `app` service. If you need to expose the `app` port directly for debugging, uncomment the `ports` mapping for the `app` service in `docker-compose.yml`.

---

If you'd like, I can also add a sample `.env.example` file to the repo or add a short section describing how to generate secure random values for `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` on Windows/macOS/Linux.