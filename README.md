# CrowdJam

A real-time collaborative music jamming platform — built from scratch, combining
the working ideas from two earlier prototypes (CrowdStudio's social/backend
model + Present Mind Sound's generative audio engine) while fixing every bug
found in both during audit.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind, `zustand` for state, `tone.js` for live audio
- **Backend**: Express + TypeScript + Prisma + PostgreSQL, `socket.io` for real-time
- **Auth**: JWT, bcrypt password hashing

## Features (all real, no fakes)

| Feature | Status |
|---|---|
| Auth | No login wall — every visitor gets an automatic guest identity (real, DB-backed) |
| Live Jam Studio | Real Tone.js synthesis — tempo, filter, reverb, scale, all audible |
| Save jam as track | Real DB write, shows up in global feed |
| Global feed | Real, paginated, DB-backed |
| Likes / comments | Real, DB-backed, per-user |
| Leaderboard | Real, DB-backed, time-decayed "hot" ranking — **not** raw like count (old bug) |
| Online presence ("X jamming now") | Real WebSocket count — **not** a hardcoded random number (old bug) |
| Live param sync between users | Real, via socket.io broadcast |
| Jam room live chat | Real, jam-room-scoped (Socket.io rooms), rate-limited, 50-message history |
| Live audience voting (🔥/🎶) | Real, per-track WebSocket room, live "who's winning" bar |
| Per-instrument mixer | Real Tone.Volume nodes per channel — drums/bass/pads/lead each have a live volume fader + mute |
| Export to DAW (WAV + MIDI) | Real files — offline-rendered WAV audio + editable MIDI note data, importable into any DAW |
| AI export | Calls a real configured provider API, or returns a clear "not configured" error — never fakes a result |

## Local setup

### Option A — Docker Compose (easiest, one command)
```bash
docker compose up --build
```
This starts Postgres, runs the backend (auto-applies the Prisma schema via
`prisma db push` on boot), and serves the frontend — all three together.
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: localhost:5432 (user/pass/db: `crowdjam`)

Edit the `JWT_SECRET` in `docker-compose.yml` before using this for anything
beyond local dev. (Note: this Docker setup wasn't build-tested inside the
environment this project was generated in — Docker wasn't available there —
so double check `docker compose up --build` on your machine before relying
on it for a demo.)

### Option B — run backend and frontend separately

#### Backend
```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev    # creates tables
npm run dev                # http://localhost:4000
```

#### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                # http://localhost:5173
```

You need a running Postgres instance for `DATABASE_URL` — easiest local option:
```bash
docker run --name crowdjam-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crowdjam"
```

## Deploying

`render.yaml` at the repo root deploys **both** the backend and frontend as
separate services plus a managed Postgres database. (The old CrowdStudio
`render.yaml` only defined the backend — the frontend was never actually
deployed by that config.)

After first deploy, set `CORS_ORIGIN` on the backend to the real frontend URL,
and `VITE_API_BASE` on the frontend to the real backend URL — the placeholders
in `render.yaml` are intentionally left blank (`sync: false`) so you set them
explicitly rather than accidentally deploying with `CORS_ORIGIN: "*"`.

## Enabling real AI export (optional)

By default, AI export is disabled and the API returns a clear `501` error if
you try to use it. To enable it, set on the backend:

- `AI_EXPORT_PROVIDER` — e.g. `suno`, `elevenlabs`
- `AI_EXPORT_API_KEY` — your provider's API key
- `AI_EXPORT_ENDPOINT` — the provider's actual API endpoint

The request/response shape in `src/routes/aiExport.ts` is written generically
(`{ audioUrl }` response) — you'll need to adjust the request payload to match
whichever provider you pick, since each has a different API contract.

## Design

The visual identity pivoted from an earlier "mixing console" theme to a
dark neon look in the style of Suno/Udio/ElevenLabs — deep near-black base
with a purple→pink→cyan gradient accent, since that's the visual language
people now associate with AI music tools.

- **App shell**: sidebar navigation (`components/AppShell.tsx`) — the
  pattern real platforms use (Spotify, Linear, most DAWs) — instead of a
  single thin top navbar, with a condensed header on mobile.
- **Palette**: near-black base (`#0A0A12`), electric purple/magenta
  primary (`#B24BFF`), electric cyan accent (`#00E5FF`), neon red reserved
  only for errors (`#FF3B5C`). A subtle radial glow anchored to the top of
  the page gives the "lit from an unseen source" depth these apps have,
  without a heavy background image.
- **Neon accents used sparingly**: `.neon-text` (gradient text) and
  `.neon-button` (gradient background + glow shadow) are reserved for the
  logo and the primary "Start Jam" CTA — glowing everything would cancel
  out the effect and just read as noisy.
- **Type**: Space Grotesk for display headings, IBM Plex Sans for body
  text, IBM Plex Mono for anything numeric — BPM, like counts, ranks — the
  way a real console readout would render them.
- **Icons**: lucide-react throughout (Jam Studio channel meters, feed
  actions, leaderboard, nav) instead of raw emoji/characters.
- **Signature element**: an animated VU-meter (`components/VUMeter.tsx`) —
  online presence, per-channel Jam Studio feedback (drums/bass/pads/lead),
  the 404 page — instead of a generic pulsing dot. Respects
  `prefers-reduced-motion`.
- Cards use a "channel strip" treatment (`.channel-strip` utility) to keep
  a mixing-console structural metaphor even under the neon palette.

## The jam engine — what "generative music" actually means here

Being upfront about what this is and isn't:

- **What it is**: a real, free, instant, browser-based generative
  arrangement — four layered parts (drums, bass, sustained pad chords, a
  sparse arpeggiated lead) driven by an actual diatonic chord progression
  (`hooks/useJamEngine.ts`), not a single note wandering a scale. Tempo,
  filter, reverb, scale, and an "Energy" fader (drum density + lead note
  frequency) are all live-adjustable while playing, and synced in real time
  to other users in the jam room over WebSocket.
- **What it isn't**: a Suno/Udio-style tool that produces a finished song
  with vocals, lyrics, and studio-quality mastering. That class of model is
  enormous, runs in the cloud, and cannot be replicated for free in a
  browser — which is exactly why "AI Export" is a separate, clearly-gated
  feature that calls a real external provider (and tells you plainly if
  none is configured) rather than pretending client-side synthesis can
  produce that.
- Chord-building logic is unit tested (`__tests__/jamEngine.test.ts`) since
  it's pure music theory and easy to silently get wrong — worth checking if
  you extend the progressions or add new scales.
- The Studio waveform (`components/AudioVisualizer.tsx`) reads a live
  `Tone.Analyser` tapped off the actual mixed output — it's drawing the
  real signal, not a decorative animation, so if you don't hear anything
  the line will be flat too (useful for debugging audio issues).

## Jam room chat and leaderboard ranking

**Chat** (`socket/index.ts`, `components/ChatPanel.tsx`) is scoped to the
jam room using real Socket.io rooms (`socket.join("jam-room")`) — a client
can't receive messages just by listening for the event without actually
joining, since the server enforces membership before broadcasting. It's
rate-limited per socket (max 1 message / 500ms) with a clear error sent
back to the sender when they're throttled, and keeps the last 50 messages
in memory so someone joining mid-session gets context. This also fixed a
real scoping bug in the pre-existing live jam-parameter sync: it was using
`socket.broadcast.emit`, which sent slider changes to *every* connected
socket including people sitting in the lobby, not just people actually in
the jam room.

**Leaderboard ranking** (`lib/ranking.ts`) uses a time-decayed "hot" score
instead of raw like count. The old ordering had a classic rich-get-richer
problem: a months-old track with hundreds of likes could never be
outranked by a new, genuinely more-engaging track, since likes only
accumulate and the board never "cools down." The score is
`(likes*3 + plays) / (ageInHours + 2)^1.5` — the same style of decay
Hacker News' ranking uses — computed over a bounded 300-track candidate
pool fetched by raw like count (not a full table scan) and re-sorted in
application code. Unit tested in `__tests__/ranking.test.ts`.

## Live voting and the per-instrument mixer

**Live voting** (`hooks/useLiveReactions.ts`, `components/LiveVoting.tsx`)
lets everyone currently viewing a track fire off 🔥 or 🎶 reactions in
real time — a per-track Socket.io room, rate-limited per socket (300ms),
with counts and a live "who's winning" split bar. This is deliberately
**not** persisted to the database: it's an ephemeral "how is the room
feeling right now" signal, distinct from the permanent, DB-backed Like
that actually drives leaderboard ranking. In-memory reaction state for a
track is cleaned up once nobody is left viewing it, so this doesn't leak
memory over the life of a long-running server.

**Per-instrument mixer** (Studio page) gives each of the four arrangement
parts — drums, bass, pads, lead — a real volume fader and mute button,
wired to an actual `Tone.Volume` node inserted into that instrument's
signal chain (not a cosmetic slider). This is what "editing" the live
arrangement actually means here: you can mute the drums, bring the lead
down, etc., while it's playing.

## Tests

Both apps have real tests — not placeholders.

```bash
cd backend && npm test    # 19 tests: auth validation, JWT rejection, like
                           # toggling, 404/rate-limit/malformed-JSON handling
cd frontend && npm test   # 13 tests: error-message extraction, auth
                           # hydration race condition, RequireAuth redirect
                           # timing
```

Backend tests mock Prisma (fast, no DB needed locally). CI additionally
spins up a real Postgres service and runs `prisma db push` against it to
catch schema drift the mocked tests can't.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
- **backend**: typecheck → sync schema to a real Postgres service → test → build
- **frontend**: lint → test → build

Push this repo to GitHub and the workflow runs automatically — no extra setup.

Once you've run `npx prisma migrate dev` locally at least once (creating a
committed `backend/prisma/migrations/` folder), swap the CI's `prisma db push`
step for `prisma migrate deploy` so CI validates your actual migration
history instead of just pushing the current schema.

