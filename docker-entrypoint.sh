#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
npx wait-on tcp:postgres:5432

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting Next.js application..."
exec node server.js
