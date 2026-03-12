# Wind Trace — Feature Spec

## Overview

A new feature for the existing weather app. It takes the hourly wind observations already being collected and draws a continuous path — each observation moves a point forward by wind speed in the wind direction. Over days and weeks, this produces a trace that occasionally crosses itself. These self-intersections connect two moments in time. The user writes a short text responding to each intersection, linking the two days.

Single user. Public-facing — the trace and the writings are visible to visitors on the web.

## How it works

### The trace

Starting from an origin point, each weather observation extends the path: wind direction (degrees) determines the angle, wind speed (km/h) determines the step length. The trace is cumulative and permanent — it grows with every new observation and never resets.

The existing hourly cron already fetches weather data including `wind_direction_10m` and `wind_speed_10m` from Open-Meteo. The trace computation builds on this data.

### Intersection detection

After each new observation is added, the system checks whether the new line segment crosses any previous segment. This runs as part of the hourly cron job.

When an intersection is detected, the system records it: the two observation references, the geometric coordinates of the crossing point, and an empty text field for the user's eventual response.

### Writing

When an intersection is detected, the user is invited to write a short text connecting the two moments — no prescribed length or format. For MVP, the text is entered directly into the database via an admin route or script. 

Not every intersection needs a response. An unanswered intersection is still part of the work — the wind connected two days, the human chose not to (or hasn't yet).

Visitors can read the texts by interacting with intersection points on the trace.

### Notification

The iOS app is a minimal Expo Go setup doing GPS tracking only — push notifications aren't feasible there. The public page should not reveal which intersections have been written to yet. For MVP, notification is out of scope — the user checks manually or we add email notification as a stretch goal.

### Display

The trace page shows:

- The full accumulated path as a line drawing — black on white, minimal
- Intersection points marked with dots — all look the same whether they have writing or not
- Visitors can interact with intersection points. If a text exists, it's shown. If not, the point is still visible — an intersection without a response is part of the work

## Data

The feature depends on fields already being collected. Early observations in the database are missing `wind_direction_10m` — the extended fields were added on Feb 17. The trace starts from the first observation that includes wind direction.

### New data the feature produces

- **Trace points**: stored (x, y) position for each observation. Precomputed when the weather snapshot arrives and persisted — avoids recalculating an ever-growing chain on every page load.
- **Intersections**: the two observation references, the (x, y) crossing point, and an optional text field for the writing. The text may be null — intersections can exist without a response.

### Resolved decisions

- **Store the trace**: yes. Compute (x, y) when each new weather observation arrives, store alongside or linked to the snapshot.
- **Gap handling**: gaps in hourly data (API unreachable, missing hours) are treated as no gap. The trace connects to the next available point with a straight line. No interpolation, no skipping.
- **Writing interface (MVP)**: the user writes text directly into the database (via a simple admin route or script). The text lives with the intersection record. No public-facing writing form needed for v1.

### Open questions for implementation

- **Data structure**: should trace points live as columns on the existing weather snapshot table, or in their own table? Same question for intersections — a separate table referencing two snapshot IDs with coordinates and a nullable text column is the obvious shape, but worth considering if intersection + text should be separate tables for flexibility.
- **Scaling the trace display**: the trace will eventually extend far. Does the view auto-fit to show the full path? Does it scroll/zoom? Does it crop to recent activity?
- **Intersection detection efficiency**: checking every new segment against all previous segments is O(n) per observation. Fine for hundreds of points, but over a year (~8,700 observations) it grows. Spatial indexing could help later but is probably premature for MVP.