## Error & load handling

- **Rate limiting**: general API (300 req/15min), auth routes (20/15min,
  stricter — this is the endpoint most exposed to brute-force attempts),
  writes like posting tracks/comments (30/5min).
- **Request size cap**: JSON bodies capped at 256kb to block oversized-payload abuse.
- **Pagination guards**: `GET /tracks?page=` validates and caps the page
  number (max 5000) — an unvalidated page param previously turned into
  `NaN` on non-numeric input, which crashed Prisma's `skip` with a raw 500;
  an unbounded page number let a caller force Postgres to walk and discard
  millions of rows before returning anything.
- **Result caps**: a track's comment list is capped at 200, a profile's
  track list at 100 — without these, a heavily-used account or track forces
  an unbounded query on every page view.
- **AI export timeout**: the external provider call aborts after 30s
  (configurable via `AI_EXPORT_TIMEOUT_MS`) instead of holding the request
  open indefinitely if the provider hangs.
- **Helmet**: standard security headers on every response.
- **Central error handler**: respects a pre-existing HTTP status on the
  error (e.g. body-parser's 413 for oversized payloads, which previously
  fell through to a generic 500), maps Prisma errors (unique-constraint
  conflicts, not-found) to clean 4xx JSON instead of leaking raw DB errors,
  and gives malformed JSON bodies a clean 400 instead of crashing the request.
