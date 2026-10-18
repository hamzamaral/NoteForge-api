# Roadmap

| Faz | İçerik | Durum |
|-----|--------|-------|
| 0–8 | Core product (notes, tasks, DB, share, sync, search, UX) | ship |
| 9 | `assertMember(minRole)`, sync join ACL, login rate limit, verify/reset | ship |
| 10 | Yjs rooms with membership + TTL; TipTap Collaboration client | ship |
| 11 | `POST /files/upload` → local `./uploads` (MinIO optional) | ship |
| 12 | Meilisearch index + kind filter; ILIKE fallback | ship |
| 13 | Prop types (multi_select, checkbox, url, person, files); views; row→page | ship |
| 14 | `Notification` + comment/mention notify; task assignee/due | ship |
| 15 | `PageSnapshot` list/restore; coverUrl; editor depth (web) | ship |
| 16 | Jest unit + e2e health; CI lint/test/build | ship |
| 17 | (web) mobile nav + a11y | ship |
| 18 | AuditLog, ZIP export, SystemSetting, pino-http, trash purge job | ship |

Docker (local): Postgres + Meilisearch + Mailhog. MinIO optional — API uses disk fallback.
