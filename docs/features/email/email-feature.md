# Intersection Email Notification

## Summary

When the wind trace crosses itself and a new intersection is detected, send an
email notification to the user. MVP sends to a hardcoded address; the system is
designed so inbound reply-to-write can be added later without changing providers
or architecture.

---

## Context

Intersections are detected during the hourly weather-fetch cron cycle. After a
new trace point is computed, `detectAndStoreIntersections` checks the new segment
against all previous segments. When a crossing is found, a row is inserted into
the `Intersection` table. The `text` field on that row is nullable — the user
writes a reflection later, currently via an authenticated POST to
`/api/intersections/[id]`.

This feature adds email as the notification channel for new intersections.

---

## Provider

**Resend** (https://resend.com)

Chosen for:
- Free tier: 3,000 emails/month (100/day) — well within project volume
- Inbound email support on all tiers including free — enables future
  reply-to-write without switching providers
- Simple HTTP API, official Node.js SDK
- DNS setup: TXT record for domain verification (sending only);
  MX records added later when inbound is needed

### Alternatives considered

| Provider   | Free tier        | Inbound on free | Notes                                |
|------------|------------------|-----------------|--------------------------------------|
| Resend     | 3,000/mo         | Yes             | Selected                             |
| Postmark   | 100/mo           | No (Pro+ only)  | Better reply parsing, but paid       |
| SendGrid   | 60-day trial only| N/A             | No permanent free tier               |
| Self-hosted| Free             | Yes             | Port 25 exposure, deliverability ops |

---

## MVP Scope

### What it does

1. An intersection is detected
2. An email is sent to a hardcoded address containing:
   - The two dates/times whose wind segments crossed
   - The intersection ID (for reference / future use)
3. That's it — no reply handling, no rich content

### What it doesn't do (backlog)

- Reply-to-write: replying to the email writes directly to the intersection's
  `text` field (requires inbound email setup — MX records, webhook route,
  reply-body parsing)
- Rich email content (weather conditions, trace visualization, etc.)
- Configurable recipient
- Notification preferences / opt-out

---

## Design

### Email content

**From:** `trace@<subdomain>` (or similar — must match verified sending domain)

**To:** hardcoded in environment variable

**Subject:** `Intersection — <date A> × <date B>`

**Body (plain text):**

```
The wind trace crossed itself.

<date A, human-readable> and <date B, human-readable> now share a point.

---
Intersection ID: <id>
```

Date format should include day-of-week and time, e.g.
`Tuesday 18 Feb 2026, 14:00`. Both dates refer to the `fetchedAt` timestamps
of the two `WeatherSnapshot` records linked through the intersecting
`TracePoint` pairs.

### Reply-to address (future-proofing)

Even in the MVP, set the reply-to header to:

```
trace+<intersectionId>@<subdomain>
```

This costs nothing and means when inbound is enabled later, the routing is
already in place. Replies before inbound is configured will simply bounce or
go undelivered — no harm done.

### Integration point

The send happens inside `lib/weather.ts`, at the end of the intersection
detection flow. After `detectAndStoreIntersections` returns newly created
intersections, iterate and send one email per intersection.

Sending is fire-and-forget: log errors but don't let a failed email break
the weather-fetch cycle. The intersection is already persisted in the database
regardless of whether the email succeeds.

### New files

| File                    | Purpose                                          |
|-------------------------|--------------------------------------------------|
| `lib/email.ts`          | Resend client init + `sendIntersectionEmail()`   |

### Environment variables

| Variable                | Description                                      |
|-------------------------|--------------------------------------------------|
| `RESEND_API_KEY`        | Resend API key                                   |
| `NOTIFICATION_EMAIL`    | Hardcoded recipient (MVP)                        |
| `EMAIL_FROM`            | Sender address, e.g. `trace@<subdomain>`         |

### Dependencies

```
resend (npm package)
```

---

## DNS Setup

On the subdomain used for sending:

1. **TXT record** — Resend domain verification (value provided by Resend
   during setup)
2. **SPF / DKIM** — additional TXT/CNAME records per Resend's instructions
   for deliverability

No MX records needed for MVP (sending only). MX records are added when
inbound reply processing is implemented.

### Cloudflare tunnel

No changes required. The email is sent as an outbound HTTPS request from the
Next.js server to Resend's API (`api.resend.com`). This does not pass through
the Cloudflare tunnel, which only handles inbound requests to the server.

When inbound is added later, Resend's webhook POST to the server *will* come
through the tunnel, but it's a standard HTTP request — no special configuration.

---

## Backlog: Reply-to-Write

Deferred from MVP. Documented here for continuity.

### Flow

1. User replies to intersection notification email
2. Reply goes to `trace+<intersectionId>@<subdomain>`
3. Resend receives it (MX records point to Resend's inbound servers)
4. Resend parses the reply and POSTs structured JSON to a webhook
5. New route `/api/intersections/inbound` receives the webhook
6. Route extracts intersection ID from the recipient address and reply body
   from the payload
7. Writes body text to the intersection's `text` field

### Requirements when implementing

- MX records on subdomain pointing to Resend's inbound servers
- Webhook URL configured in Resend dashboard
- New API route: `/api/intersections/inbound`
- Reply body extraction (Resend provides parsed text, but stripping signatures
  and quoted content may need additional handling)
- Webhook authentication (verify requests are from Resend)
- Decide behavior for replies to intersections that already have text
  (overwrite? append? reject?)