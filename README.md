# weather

A personal weather display. An iOS app posts my GPS coordinates to this server; it fetches current conditions from Open-Meteo, asks Claude to write a haiku about them, and shows it on a minimal webpage. The favicon updates to match the weather. Each observation also extends a wind trace — a cumulative path drawn from wind direction and speed. Where the path crosses itself, two moments in time are linked.

## how it works

1. **[iOS app](https://github.com/neuercoolername/ios-gps-tracker) → `POST /api/location`** — sends `{ lat, lon }`. Location saved, weather fetch kicks off in the background.
2. **Open-Meteo** — free weather API, no key needed. Returns temperature, precipitation, wind, cloud cover, WMO weather code, and day/night flag.
3. **Claude** (`claude-haiku-4-5-20251001`) — writes a 5-7-5 haiku from the raw weather JSON, incorporating literal field values.
4. **Hourly cron** — re-fetches weather for the most recent location every hour at :00, keeping the haiku current through the day.
5. **Wind trace** — each observation appends a point to the trace by displacing from the last position by wind direction (degrees) and wind speed (km/h). Stored in `TracePoint`. Intersections between the new segment and all prior segments are detected and stored in `Intersection`.
6. **`/trace` page** — displays the full accumulated path as a line drawing. Intersection points are marked as dots; clicking a dot reveals the two dates that crossed and any text written about them. The view supports zoom and pan.
7. **Page** — shows the latest haiku. The favicon is a weather emoji (☀️ 🌤️ ☁️ 🌫️ 🌧️ 🌨️ ⛈️) picked from the WMO code and time of day.

## stack

- Next.js (App Router) — page + API route + cron via instrumentation hook
- PostgreSQL + Prisma — locations, weather snapshots, haikus, trace points, intersections
- d3-zoom + d3-selection — zoom/pan and fixed-pixel SVG overlay for the trace page
- Open-Meteo — weather data
- Anthropic Claude — haiku generation
- Docker — deployment
