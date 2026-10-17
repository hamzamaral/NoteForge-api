# NoteForge API

[![CI](https://github.com/hamzamaral/NoteForge-api/actions/workflows/ci.yml/badge.svg)](https://github.com/hamzamaral/NoteForge-api/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-sync-010101)

Blok notlar, görevler, veritabanı görünümleri, paylaşım, yorum ve Yjs sync için REST + Socket.IO API.

Companion: [NoteForge-web](https://github.com/hamzamaral/NoteForge-web)

## Docs (mülakat)

- [PRODUCT](docs/PRODUCT.md) · [INTERVIEW](docs/INTERVIEW.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ROADMAP](docs/ROADMAP.md) · [BLOCK_SCHEMA](docs/BLOCK_SCHEMA.md)
- ADRs: [TipTap](docs/adr/0001-editor-tiptap.md) · [Tasks before DB](docs/adr/0002-tasks-before-db.md) · [Search ILIKE](docs/adr/0003-search-ilike.md)

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres   # host port 5434
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

- API: http://localhost:3001/api/v1  
- Swagger: http://localhost:3001/api/docs  
- Demo: `admin@noteforge.local` / `Admin123!`

## Modules

Auth · Workspaces · Pages/Blocks · Tasks · Databases · Shares · Comments · Sync (`/sync` JWT + Y.Doc) · Search

## Search

`GET /workspaces/:workspaceId/search?q=` → `{ id, title, match, snippet, score }[]`  
Sıra: title → task → block `props::text ILIKE` (ADR 0003).
