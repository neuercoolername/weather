# Public branch ("haiku" deploy)

Target architecture and migration path for a second, publicly-viewable deployment of this
project, used as a portfolio piece. This is a planning doc — nothing here is implemented yet.
Update it as decisions firm up or the migration proceeds; treat it as living state, like
`docs/state.md`, not a changelog.

**Shape:** one repo, two long-lived branches — `main` (private, unchanged) and `public` (the
haiku deploy) — rather than two separate repos. A real GitHub fork was considered first, but
since both are meant to be public anyway, a repo split only adds duplicated CI config, secrets,
and issue tracking for no real isolation benefit. Two branches in one repo give the same
cherry-pick mechanics with far less overhead.

## Why

The code for this repo is already public on GitHub. What's private is the *content*: the
hand-written `Intersection.text` annotations and the `IntersectionImage` uploads are personal
and gated behind `VIEWER_PASSWORD`. For a portfolio piece meant to be shown to strangers
(prospective employers), that content can't be public — but the build, design, and deploy
setup should be shown off, not hidden.

Shareable: all code, the deploy/CI setup, the GPS/weather trace shape itself (not considered
sensitive).
Private: hand-written intersection text, uploaded photos — i.e. the personal curation layer.

## Two-instance model

| | Private (`main`) | Public (`public` branch) |
|---|---|---|
| Purpose | Personal | Portfolio/showcase |
| Access | `VIEWER_PASSWORD`-gated | Open, no gate |
| Intersection text | Hand-written via admin CMS | LLM-generated haiku |
| Photos | `IntersectionImage` via Supabase | None |
| Email notifications | Yes (`RESEND_API_KEY`) | No |
| Location entry | Manual, via admin (`/admin/location`) | Manual, via admin — same mechanism, own data |
| Database | Existing Postgres | New, separate Postgres |
| CI/CD | Existing `deploy.yml` job, triggers on push to `main` | New branch-conditional job, triggers on push to `public` |
| Deploy target | Existing container/DB on the same infra | New container/DB on the same infra |

Both instances run independently end-to-end (own cron, own ingest, own DB) — there is no data
replication between them. They share code lineage via git branch, not a runtime dependency.

## Branch mechanics

- `main` keeps working exactly as it does today — nothing about it changes.
- `public` branches off `main` and carries the diverging changes described below (no gate, no
  email, LLM-generated text instead of hand-written, no photo upload).
- Day-to-day: work on whichever branch a change belongs to, and push it to that branch as usual.
- A **shared change** (e.g. a trace-math bug fix, a visual tweak unrelated to the
  gate/email/admin split) — commit it on whichever branch it naturally belongs to first, then
  cherry-pick it onto the other:
  ```
  git checkout main
  # ...commit the fix...
  git push origin main

  git checkout public
  git cherry-pick -x <commit-hash>
  git push origin public
  ```
  `-x` stamps the cherry-picked commit with `(cherry picked from commit <hash>)`, so
  `git log` on either branch shows what's already been ported.
- Optional: `git worktree add ../weather-public public` gives a second working directory backed
  by the same repo/clone, useful if you want both branches checked out and runnable at once
  without switching.

## Code changes needed on `public`

- **Revive LLM generation.** The original pipeline was cleanly removed from `main` in commit
  `4ac55a9` ("move trace to root, remove AI generation pipeline") and the `@anthropic-ai/sdk`
  dependency was dropped afterward in `bc5e8e9`. The old code is still readable on the unmerged
  `feature/ai-haiku` branch, or via `git show 4ac55a9^:lib/haiku.ts` and
  `git show 4ac55a9^:lib/intersection-text.ts`.
  - `lib/haiku.ts` (old) called `anthropic.messages.create` per `WeatherSnapshot` to write a
    5-7-5 haiku, stored in a since-removed `Haiku` model. Nothing in the current UI renders a
    per-snapshot haiku, so this model isn't reinstated as-is.
  - `lib/intersection-text.ts` (old) generated 1-3 sentences of "augur" prose per `Intersection`
    from its paired snapshots, stored in a since-removed `IntersectionText` model (plus the raw
    prompt payload).
  - Current schema only has one remaining text field: `Intersection.text`. The `public` branch's
    generator should target that field, adapted to produce a haiku (open question below: plain
    5-7-5 vs. the old augur tone).
