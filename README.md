# Summer Tournament Schedule

Las Vegas summer 2026 poker tournament schedule with per-user tracking. Next.js 14 (App Router) + TypeScript + Tailwind, backed by Postgres.

## Features

- 1,105 tournaments across nine venues, filterable by venue, buy-in range, game category, and a broad search index (venue, date, buy-in, GTD…).
- Vegas-local "today" anchor that scrolls into view regardless of viewer timezone.
- De-duplicated GTD pool total (multi-flight events count once per tournament instance).
- Username-based sign in (no password — single-player tooling).
- Per-event status pill: 📌 Planned · ▶️ Played · 💰 Cashed · ⏭️ Skipped.
- Detail editor: entries (re-entries), cash won, notes.
- Collapsible stats panel: counts, total buy-ins, total cashed, net P&L, ITM%.
- "My events" / "Played" / "Cashes" filter chips.

## Local development

Requires Node 18.18+ and pnpm.

```bash
pnpm install
cp .env.example .env.local      # then fill in POSTGRES_URL
# create the schema once:
psql "$POSTGRES_URL" -f schema.sql
pnpm dev
```

Open <http://localhost:3000>. First load prompts for a username, persisted to `localStorage`.

### Environment

| Var            | Required | Notes                                                                 |
| -------------- | -------- | --------------------------------------------------------------------- |
| `POSTGRES_URL` | yes      | Connection string. Works with Vercel Postgres or Neon out of the box. |

## Database schema

See [`schema.sql`](./schema.sql). Two tables:

- `users (id, username, created_at)` — usernames are unique, auto-created on first API hit.
- `event_status (user_id, event_key, status, entries, cash_amount, notes, updated_at)` — composite PK. `event_key` is the client-derived `${date}|${venue}|${event_name}`.

## API

All routes resolve the caller from the `x-username` header (3–20 chars, `[a-zA-Z0-9_]`). The user row is upserted on every call, so there is no separate signup endpoint.

- `GET    /api/me/statuses` → `{ [event_key]: EventStatus }`
- `PUT    /api/me/statuses` → body `{ event_key, status, entries?, cash_amount?, notes? }`, upserts and returns the row.
- `DELETE /api/me/statuses?event_key=…` → unmarks the event.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add a Postgres integration (Vercel Postgres or Neon). It will inject `POSTGRES_URL` automatically.
4. Apply the schema once against the provisioned database:
   ```bash
   psql "$POSTGRES_URL" -f schema.sql
   ```
5. Deploy. The `/` route is statically rendered; `/api/me/statuses` runs on the Node runtime.

## Project layout

```
app/
  api/me/statuses/route.ts    # GET / PUT / DELETE
  layout.tsx
  page.tsx                    # main client component
components/
  UsernameModal.tsx
  StatusPill.tsx
  DetailSheet.tsx
  StatsPanel.tsx
data/events.json              # 1,105 tournaments
lib/
  auth.ts                     # x-username header → user_id
  eventKey.ts                 # ${date}|${venue}|${event_name}
  types.ts
schema.sql
```

## Credits

Data compiled by [@SpaceyFCB](https://x.com/SpaceyFCB/). Event links open official structure sheets; schedules are subject to last-minute changes by operators.
