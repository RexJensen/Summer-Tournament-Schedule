# Summer Tournament Schedule

Las Vegas summer 2026 poker tournament schedule with per-user tracking. Next.js 14 (App Router) + TypeScript + Tailwind, backed by [Replit DB](https://docs.replit.com/hosting/databases/replit-database) with a localStorage fallback so the UI keeps working even if the DB is unreachable.

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
pnpm dev
```

Open <http://localhost:3000>. First load prompts for a username, persisted to `localStorage`.

Outside of Replit there is no `REPLIT_DB_URL`, so the API returns 503 and the UI silently falls back to `localStorage` — usable for dev, no setup required.

### Environment

| Var             | Required | Notes                                                                                              |
| --------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `REPLIT_DB_URL` | no       | Injected automatically inside any Repl. Without it the API is disabled and only localStorage runs. |

## Storage

One Replit DB key per user:

- `statuses:<username>` → `{ [event_key]: EventStatus }` JSON blob. `event_key` is the client-derived `${date}|${venue}|${event_name}`.

The schema is created lazily on first write — nothing to provision.

## API

All routes resolve the caller from the `x-username` header (3–20 chars, `[a-zA-Z0-9_]`). No signup, no passwords; whoever has the username can read and write that user's data.

- `GET    /api/me/statuses` → `{ [event_key]: EventStatus }`
- `PUT    /api/me/statuses` → body `{ event_key, status, entries?, cash_amount?, notes? }`, upserts and returns the row.
- `DELETE /api/me/statuses?event_key=…` → unmarks the event.

Returns 503 if `REPLIT_DB_URL` is missing. The frontend handles this by falling back to localStorage.

## Deploying on Replit

1. Import this repo into Replit (or fork the existing Repl).
2. Run `pnpm install && pnpm build && pnpm start` — `REPLIT_DB_URL` is already in the environment.
3. That's it. No schema migration, no external database.

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
  auth.ts                     # x-username header validation
  db.ts                       # Replit DB client wrapper
  eventKey.ts                 # ${date}|${venue}|${event_name}
  types.ts
```

## Credits

Data compiled by [@SpaceyFCB](https://x.com/SpaceyFCB/). Event links open official structure sheets; schedules are subject to last-minute changes by operators.
