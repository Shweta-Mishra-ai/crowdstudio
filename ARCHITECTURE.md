# CrowdStudio System Architecture & Technical Specifications

Welcome to the technical architecture documentation for **CrowdStudio** — a real-time collaborative music jamming platform combining client-side Web Audio API (Tone.js) synthesis with a high-throughput WebSocket & PostgreSQL backplane.

---

## 🛡️ Heroic Quality Gates (SVG Status Badges)

Below are the **Production Readiness Gates** enforced across CrowdStudio's architecture:

<div align="center">
  <img src="https://img.shields.io/badge/Gate_1:_Real--Time_Audio_Engine-PASSED_Tone.js_v15-4FB8A6?style=for-the-badge&logo=speaker&logoColor=white" alt="Gate 1 Audio Engine" />
  <img src="https://img.shields.io/badge/Gate_2:_WebSocket_Broadcast_Rooms-PASSED_Socket.io_v4-E8A33D?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Gate 2 Socket.io" />
  <img src="https://img.shields.io/badge/Gate_3:_Time--Decayed_Ranking-PASSED_HackerNews_Decay-4FB8A6?style=for-the-badge&logo=postgresql&logoColor=white" alt="Gate 3 Ranking Math" />
  <img src="https://img.shields.io/badge/Gate_4:_Rate_Limiting_%26_Security-PASSED_Express_RateLimit-C1543A?style=for-the-badge&logo=express&logoColor=white" alt="Gate 4 Security" />
  <img src="https://img.shields.io/badge/Gate_5:_CI/CD_%26_Deployment-PASSED_GitHub_Actions_%26_Render-4FB8A6?style=for-the-badge&logo=render&logoColor=white" alt="Gate 5 CI/CD" />
</div>

---

## 🎵 1. Audio Signal Chain Architecture (Web Audio API / Tone.js)

The Jam Studio engine (`hooks/useJamEngine.ts`) processes 4 generative diatonic parts (Drums, Bass, Pads, Lead) through dedicated sub-channel volume nodes into a master DSP processing pipeline.

```mermaid
graph TD
    subgraph Signal Generation
        Kick[Tone.MembraneSynth] -->|Drums Bus| DrumFilter[Tone.Filter 8kHz]
        Hat[Tone.NoiseSynth] -->|Hats -12dB| DrumFilter
        Bass[Tone.MonoSynth] --> BassVol[Tone.Volume]
        Pad[Tone.PolySynth - FMSynth] --> PadVol[Tone.Volume]
        Lead[Tone.PolySynth - Synth] --> LeadVol[Tone.Volume]
    end

    DrumFilter --> DrumVol[Tone.Volume]

    subgraph Channel Mixer Strip & Mute Controls
        DrumVol --> Compressor[Tone.Compressor -18dB]
        BassVol --> Reverb[Tone.Reverb wet:0-1]
        PadVol --> Reverb
        LeadVol --> Delay[Tone.FeedbackDelay 8n]
    end

    Delay --> Reverb
    Reverb --> MasterFilter[Tone.Filter Lowpass]
    MasterFilter --> Compressor

    subgraph Master Output & Visualizer
        Compressor --> MasterOutput((AudioDestination))
        Compressor --> Analyser[Tone.Analyser 256ch]
        Analyser --> Visualizer[AudioVisualizer Canvas 60fps]
    end

    style MasterOutput fill:#E8A33D,stroke:#333,stroke-width:2px
    style Compressor fill:#4FB8A6,stroke:#333,stroke-width:2px
```

---

## ⚡ 2. Real-Time Room Scoping & WebSocket Protocol

WebSocket presence and ephemeral reactions use scoped Socket.io rooms (`socket.join("jam-room")` & `socket.join("track:id")`) with per-socket rate limiting to prevent memory leaks and room bleeding.

```mermaid
sequenceDiagram
    autonumber
    actor UserA as Client A (Studio)
    actor UserB as Client B (Lobby)
    participant Server as Socket.io Server
    participant Room as Jam Room State

    UserA->>Server: emit("join-jam-room")
    Server->>Room: Add UserA socket
    Server-->>UserA: emit("presence-update", { totalOnline: 2, inJamRoom: 1 })
    Server-->>UserB: emit("presence-update", { totalOnline: 2, inJamRoom: 1 })

    UserA->>Server: emit("jam-param-change", { param: "Tempo", value: 110 })
    Note over Server: Rate limit check (500ms window)
    Server->>Room: broadcast.to("jam-room").emit("jam-param-change")
    Note over UserB: Client B in lobby does NOT receive parameter noise!

    UserA->>Server: emit("leave-jam-room")
    Server->>Room: Remove UserA socket
    Server-->>UserB: emit("presence-update", { totalOnline: 1, inJamRoom: 0 })
```

---

## 📈 3. Leaderboard Time-Decayed Ranking Math

Rather than relying on static like counts, CrowdStudio implements a time-decayed "hot" ranking formula (similar to Hacker News):

$$\text{Score} = \frac{\text{likes} \times 3 + \text{playCount}}{(\text{ageInHours} + 2)^{1.5}}$$

```mermaid
flowchart LR
    A[DB Fetch Candidate Pool: Top 300 tracks by Likes] --> B[Compute ageInHours = Now - createdAt]
    B --> C[Apply Decay Formula Score]
    C --> D[In-Memory Sort Score Descending]
    D --> E[Slice Top 50 Ranked Tracks]
    E --> F[Return Clean JSON Payload to Client]
```

---

## 🏗️ 4. Full Deployment Topology (Render / Docker)

```mermaid
graph TB
    subgraph Client Layer
        Web[Vite React SPA / Tailwind]
    end

    subgraph Edge & Security
        Helmet[Helmet Security Headers]
        RateLimit[Express RateLimiters]
    end

    subgraph Application Server
        API[Express REST API / Node 20]
        SocketServer[Socket.io WebSockets]
    end

    subgraph Data Layer
        Prisma[Prisma ORM Client]
        PG[(PostgreSQL Managed DB)]
    end

    Web -->|HTTPS REST| Helmet
    Web -->|WSS Socket.io| SocketServer
    Helmet --> RateLimit
    RateLimit --> API
    API --> Prisma
    Prisma --> PG
```

---

## 🎓 Udemy Course Showcase & Hands-on Lab Overview

### Module Matrix & Learning Objectives

| Module | Architectural Focus | Implemented Pattern |
|---|---|---|
| **Module 1: Web Audio Synthesis** | DSP nodes, Diatonic chord triads, Analyser taps | `useJamEngine.ts` |
| **Module 2: Scoped WebSockets** | Rate-limited room broadcasts, Ephemeral voting | `socket/index.ts` |
| **Module 3: Hardened REST APIs** | Zod input schemas, Status-preserving error handler | `routes/tracks.ts` |
| **Module 4: Algorithmic Ranking** | Time-decay math vs raw count decay | `lib/ranking.ts` |
| **Module 5: Docker & Cloud Deploy** | Container orchestrations & Render multi-service | `render.yaml` & `docker-compose.yml` |

---

## 🧪 Automated Verification & CI/CD Pipeline

To run the automated verification suite:

```bash
# Backend Test Suite (19 tests)
cd backend && npm test

# Frontend Test Suite (36 tests)
cd frontend && npm test

# Build Validations
cd backend && npm run build
cd frontend && npm run build
```
