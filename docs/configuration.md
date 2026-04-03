# Configuration

## Environment Variables

All API credentials are injected as environment variables. In Docker, they are read from `/run/secrets/` files with fallback to environment variables.

### Required Variables

| Variable | Purpose | Source |
|---|---|---|
| `GFW_API_KEY` | Global Fishing Watch API bearer token | [GFW Portal](https://globalfishingwatch.org/our-apis/) |
| `COPERNICUS_CLIENT_ID` | Copernicus Data Space OAuth2 client ID | [CDSE Dashboard](https://dataspace.copernicus.eu) |
| `COPERNICUS_CLIENT_SECRET` | Copernicus Data Space OAuth2 client secret | CDSE Dashboard |

### No-Auth Services

These services require no credentials:

- **SkyTruth Cerulean** — Public OGC API (`https://api.cerulean.skytruth.org`)
- **ESRI World Imagery** — Public tile service
- **NASA GIBS MODIS** — Public WMTS
- **EOX Sentinel-2 Cloudless** — Public tile service

## Credential Setup

### Global Fishing Watch

1. Register at [globalfishingwatch.org/our-apis](https://globalfishingwatch.org/our-apis/)
2. Request an API token (approval is typically instant for research use)
3. Token format: JWT string (e.g., `eyJhbGciOi...`)

### Copernicus Data Space

1. Register at [dataspace.copernicus.eu](https://dataspace.copernicus.eu) (no credit card required)
2. Navigate to **Dashboard → OAuth Clients → Register New Client**
3. Note the `client_id` and `client_secret`
4. Free tier includes 30,000 processing units/month (sufficient for this application)

### Cerulean (SkyTruth)

No registration or keys needed. API is publicly accessible.

## Deployment Configuration

### Vercel

Set environment variables in the Vercel dashboard under **Project Settings → Environment Variables**:

```
GFW_API_KEY=your-gfw-token
COPERNICUS_CLIENT_ID=your-client-id
COPERNICUS_CLIENT_SECRET=your-client-secret
```

The `vercel.json` configuration handles:

- **Build**: `npm run build` → outputs to `dist/`
- **Rewrites**: `/api/*` → Vercel serverless functions; all other routes → `index.html` (SPA)
- **Headers**: Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- **Caching**: Static data files served with `immutable` cache headers

### Docker (Local / Self-Hosted)

Create credential files in `secrets/`:

```bash
mkdir -p secrets
echo "your-gfw-token" > secrets/gfw_api_key.txt
echo "your-client-id" > secrets/copernicus_client_id.txt
echo "your-secret" > secrets/copernicus_client_secret.txt
```

Docker Compose reads these via the `secrets:` block and mounts them at `/run/secrets/<name>`.

## System Parameters

### Map Configuration

| Parameter | Value | Location |
|---|---|---|
| Initial bounds | `[-94.3092, 18.0111]` to `[-90.5857, 20.0533]` | `src/components/Map.jsx` |
| Min zoom | 6.2 | `src/components/Map.jsx` |
| Max zoom | 15 | `src/components/Map.jsx` |

### Timeline

| Parameter | Value | Location |
|---|---|---|
| Start date | 2026-02-05 | `src/data/events.js` |
| End date | 2026-03-31 | `src/data/events.js` |
| Tick interval | 125ms per 1-hour step | `src/App.jsx` |
| Playback speed | ~3 seconds per calendar day | Derived |

### API Rate Limiting

| Endpoint | Limit | Scope |
|---|---|---|
| Express server | 120 requests/min | Per IP |
| GFW API | Vendor-imposed | Per token |
| Copernicus CDSE | ~30k PU/month (free tier) | Per account |

### Vessel Animation

| Parameter | Value | Purpose |
|---|---|---|
| Look-back window | 1 hour (3,600,000 ms) | Bearing computation from position delta |
| Gap timeout | 12 hours | Distinguish anchoring from data loss |
| Interpolation | Linear (lon/lat) | Smooth movement between AIS waypoints |

## Serverless Function Reference

Located in `/api/`:

| Function | Method | Upstream Target |
|---|---|---|
| `gfw.js` | GET/POST | `gateway.api.globalfishingwatch.org/v3/*` |
| `copernicus.js` | GET | `sh.dataspace.copernicus.eu/api/v1/process` |
| `cerulean.js` | GET | `api.cerulean.skytruth.org/collections/public.slick_plus/items` |

All functions implement credential injection, error handling, and CORS headers for the frontend origin.