- **Graceful shutdown**: on SIGTERM/SIGINT, finishes in-flight requests and
  closes the DB connection pool cleanly before exiting (important for
  zero-downtime deploys on Render).
- **Frontend error boundary**: a render crash anywhere in the app shows a
  recoverable "something broke, reload" screen instead of a blank white page.
- **Socket reconnection**: the WebSocket client auto-reconnects (up to 10
  attempts with backoff) and re-authenticates on reconnect; the sidebar
  shows "reconnecting…" instead of silently showing a stale/zero online count.
- **Request timeouts**: frontend API calls time out after 10s instead of
  hanging forever on a stalled connection.
- **Client-side validation**: form inputs mirror backend limits (username
  pattern/length, track title/comment/export-prompt max length) so most
  invalid input is caught before a round trip, while the backend remains
  the source of truth (client-side limits are UX, not security).



**From CrowdStudio (Next.js + Express):**
- `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds` were silently
  hiding real type errors — removed; this codebase is built with strict TS on.
- Login/register showed a generic "failed" message because the frontend read
  `err.message` on an Axios error, which is always `undefined` — fixed to
  read the actual backend error body.
- Dashboard redirected logged-in users to `/login` on refresh due to a race
  between the auth-hydration effect and the redirect effect — fixed with an
  explicit `isLoading` state that gates the redirect.
