# OAS Pin Library (Next.js + Supabase)

Production Next.js app for the OAS pin catalogue. Feature modules live under `src/features/` so boards, pin UI, auth, and shell stay reusable.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 → Catalog board.

Without Supabase env vars the app uses seed JSON + `localStorage`.

## Architecture

```
src/
  app/                 # Thin Next.js routes only
  features/
    pins/              # Pin domain: card, detail drawer, store, utils
    boards/            # Board surfaces + shared workspace/kanban/matrix
    shell/             # App chrome / navigation
    auth/              # Login
  shared/ui/           # Cross-feature primitives (Modal, FilterChip)
  lib/supabase/        # Supabase clients
  data/                # Seed catalogues
```

### Naming (MVP → production)

| MVP | Production |
|-----|------------|
| View2 / view2 | `PinDetailDrawer` / `pin-detail-*` |
| Board Parent | Catalog (`/boards/catalog`) |
| Board Child | Formats (`/boards/formats`) |
| Client / Sell / Creative | Clients / Sell Channels / Creative Packs |
| BoardChrome | `BoardWorkspace` |
| PinsProvider | `PinCatalogProvider` |

Reusable building blocks: `PinCard`, `TagCategoryField`, `FormatPackEditor`, `KanbanColumn`, `PinAttachModal`, `BoardFilterBar`, `Modal`, `FilterChip`.

## Supabase

**New empty project:** follow [`supabase/BOOTSTRAP.md`](supabase/BOOTSTRAP.md).

1. Run `supabase/bootstrap-workspace.sql` in the SQL editor (workspace + board tables).
2. Run `supabase/flat-lay-schema.sql` (canonical flat-lay library).
3. Copy `.env.local.example` → `.env.local` and set Supabase + `GROQ_API_KEY`.
4. `npm run seed:flat-lay` (needs service role key; loads `data/flat_lay_*.json`).
5. Restart `npm run dev`. Sign up, then set your profile `role` to `super_admin`.

Legacy modular scripts (`schema.sql`, `rbac.sql`, …) remain for older databases. Prefer the bootstrap path above on a fresh DB.

Workspace **Onboarding** is at `/onboarding` (visible to all signed-in roles).

## Deploy

**Docker (standalone Next.js output):**

```bash
docker compose up --build
```

Or any Node host:

```bash
npm run build && npm start
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment.

## Routes

| Path | Board |
|------|--------|
| `/boards/catalog` | Catalog grid |
| `/boards/formats` | Format kanban + flat lay |
| `/boards/clients` | Client tags |
| `/boards/sell-channels` | Sell channels |
| `/boards/creative-packs` | Creative packs |
| `/boards/problems` | Problem matrix |
| `/login` | Auth |
