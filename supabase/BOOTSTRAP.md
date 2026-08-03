# Fresh Supabase bootstrap (new project)

Run these **in order** in the Supabase SQL Editor, then seed.

## 1. Workspace + legacy board tables

Paste and run:

[`bootstrap-workspace.sql`](./bootstrap-workspace.sql)

This creates everything the app needs for **workspace**:

- `profiles` + signup trigger + RBAC (`user_role`, board permissions)
- CRM (`crm_clients`, `client_assignments`, `notifications`)
- Projects (`projects`, `project_members`, `project_logs`)
- Onboarding (shortlists, chat, `project_items`)
- Activity (`user_login_events`)
- Board library projection tables: `pins`, `problems`, `catalogs`
- RPCs: `upsert_pin_board`, `delete_pin_board`, `upsert_problem_board`, `get_my_effective_board_permissions`, …

## 2. Flat-lay canonical library

Paste and run:

[`flat-lay-schema.sql`](./flat-lay-schema.sql)

Creates:

- `flat_problems`, `flat_parent_groups`, `flat_parent_pins`
- `flat_output_types`, `flat_child_pins`
- `flat_client_packs`, `flat_client_pack_selections`
- `flat_commerce_builds`, `flat_campaign_modes`

## 3. Point the app at the new project

Update `.env` / `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Seed flat-lay JSON → DB

```bash
npm run seed:flat-lay
```

Loads `data/flat_lay_*.json` into flat-lay tables, then **materializes** `pins` / `problems` / `catalogs` so existing boards keep working.

## 5. First user

1. Sign up via `/login`
2. In Table Editor → `profiles` → set `role = super_admin`

## Notes

- Modular files (`schema.sql`, `rbac.sql`, …) remain for historical/patch use.
- Prefer `bootstrap-workspace.sql` + `flat-lay-schema.sql` on an empty project.
- Do **not** run deprecated `rabc.sql`.