- `render.yaml` only deployed the backend — frontend service was missing.
- SQLite on ephemeral disk risked data loss on redeploy — moved to managed
  Postgres.
- "AI generation" returned a random stock MP3 regardless of input — replaced
  with a real Tone.js engine, plus an optional real external API hook that
  fails loudly instead of faking a result.

**From Present Mind Sound (Vite + React, no backend):**
- No backend at all — "connected users" and "leaderboard" were fully fake
  (`Math.random()` counters, `localStorage`-only data invisible to other
  users). Replaced with a real Postgres-backed leaderboard and a real
  Socket.io presence system.
- `@import` for Google Fonts was placed after `@tailwind utilities` in the
  CSS, which is invalid per spec — browsers silently drop it in production,
  so the Orbitron display font never actually loaded. Fixed by placing
  `@import` first.
- Single 1.4MB JS bundle with no code splitting — Vite config now splits
  `tone.js` and vendor code into separate chunks.
- The generative audio engine itself (Tone.js synthesis) was legitimately
  good — kept and hardened (proper cleanup/disposal on stop, no
  autoplay-before-gesture issues).

## DAW export (WAV + MIDI)

There is no public API for "connecting" to Ableton, FL Studio, Logic, or
Pro Tools — that live-integration model doesn't exist for third-party web
apps. What real producers actually do is bounce audio and drag files into
their DAW, so that's what this implements, for real:

- **WAV** (`lib/renderJamToWav.ts`, `lib/wavEncoder.ts`) renders 8 bars of
  the current arrangement offline via `Tone.Offline` (deterministic, faster
  than real-time) and hand-encodes it as standard 16-bit PCM — the one
  format every DAW opens natively. The WAV encoder is a small, dependency-free,
  unit-tested function (`__tests__/export.test.ts`) rather than an external
  library, since the format itself is simple and well-specified.
- **MIDI** (`lib/exportMidi.ts`, via `midi-writer-js`) exports real,
  editable note events on three tracks (pads/chords, bass, and a
  deterministic melodic guide) — not audio, actual notes a producer can
  rewrite, quantize, or reassign instruments to in their DAW. It's
  deliberately deterministic rather than trying to "record" the live
  engine's randomized lead/hats, which have no meaningful translation into
  a fixed file — a clean, predictable arpeggio over the same chord tones is
  a more useful starting point for editing.
- Both are pure client-side, no backend or API key required, and reuse the
  exact same chord/scale logic (`SCALES`, `buildTriad`) already tested for
  the live engine, so what you download matches what you heard.

## No login wall — automatic guest identity

There is no login/register UI. On first visit, the app silently creates a
passwordless "guest" account via `POST /auth/guest` and stores its token in
localStorage exactly like a real login would — so track authorship, likes,
and chat usernames still work, but nobody has to fill out a form to use
the app. Returning to the same browser reuses the same guest identity
instead of creating a new one every time. The sidebar shows a "reset
identity" button (`RefreshCw` icon) as the closest equivalent to logging
out, for starting fresh or testing as a different user.

The backend's original email/password `register` and `login` routes are
still there and still tested (in case a real-account flow is wanted back
later) — the frontend just doesn't call them anymore.

## Real songs from Spotify

Paste any `open.spotify.com/track/...` link and it's added to the feed
and leaderboard as a real song, voted and ranked exactly the same way as
CrowdJam sessions — one unified board, both kinds together.

- **No API key or OAuth needed.** This uses Spotify's public, unauthenticated
  `oembed` endpoint just to fetch a display title. The full Spotify Web API
  (search, playback control) requires a Developer app + Client ID/Secret,
  which is a real account-creation step only you can do — this
  intentionally avoids needing that entirely for the MVP.
- **Playback is Spotify's own official embed** (`open.spotify.com/embed/track/...`),
  the same iframe widget used across the web. This app never stores,
  proxies, or streams the actual audio — playback quality/length follows
  each visitor's own Spotify session (full track if they're logged into
  Premium in that browser, a preview otherwise, exactly as Spotify's embed
  is designed to behave). Fully within Spotify's embed terms.
- The `Track` model gained a `kind: "jam" | "spotify"` field (schema
  migration required — see below) so both share the same `Like`/`Comment`/
  leaderboard-ranking code paths without any special-casing there.
