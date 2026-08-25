# weather

A personal weather display. An iOS app posts my GPS coordinates to this server; it fetches current conditions from Open-Meteo every hour and uses the wind to extend a cumulative trace — a single line displaced, observation by observation, by wind direction and speed. Where that line crosses itself, two moments in time are linked. Those crossings are the subject: each one is a place where I can write something and attach photographs.

## how it works

1. **[iOS app](https://github.com/neuercoolername/ios-gps-tracker) → `POST /api/location`** — sends `{ lat, lon }` with a `Bearer $API_KEY` header. The location is saved and a weather fetch kicks off in the background. There's a web fallback at `/admin/location` for setting the position by hand.
2. **Open-Meteo** — free weather API, no key needed. Requests temperature, apparent temperature, humidity, precipitation, weather code, cloud cover, wind speed / direction / gusts, and a day/night flag. The full response is kept as `rawJson` on the snapshot.
3. **Hourly cron** — `instrumentation.ts` starts a node-cron schedule that re-fetches weather for the most recent location every hour at :00.
4. **Wind trace** — each observation appends a point by displacing from the last position by wind direction (degrees) and wind speed (km/h). Stored as `TracePoint`; the origin is `(0, 0)` and the units are km/h, not geographic. The new segment is then tested against every prior segment, and any crossing is stored as an `Intersection`.
5. **Email** — a new intersection sends a plain-text notification via Resend with a direct link to that intersection's admin page. Fire-and-forget: a failed send never breaks the weather cycle.
6. **Writing** — the text and images on an intersection are written by hand in the admin CMS at `/admin/intersections`. Only intersections that have writing or images get a mark on the public trace; the rest stay part of the line.
7. **`/`** — the whole accumulated path as one SVG line, with zoom and pan. The line's stroke and the crossing marks come off the same curve, so they hold the same weight at every zoom; marks that crowd together collapse into one ring, and clicking it travels in until the group comes apart. Clicking a single mark pans it to centre and opens a panel with the two dates, the writing, and any images (full-screen on mobile). The header is not type but an animated wind field — a quiver of short strokes whose statistics come from the last 24 hours of real readings. The favicon is one of the header's own tapered strokes, blown up to fill the tile and snapped to one of the 8 major compass points: the same 24-hour mean direction, tapering the way the wind blows.

## stack

- Next.js 16 (App Router) — page + API routes + cron via the instrumentation hook
- PostgreSQL + Prisma — locations, weather snapshots, trace points, intersections, images
- d3-zoom + d3-selection — zoom/pan and the fixed-pixel SVG overlay
- Canvas — the flow-field header
- iron-session — single-password admin auth, enforced in `proxy.ts`
- Supabase Storage — intersection images in a private bucket, served via signed URLs
- Resend — intersection notification email
- Open-Meteo — weather data
- Docker + GitHub Container Registry — deployment

## running it

Copy `.env.example` to `.env` and fill it in:

| | |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Postgres — pooled connection and the direct one used for migrations |
| `API_KEY` | shared secret the iOS app sends as `Bearer` |
| `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `EMAIL_FROM` | intersection notification email |
| `BASE_URL` | origin only — **no path, no trailing slash**, or every emailed admin link 404s |
| `ADMIN_PASSWORD`, `SESSION_SECRET` | admin CMS login (session secret must be 32+ chars) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | image storage; server-only, never exposed to the client |

```
npm run db:up    # local Postgres (docker compose)
npm run dev      # local server
npm test         # vitest
npm run build    # production build
```

### databases

`.env` points at the local development database from `docker-compose.yml`; production credentials live in `.env.prod` and are loaded explicitly, never by default. The name matters — `.env.production.local` would be picked up automatically by `npm run build`, `.env.prod` is not.

```
npm run db:up                        # start it (waits for healthy)
npm run db:restore -- backup.dump    # load a production dump into it
npm run db:psql                      # a shell on it
npm run db:reset                     # destroy the volume and start clean
```

Seed it from a real backup: grab an artifact from the *Daily DB Backup* workflow with `gh run download`, then `npm run db:restore -- <path>`. Only the `public` schema is restored — Supabase's own schemas belong to the platform, not the app.

Image blobs live in Supabase Storage, in two buckets inside the same project: `intersection-images-dev` for development and `intersection-images` for production, selected by `SUPABASE_BUCKET`. `lib/server/env-guard.ts` enforces the pairing — the local database goes with the dev bucket, the production database with the production bucket — and refuses any write across the two, which is what stops a local row set from deleting real objects. Unset resolves to the production bucket, so the deployed container needs no new variable.

One consequence of restoring a production dump locally: those rows reference objects in the *production* bucket, so their images will not render against the dev bucket. Signing skips keys it cannot resolve, so the page degrades quietly rather than erroring. Upload fresh images locally to see the full path.

Schema changes go through `npx prisma migrate dev --name <description>` against the local database, and the generated SQL is committed alongside the code. `prisma db push` is not used on this project.

**Writing to production** happens in exactly two places: `prisma migrate deploy` on merge to `main`, and the manually dispatched *Run production script* workflow, which is the only thing that sets `ALLOW_PROD=1`. `reset-trace` is local-only and no override unlocks it.

**Deploy** — pushing to `main` runs `.github/workflows/deploy.yml`: it builds the Docker image and pushes it to `ghcr.io/neuercoolername/weather:latest`, applies `prisma migrate deploy`, then pulls and restarts the container on the server over a cloudflared SSH tunnel. A separate workflow takes a daily `pg_dump` backup.

### scripts

- `npm run backfill:trace` — computes trace points for snapshots that predate the trace
- `npm run backfill:images` — re-encodes images stored before the upload pipeline; dry by default, `-- --apply` to write
- `npm run reset-trace` — deletes all trace points and intersections, cascading to every image row and hand-written text. Local only, prints row counts, and demands a typed confirmation.
