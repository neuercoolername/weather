# Claude Development Guide

## Project
Weather art project. Minimal aesthetic — the trace is the focus, not data.
See `docs/state.md` for current architecture and feature status.

## Stack
Next.js, PostgreSQL, Prisma, Vitest, Open-Meteo API

---

## Development conventions

### Starting a feature
- Read `docs/state.md` before starting
- Read the feature spec in `docs/{featureName}/description.md`
- Write an implementation plan in `docs/{featureName}/implementation-plan.md`
- Write a checklist in `docs/{featureName}/checklist.md` based on the plan
- Get confirmation before writing any code

### During a feature
- Work through the checklist step by step
- Write tests for new functionality
- Run `npm test` after completing each checklist step
- Do not move to the next step if tests are failing

### Finishing a feature
- All checklist items marked complete
- All tests passing
- Run `npm run build` to test if project builds without errors
- Update `docs/state.md` to reflect schema changes, new features, new endpoints
- Mark the feature as complete in `docs/state.md`
- Update `/README.md` if major changes have been made
- Update `docs/backlog.md` if applicable

### Database
- Schema changes: `npx prisma migrate dev --name <description>` — generates a SQL file in `prisma/migrations/`, review it, then commit it alongside the code change
- Production migrations run automatically via CI/CD (`prisma migrate deploy`) on every deploy to main
- `prisma db push` is BANNED — never use it
- NEVER run any destructive DB command without showing the user exact table names and row counts and getting explicit confirmation

### General
- Keep changes small and incremental
- Prefer explicit over clever
- If something is unclear in the spec, stop and ask — don't assume