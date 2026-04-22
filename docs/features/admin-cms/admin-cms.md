# Intersection CMS

## What this is

A minimal authenticated admin interface for managing intersection content —
editing the reflection text and adding/captioning/removing images. Reached
primarily from the intersection email notification link; secondarily from a
list view.

Single-user, password-protected. Not a dashboard. Not a corpus browser. Just
the thing you reach for when an intersection happens and you want to respond.

---

## Scope

### In scope
- Password login for `/admin/*` routes
- Intersection list view (recent first)
- Intersection detail/edit view — text and images
- Image upload, caption, delete
- New `IntersectionImage` table
- Supabase Storage for image blobs
- Email notification link points to `/admin/intersections/[id]`
- Removal of the now-unused `POST /api/intersections/[id]`

### Out of scope
- User accounts, 2FA, magic links
- Image reordering UI (upload order is the order)
- Image processing / thumbnails / resizing
- Bulk operations, search, filter, tags
- Augur text management (the `IntersectionText` feature is parked)
- iOS app changes
- Rate limiting beyond login
- Reply-to-email writing interface (remains backlog)

---

## Auth

Single shared password. Session cookie. That's it.

### Secrets
- Existing `API_KEY` — unchanged, still authenticates iOS `POST /api/location`
- New `ADMIN_PASSWORD` — the login password for the CMS

### Session
- `iron-session` for signed encrypted cookies
- `SESSION_SECRET` env var (32+ char random string)
- httpOnly, secure, sameSite=lax
- 30-day sliding expiry (refresh on activity)

### Routes
- `GET /admin/login` — password field, submit button, nothing else
- `POST /api/admin/login` — compares password, sets cookie, redirects to `/admin/intersections` (or `?next=` if present)
- `POST /api/admin/logout` — clears cookie, redirects to `/admin/login`

### Protection
- Middleware on `/admin/*` (except `/admin/login`) and `/api/admin/*` (except `/api/admin/login`)
- Unauthenticated requests to `/admin/*` redirect to `/admin/login?next=<original-path>`
- Unauthenticated requests to `/api/admin/*` return `401`

### Login brute-force
- In-memory counter, 5 failed attempts per IP per 15 minutes, then 401 with a generic message
- Reset on server restart — acceptable at this scale
- No account lockout, no email alerts

---

## Schema changes

### New table: `IntersectionImage`
```
id            String   @id @default(cuid())
intersectionId String
intersection  Intersection @relation(fields: [intersectionId], references: [id], onDelete: Cascade)
storageKey    String   // path in Supabase bucket, e.g. "intersections/<id>/<uuid>.jpg"
caption       String?
createdAt     DateTime @default(now())

@@index([intersectionId])
```

### `Intersection` relation
Add `images IntersectionImage[]` on the existing `Intersection` model.

### Existing `Intersection.text`
No schema change. Already nullable. Edited in place (overwrite).

---

## Storage

### Supabase Storage
- New bucket: `intersection-images`
- Private bucket (not public) — access via signed URLs only
- Server-side uploads using the service role key
- Storage path convention: `intersections/<intersectionId>/<uuid>.<ext>`
- Store the storage key in DB, not the URL (URLs are re-signable, keys are stable)

### Env
- `SUPABASE_URL` (likely already set)
- `SUPABASE_SERVICE_ROLE_KEY` (new — server-only, never exposed to client)

