# CLAUDE.md

## Development

```bash
npm run dev          # Vite dev server (port 5173)
npm run dev:worker   # Wrangler backend (port 8787)
npm run db:migrate   # D1 migrations (local)
npm test             # vitest
```

## Architecture

- Frontend: Vite + React + TypeScript (`src/app/`)
- Backend: Cloudflare Workers + Hono (`src/api/`)
- DB: Cloudflare D1 (SQLite), Storage: Cloudflare R2
- Repository pattern: interfaces in `src/api/types.ts`, D1 impls and in-memory impls (for tests) in `src/api/repositories/`
