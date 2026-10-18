# ADR 0003 — Search: Meilisearch first, ILIKE fallback

## Status
Accepted (supersedes “Meili deferred”)

## Context
We need workspace search across pages, blocks, tasks, comments, and DB rows for demos.

## Decision
1. **Primary:** Meilisearch (`MEILI_HOST`) — typo-tolerant, kind filters (`page|task|comment|db_row`).
2. **Fallback:** Postgres `props::text ILIKE` when Meili is down.
3. **Indexing:** Incremental `indexPage` after `saveBlocks` / comments; full `POST .../search/reindex` for seed/ops.
4. Health exposes `meili: up|down`.

## Consequences
Local compose includes Meilisearch by default. No prod managed search SaaS required.
