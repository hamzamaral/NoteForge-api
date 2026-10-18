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
| 19 | SoT flush, empty wipe 400, remount epoch, share/trash | ship |
| 20 | Signed file GET, OWNER invite, sync CORS, snapshot ÷5 | ship |
| 21 | Auto Meili index, health.meili | ship |
| 22 | Rich seed, DEMO.md, ADR/INTERVIEW align | ship |
| 23 | Real tests + CI gate | ship |
| 24 | Mention nav, todo sync, disconnect banner, export types | ship |

Docker (local): Postgres + Meilisearch + Mailhog. MinIO optional profile. See `../DEMO.md`.
