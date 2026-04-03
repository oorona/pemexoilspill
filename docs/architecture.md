# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                           │
│  React 18 + MapLibre GL 4.7.1 + Vite                        │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Map.jsx │  │ Timeline │  │ Chronology│  │ EventCard  │  │
│  │ (WebGL) │  │ (scrub)  │  │ Panel     │  │ (popup)    │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  └────────────┘  │
│       │            │              │                           │
│       └────────────┴──────────────┘                           │
│                    │                                          │
│           currentDatetime (ISO 8601)                         │
│           activeEvent / selectedVessel                        │
└────────────────────┬─────────────────────────────────────────┘
                     │ /api/* requests
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              SERVERLESS FUNCTIONS (Vercel Edge)              │
│                                                              │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │ gfw.js   │  │ copernicus.js │  │ cerulean.js           │ │
│  │ (AIS/    │  │ (SAR + RGB    │  │ (oil slick polygons)  │ │
│  │ events)  │  │ tile engine)  │  │                       │ │
│  └────┬─────┘  └──────┬────────┘  └──────────┬────────────┘ │
└───────┼───────────────┼──────────────────────┼──────────────┘
        │               │                      │
        ▼               ▼                      ▼
┌──────────────┐ ┌────────────────┐  ┌──────────────────────┐
│ GFW API v3   │ │ Copernicus     │  │ SkyTruth Cerulean    │
│ (Bearer JWT) │ │ CDSE (OAuth2)  │  │ (Public OGC)         │
│              │ │                │  │                      │
│ • 4Wings     │ │ • Sentinel-1   │  │ • SAR slick polygons │
│ • Events     │ │   SAR (VV/VH)  │  │ • Dark vessel shadows│
│ • Vessel     │ │ • Sentinel-2   │  │                      │
│   search     │ │   L2A (RGB)    │  │                      │
└──────────────┘ └────────────────┘  └──────────────────────┘
```

## Frontend Architecture

### State Management

The application uses React's built-in state with a single `App.jsx` orchestrator:

```
App.jsx (state owner)
├── currentDatetime  →  ISO 8601 string, advances hourly during playback
├── currentDate      →  Derived YYYY-MM-DD slice for tile/event lookups
├── activeEvent      →  Current event object (auto-synced from date, auto-dismissed after 5s)
├── isPlaying        →  Playback toggle (125ms interval timer)
├── selectedVessel   →  Clicked vessel info (from map click handlers)
└── eventsOverlayOn  →  Controls visibility of event markers + cards
```

### Map Component (`Map.jsx`)

The largest component (~1200 lines). Responsibilities:

1. **Layer management** — 9 overlay groups, each with independent toggle state
2. **Animation engine** — Interpolates vessel positions at sub-hourly resolution
3. **Image generation** — Programmatic canvas-based arrow icons for vessel heading
4. **Data loading** — Fetches static JSON tracks + live API tiles

#### Overlay Registry

| ID | Label | Layers | Default | Dynamic |
|---|---|---|---|---|
| `cerulean` | Manchas de petróleo | fill + outline | ON | Yes (⏱) |
| `infra` | Plataformas y terminales | circle + label | ON | No |
| `pipelines` | Oleoductos PEMEX | line | ON | No |
| `boundaries` | Zona Económica Exclusiva | line | ON | No |
| `other-vessels` | Otros buques en AOI | arrow + label | OFF | Yes (⏱) |
| `pemex-vessels` | Buques PEMEX | arrow + label | ON | Yes (⏱) |
| `dark-vessels` | Buques oscuros (AIS off) | arrow + label | ON | Yes (⏱) |
| `arbol-grande` | Árbol Grande | HTML marker | ON | Yes (⏱) |
| `events` | Eventos del incidente | circle + text | ON | Yes (⏱) |

#### Vessel Animation Pipeline

```
Track JSON (static)
    ↓
_buildVesselTimelinesFromTracks()  →  { ssvid: { name, flag, points: [{t, lon, lat}] } }
    ↓
_interpolatePosition(timeline, nowMs)  →  [lon, lat] or null
    ↓
_computeBearing(timeline, nowMs)  →  degrees (0=N, clockwise)
    ↓
_*AnimatedPositions(datetime)  →  GeoJSON FeatureCollection with bearing property
    ↓
MapLibre symbol layer  →  icon-rotate: ['get', 'bearing'], icon-rotation-alignment: 'map'
```

### Satellite Tile Architecture

Tile requests are date-parameterized. The map style is rebuilt when the base layer switches:

```
buildMapStyle(currentDate)
├── ESRI World Imagery      →  Static XYZ tiles (no date)
├── NASA GIBS MODIS Terra   →  WMTS with {Time} = currentDate
├── EOX Sentinel-2 Cloudless →  Static XYZ tiles (2023 mosaic)
├── Sentinel-1 SAR          →  /api/copernicus?date=...&x=...&y=...&z=...
└── Sentinel-2 RGB          →  /api/copernicus?date=...&type=s2&x=...&y=...&z=...
```

## Serverless Functions

### `api/gfw.js` — Global Fishing Watch Proxy

- **Auth**: Injects `GFW_API_KEY` as `Authorization: Bearer` header
- **Allowed paths**: `vessels/search`, `events`, `vessels`
- **Methods**: GET (queries) and POST (event searches with body)
- **Rate limiting**: Deferred to GFW upstream

### `api/copernicus.js` — Sentinel Tile Processor

- **Auth**: OAuth2 client credentials flow with in-memory token caching
- **Token refresh**: Cached until 60 seconds before expiry
- **Processing**: Converts XYZ tile coordinates → WGS-84 bounding box → OGC Process API request
- **Eval scripts**:
  - S1 SAR: VV/VH polarimetric composition with −3.5 dB adaptive threshold
  - S2 RGB: Band 4/3/2 true-color composition at 3.5× gain
- **Output**: 512×512 PNG tiles

### `api/cerulean.js` — SkyTruth Slick Proxy

- **Auth**: None (public API)
- **Passthrough**: Forwards query parameters to OGC items endpoint
- **Returns**: GeoJSON feature collection of oil slick polygons

## Data Flow

### Offline Pipeline (dev/scripts/)

```
GFW API v3
    ↓
fetch-gfw-data.cjs          →  vessels-aoi.json, loitering-events.json, port-visits.json
    ↓
build-pemex-tracks.cjs      →  pemex-tracks.json (24 vessels, 2,239 points)
split-other-loitering.cjs   →  other-tracks.json (736 vessels, 19,586 points)
fetch-dark-vessels.cjs       →  dark-vessels-tracks.json (2 vessels, 6 points)
    ↓
Committed to public/data/gfw/  →  Served as static JSON at runtime
```

### Runtime Data Flow

```
Page Load
├── Static JSON fetch  →  pemex-tracks.json, other-tracks.json, dark-vessels-tracks.json
├── Build timelines    →  In-memory vessel position caches
└── Start animation    →  125ms timer → interpolate → update GeoJSON sources

User Interaction
├── Play/Pause         →  Toggle 125ms interval timer
├── Scrub timeline     →  Set currentDatetime → re-interpolate all positions
├── Toggle layers      →  MapLibre setLayoutProperty (visibility)
├── Click vessel       →  Show EventCard with vessel properties
└── Zoom/Pan           →  Trigger tile fetches for Sentinel/MODIS/ESRI
```

## Deployment Architecture

### Vercel (Primary)

```
vercel.json
├── buildCommand: "npm run build"
├── outputDirectory: "dist"
├── /api/*  →  Serverless Functions (Node.js runtime)
├── /*      →  Static SPA (index.html)
└── Headers: CSP, X-Frame-Options, Referrer-Policy
```

- Static assets (JS bundles, JSON data, GeoJSON) served from Vercel CDN
- Serverless functions cold-start in ~200ms (Node.js 20)
- Environment variables set in Vercel dashboard

### Docker (Alternative)

- 3-stage multi-build: `builder` → `api-deps` → `runner` (Alpine)
- Express server serves both static `dist/` and `/api/*` endpoints
- Single container on port 3000

## Security

- API credentials never reach the client — all upstream calls go through serverless proxy
- CORS headers restrict API access to the deployment origin
- Docker secrets mounted read-only at `/run/secrets/`
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- No client-side storage of tokens or PII
