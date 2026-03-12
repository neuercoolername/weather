# weather

A personal weather display. An iOS app posts my GPS coordinates to this server; it fetches current conditions from Open-Meteo, asks Claude to write a haiku about them, and shows it on a minimal webpage. The favicon updates to match the weather.

## how it works

1. **[iOS app](https://github.com/neuercoolername/ios-gps-tracker) → `POST /api/location`** — sends `{ lat, lon }`. Location saved, weather fetch kicks off in the background.
2. **Open-Meteo** — free weather API, no key needed. Returns temperature, precipitation, wind, cloud cover, WMO weather code, and day/night flag.
3. **Claude** (`claude-haiku-4-5-20251001`) — writes a 5-7-5 haiku from the raw weather JSON, incorporating literal field values.
4. **Hourly cron** — re-fetches weather for the most recent location every hour at :00, keeping the haiku current through the day.
5. **Page** — shows the latest haiku. The favicon is a weather emoji (☀️ 🌤️ ☁️ 🌫️ 🌧️ 🌨️ ⛈️) picked from the WMO code and time of day.

## stack

- Next.js (App Router) — page + API route + cron via instrumentation hook
- PostgreSQL + Prisma — locations, weather snapshots, haikus
- Open-Meteo — weather data
- Anthropic Claude — haiku generation
- Docker — deployment