- **Hook point:** [lib/server/weather-ingest.ts](lib/server/weather-ingest.ts) — specifically
  `processIntersections()` (weather-ingest.ts:82-93), which is exactly where the old
  `generateIntersectionText` call used to sit before email-sending, per the `4ac55a9` diff. Add
  the haiku generation there, writing to `Intersection.text` before/alongside
  `sendIntersectionEmail`.
- **Remove `VIEWER_PASSWORD` gate:** `app/api/viewer-login/route.ts` and the gating logic in
  `lib/server/auth/redirect.ts`.
- **Drop email notifications:** `lib/server/email.ts` and its call site in
  `processIntersections()` (weather-ingest.ts).
- **Trim the admin CMS:** keep `/admin/location` (`app/api/admin/location/route.ts`,
  `app/admin/location/LocationForm.tsx`) unchanged — manual location entry already replaced iOS
  GPS posting on both instances and needs no change here. Drop hand-text/photo entry
  (`app/api/admin/intersections/*`, `IntersectionImage` model, Supabase image upload in
  `lib/server/images.ts`/`lib/server/supabase.ts`) since photos are private and text is now
  generated. Whether the admin UI keeps a manual "regenerate this haiku" trigger, or drops the
  per-intersection admin UI entirely, is open (see below).
- **Prisma:** schema otherwise unchanged. Only drop the `IntersectionImage` model/migration if
  the open question below is resolved in favor of full removal rather than just leaving it
  unused.

## CI/CD & infra

No branch conditionals and no second workflow filename needed — `.github/workflows/deploy.yml`
is a tracked file like any other, so `main` and `public` simply each carry their own independent
copy, edited only on the branch it belongs to:

