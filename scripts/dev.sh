#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d postgres meilisearch
echo "Waiting for Postgres..."
sleep 3
npx prisma migrate deploy
npx prisma db seed
echo "API: npm run build && node dist/main"
echo "Web: cd ../NoteForge-web && npm run dev -- --host 127.0.0.1 --port 5174"
