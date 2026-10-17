# NoteForge API

[![CI](https://github.com/hamzamaral/NoteForge-api/actions/workflows/ci.yml/badge.svg)](https://github.com/hamzamaral/NoteForge-api/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)

Blok notlar, görevler, veritabanı görünümleri, paylaşım ve sync için REST + Socket.IO API.

Companion: [NoteForge-web](https://github.com/hamzamaral/NoteForge-web)

## Docs (mülakat)

- [PRODUCT](docs/PRODUCT.md) · [INTERVIEW](docs/INTERVIEW.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ROADMAP](docs/ROADMAP.md) · [BLOCK_SCHEMA](docs/BLOCK_SCHEMA.md)

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

Auth · Workspaces · Pages/Blocks · Tasks · Databases · Shares · Comments · Sync (`/sync`)