### Signed URL generation
- Detail view requests signed URLs server-side when rendering
- 1-hour expiry is fine (page won't be open longer in practice)
- No CDN caching concerns at this scale

---

## Routes

### Pages
- `GET /admin/login` — login form
- `GET /admin/intersections` — list view
- `GET /admin/intersections/[id]` — detail/edit view

### API
- `POST /api/admin/login` — accepts `{ password }`, sets session
- `POST /api/admin/logout` — clears session
- `PATCH /api/admin/intersections/[id]` — accepts `{ text: string | null }`, overwrites
- `POST /api/admin/intersections/[id]/images` — multipart file upload, optional caption field, returns created image
- `PATCH /api/admin/intersections/[id]/images/[imageId]` — accepts `{ caption: string | null }`, overwrites
- `DELETE /api/admin/intersections/[id]/images/[imageId]` — removes from DB and storage

### Removed
- `POST /api/intersections/[id]` — delete the route file entirely. Confirmed unused; was a relic of an earlier "reply from iOS" idea. Grep the iOS source before deletion to be safe.

---

## UI

### List view — `/admin/intersections`
Vertical list, most recent intersection first. Each row:
- Date of crossing (e.g. `2026-02-14 14:00`)
- Truncated text preview (1 line, ~80 chars) or `—` if empty
- Image count (e.g. `3 images`) or nothing if zero
- Whole row is a link to `/admin/intersections/[id]`

Paginated, 50 per page. Query param `?page=N` (1-indexed). Default is page 1.
At the bottom of the list: "← newer" / "older →" links, shown only when the
respective direction has more results. No page numbers, no jump-to-page, no
total count. Same quiet typographic treatment as the rest of the page.

No table borders. No column headers. Lean on whitespace and type hierarchy.

### Detail view — `/admin/intersections/[id]`

Top: intersection metadata as a small, quiet block.
- Crossing time (timestamp of the later trace point)
- Crossing coordinates `(x, y)`
- Classification (`loop` / `return`) if that data is stored on the intersection — otherwise skip
- Link back to `/admin/intersections`
- Link to the intersection on the public `/trace` page (so you can see where it is)

Middle: text editor.
- Single `<textarea>`, auto-growing
- Debounced auto-save to `PATCH /api/admin/intersections/[id]` (1–2 second debounce)
- Subtle saving/saved indicator (single small line of text, no spinner chrome)
- Empty text is valid (clears the field)

Bottom: image section.
- Existing images listed in upload order (oldest first)
- Each image row: image thumbnail (or just the image itself at reasonable max-width), caption field, delete button
- Caption field: single-line input, auto-save on blur or debounced
- Delete: confirms inline (button becomes "Confirm delete?" on first click, executes on second), no modal
- Upload: file input + drag-and-drop zone at the bottom of the section
- During upload: show a simple progress or at least a pending placeholder. Nothing fancy.

### Login view — `/admin/login`
- Page title or small heading
- Single password field
- Submit button
- Error state: red text line above field on wrong password. Nothing more.
- If already authenticated, redirect to `/admin/intersections`

---

## Image upload

### Constraints
- Accept: `image/jpeg`, `image/png`, `image/webp`, `image/heic` (iOS photos)
- Max file size: 15MB — generous, covers phone photos including some RAW-ish
- Reject others with a clear error message
- Increase Next.js API body size limit as needed in route config

### Flow
1. Browser sends multipart POST to `/api/admin/intersections/[id]/images`
2. Server validates size, mime type, intersection existence
3. Server generates `storageKey` = `intersections/<intersectionId>/<uuid>.<ext>`
4. Server uploads bytes to Supabase bucket using service role key
5. Server creates `IntersectionImage` row with `storageKey` and optional caption
6. Returns the created image (with signed URL for immediate display)

### Deletion flow
1. Browser sends DELETE to `/api/admin/intersections/[id]/images/[imageId]`
2. Server verifies ownership (image belongs to that intersection)
3. Server removes blob from Supabase bucket
4. Server deletes DB row
5. If blob deletion fails but DB row exists, log and still delete DB row (orphaned blobs are tolerable; orphaned DB rows pointing at missing blobs are not)

---

## Email notification change

Existing intersection notification email adds a link:
- Text: something like "Respond →" or just the intersection URL
- Points to `/admin/intersections/[id]`
- If not logged in, normal middleware flow redirects through login and back

No other email changes in this feature.

---

## Style guide

The CMS matches the rest of the app visually: minimal, quiet, typographic,
not a product.

### Principles
- **No chrome.** No cards, borders, shadows, gradients, or decorative backgrounds. Whitespace does the work.
- **No icons.** Text labels only. "Delete", not a trash can.
- **No brand colors.** Whatever neutral palette the existing app uses. Black text on off-white or similar.
- **Typography sets hierarchy.** Size, weight, spacing — not boxes.
- **Single column.** No sidebars, no panels, no multi-column layouts. Everything flows top to bottom.
- **Hover states are subtle.** Underline on hover for links; faint background change at most for buttons.
- **No loading spinners.** If something is loading, a word ("saving…") is enough.
- **No toasts or modals.** Confirmation is inline ("Confirm delete?"). Status is inline.
- **Forms are unadorned.** Native inputs styled minimally. No floating labels, no fancy validation UI.
- **Errors are one line of text.** Red or otherwise distinguished, adjacent to the thing that failed.

### What to match from the existing app
Match the fonts, neutral palette, base font size, link color, and spacing
rhythm of the existing `/trace` page and any other public pages. When in
doubt, err quieter and smaller than feels right. This is a workshop, not a
storefront.

### What not to add
- Framer Motion or any animation library
- New component libraries (shadcn, Radix, etc.) unless already in the project
- Custom fonts beyond whatever the app already loads
- Dark mode toggle (match the app's existing mode behavior)

---

## Open decisions deferred to implementation

- Exact Tailwind/CSS class structure — match existing components
- Whether to use Next.js Server Actions for the mutations or traditional API routes — pick whichever matches the rest of the codebase
- Exact auto-save debounce duration — 1s or 2s, try both
- Whether to show the public trace dot color / visual marker in the detail view — nice-to-have, skip if it complicates

---

## Risks / notes

- **Orphaned blobs** if Supabase deletion fails but DB succeeds. Acceptable; a future cleanup script can sweep. Don't block on this.
- **Image count per intersection** isn't bounded. At hobby scale this is fine. If ever pathological, add a limit.
- **HEIC display** — browsers don't natively render HEIC. If this matters, server-side conversion to JPEG on upload. Deferred unless it comes up in practice; phones usually convert on share.
- **No CSRF tokens** on the admin POSTs. Cookie is sameSite=lax which protects most cases. Acceptable for single-user hobby scale.
- **Session secret rotation** will log you out. Fine.

---

## Rollout

1. Schema migration: add `IntersectionImage` table
2. Install deps: `iron-session`, `@supabase/supabase-js` (if not already present)
3. Create Supabase bucket `intersection-images` (private)
4. Set env vars: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
5. Implement auth layer (middleware, login page, login/logout routes)
6. Implement list view
7. Implement detail view + text editing
8. Implement image upload/delete/caption
9. Update intersection email template to include admin link
10. Grep iOS source for `/api/intersections/`, then delete the old route
11. Smoke test end-to-end on a real intersection