- **`main`'s `deploy.yml`** — unchanged: triggers on `main`, tags `:latest`, deploys `weather`,
  migrates via `prisma migrate deploy` run directly from the GitHub Actions runner (works because
  Supabase's Postgres is reachable from the public internet).
- **`public`'s `deploy.yml`** — same shape, different content: triggers on `public`
  (`on: push/pull_request: branches: [public]`), tags `ghcr.io/neuercoolername/weather:public`,
  deploys the `weather-public` compose service.
- **Postgres is self-hosted, not Supabase** — free-tier Supabase project limit reached, and the
  server already runs Docker Compose, so a second local Postgres container (same pattern as the
  local dev `db`/`db-public` split) costs nothing new. It stays on the server's internal Docker
  network, never exposed to the internet or through the Cloudflare Tunnel.
- **No DB-related GitHub secrets at all**, as a consequence: since the database isn't reachable
  from the GitHub Actions runner, migrations can't run there the way `main`'s do. Instead,
  `public`'s SSH deploy step runs `docker compose run --rm --no-deps --user root weather-public
  sh -c "npm install -g prisma@<version> && npx prisma migrate deploy"` against the same service
  definition the running container uses — so it resolves `DATABASE_URL`/`DIRECT_URL` from
  `infra-repo`'s `.env` the same way `docker compose up` does, no separate wiring needed. `prisma`
  (the CLI) isn't in the runtime image — `Dockerfile` deliberately strips devDependencies — so
  it's installed fresh in that one-off run each deploy; keep its pinned version in sync with
  `package.json`'s. `--user root` because the image otherwise runs as the non-root `nextjs` user,
  who can't write to npm's global install path.
  - The alternative considered was a Cloudflare Access TCP route so the runner could reach
    Postgres directly, tunneled — rejected in favor of the above: it's more Zero Trust config to
    maintain, and means the database *can* be reached from outside the server at all, even if
    gated behind Access, versus never being reachable except from the server itself.
- The SSH/service-token secrets remain shared repo-level secrets (same server, both deploys).
  Runtime app config isn't a GitHub secret at all — it's set on the server via `infra-repo`'s
  `.env`. By decision, `public` **reuses `main`'s `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, and
  `SESSION_SECRET`** rather than getting distinct values — only the database differs, so only
  `WEATHER_PUBLIC_DATABASE_URL`, `WEATHER_PUBLIC_DIRECT_URL`, and `WEATHER_PUBLIC_DB_PASSWORD` are
  new. `API_KEY` isn't needed at all — nothing posts to `/api/location` on this branch.
- **`backup.yml`** (nightly encrypted DB dump) currently targets `main`'s Supabase DB only. A
  self-hosted Postgres needs its own backup mechanism (e.g. `pg_dump` run on the server via cron,
  or a parallel GitHub Actions job that reaches it the same way the migration does) — worth
  deciding when this is built, not before.
- Production containers run via the sibling `infra-repo` compose file, not in this repository, so
  it can't be edited directly from here. The exact blocks to add — a `weather-public-db` Postgres
  service and a `weather-public` app service (image `ghcr.io/neuercoolername/weather:public`,
  Traefik host rule `wind.davidamberg.work`, both on the existing `web` network, no new network or
  exposed ports needed since neither Traefik nor Cloudflare route to the DB) — were given directly
  to the user to paste in; not reproduced here since this doc doesn't hold infra-repo's content.

## Local dev: two DBs, two worktrees

Since `main` and `public` share one working copy of the repo, `.env` doesn't change when you
switch branches — so each branch needs its own persistent checkout to avoid pointing the wrong
branch at the wrong database:

- `/home/david/projects/weather` — stays on `main`, dev DB on port 5433 (`docker compose up -d db`).
- `/home/david/projects/weather-main` — a `git worktree` for `main`, same DB, for when `public`'s
  primary folder needs to be on `public`.
- The `public` branch's primary folder runs its own dev DB on port 5434
  (`docker compose up -d db-public`, defined alongside `db` in `docker-compose.yml` on the
  `public` branch only).

Cherry-picking a shared commit between them is the same `git checkout <branch> && git cherry-pick
-x <hash>` from the relevant folder, per "Branch mechanics" above.

## Execution checklist

1. ~~Branch `public` off `main`.~~ Done.
2. ~~Provision a new Postgres DB for the `public` deploy.~~ Done for local dev (port 5434). For
   production: self-hosted on the same server as a new Docker Compose service, not Supabase (free
   tier limit reached) — see step 8.
3. ~~On `public`: remove `VIEWER_PASSWORD` gate, drop email notifications, trim hand-text/photo
   admin UI.~~ Done — also removed the now-dead `IntersectionImage` model, `lib/server/images.ts`,
   `lib/server/supabase.ts`, `lib/server/image-urls.ts`, and `components/ImageFrame.tsx`.
4. ~~On `public`: revive LLM haiku generation (adapt `feature/ai-haiku`'s `lib/haiku.ts`), wire
   into `processIntersections()` in `lib/server/weather-ingest.ts`.~~ Done — `lib/server/haiku.ts`,
   plain 5-7-5, fully automatic (no admin override).
5. ~~Run a migration on `public`'s DB for the schema changes.~~ Done —
   `20260924162246_drop_intersection_image`, applied to the fresh local dev DB (nothing to lose
   there, unlike `main`'s populated dev DB, which was left untouched).
6. ~~Add DB-related GitHub secrets.~~ Not needed — Postgres is self-hosted and never reachable
   from GitHub Actions; see "No DB-related GitHub secrets at all" above. No GitHub-side step here.
7. ~~Retune `deploy.yml` for this branch.~~ Done — this branch's own copy of `deploy.yml` now
   triggers only on `public`, tags `:public`, and runs migrations via a one-off container over
   SSH instead of a `secrets.*`-based step on the runner. `main`'s copy of the same filename is
   untouched.
8. Add `weather-public-db` and `weather-public` services to `infra-repo`'s compose file
   (`wind.davidamberg.work`), and three new lines to its `.env`: `WEATHER_PUBLIC_DB_PASSWORD`,
   `WEATHER_PUBLIC_DATABASE_URL`, `WEATHER_PUBLIC_DIRECT_URL` (same password embedded in all
   three — `.env` files don't expand references to other vars within themselves) — **not done**,
   outside this repo.
9. Set the `public` deploy's location manually via `/admin/location`, same as the private
   instance — pending first deploy.
10. First deploy; smoke test: hourly cron fetches weather, trace renders, a real intersection
    gets an LLM-generated haiku, no password gate, no email sent — pending steps 6-8.
11. ~~Update this doc and `docs/state.md` to reflect the finished state.~~ Done for the code-level
    changes; will need a final pass once the deploy itself (steps 6-10) is live.

## Open questions

- ~~Does admin CMS keep any manual override/regenerate UI for haikus?~~ Resolved: no, fully
  automatic, no per-intersection admin UI at all.
- ~~Is `IntersectionImage` / the Supabase image path deleted on `public`, or just left unused?~~
  Resolved: deleted entirely.
- ~~Haiku prompt style?~~ Resolved: plain 5-7-5, adapted directly from the old `lib/haiku.ts`.
- Does `backup.yml` need to cover the `public` DB from day one, or can that wait? Still open.
- Exact name for the `weather-public` service in `infra-repo`'s compose file — `deploy.yml`
  currently assumes that name.
