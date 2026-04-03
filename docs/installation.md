# Installation & Quickstart

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20.x | Runtime for build tooling and serverless functions |
| **npm** | ≥ 10.x | Package management |
| **Git** | ≥ 2.x | Source control |

### Optional (local development only)

| Requirement | Version | Purpose |
|---|---|---|
| **Docker** | ≥ 24.x | Containerized dev environment |
| **Docker Compose** | ≥ 2.x | Multi-service orchestration (web + API) |

## API Credentials

Three external APIs are used. **Two require free-tier registration:**

| Service | Registration | Cost |
|---|---|---|
| [Global Fishing Watch](https://globalfishingwatch.org/our-apis/) | Free account + API key | Free |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | Free account + OAuth2 client | Free (30k processing units/month) |
| [SkyTruth Cerulean](https://cerulean.skytruth.org) | No registration needed | Public API |

See [configuration.md](configuration.md) for detailed credential setup.

## Quickstart (Vercel)

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/pemex-oilslick.git
cd pemex-oilslick

# 2. Install dependencies
npm install

# 3. Deploy to Vercel
npx vercel

# 4. Set environment variables in Vercel dashboard:
#    GFW_API_KEY
#    COPERNICUS_CLIENT_ID
#    COPERNICUS_CLIENT_SECRET
```

The platform will be live at your Vercel URL. Serverless functions in `/api/` handle all upstream API proxying.

## Quickstart (Local Development)

### Option A: Docker Compose (recommended)

```bash
# 1. Clone and enter the project
git clone https://github.com/<your-org>/pemex-oilslick.git
cd pemex-oilslick

# 2. Set up API credentials
mkdir -p secrets
echo "YOUR_GFW_TOKEN" > secrets/gfw_api_key.txt
echo "YOUR_COPERNICUS_CLIENT_ID" > secrets/copernicus_client_id.txt
echo "YOUR_COPERNICUS_SECRET" > secrets/copernicus_client_secret.txt

# 3. Start services (uses Docker configs in dev/)
docker compose -f dev/docker-compose.yml up --build
```

- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Option B: Native Node.js

```bash
# 1. Install frontend dependencies
npm install

# 2. Install server dependencies
cd server && npm install && cd ..

# 3. Set environment variables
export GFW_API_KEY="your-token"
export COPERNICUS_CLIENT_ID="your-client-id"
export COPERNICUS_CLIENT_SECRET="your-secret"

# 4. Start both frontend and API server
npm run dev:all
```

## Production Build (Docker)

```bash
# Build production image
docker build -t pemex-oilslick .

# Run
docker run -p 3000:3000 \
  -e GFW_API_KEY="..." \
  -e COPERNICUS_CLIENT_ID="..." \
  -e COPERNICUS_CLIENT_SECRET="..." \
  pemex-oilslick
```

The production Dockerfile uses a 3-stage build (builder → API deps → Alpine runner) for minimal image size.

## Data Pipeline Scripts

Data processing scripts live in `dev/scripts/`. These are **offline tools** used to fetch and normalize GFW data — they are not required for runtime.

```bash
# Fetch vessel presence + events from GFW API
node dev/scripts/fetch-gfw-data.cjs

# Detect dark vessels (AIS gap analysis)
node dev/scripts/fetch-dark-vessels.cjs

# Reconstruct PEMEX fleet tracks
node dev/scripts/build-pemex-tracks.cjs
```

Output JSON files are committed to `public/data/gfw/` and served as static assets.

## Verify Installation

After deployment, confirm:

1. Map loads with Sonda de Campeche centered view
2. Timeline scrubber advances from Feb 5 → Mar 31, 2026
3. Satellite layers toggle (ESRI, MODIS, Sentinel-2)
4. Vessel arrows animate during playback
5. Oil slick polygons appear when Cerulean layer is enabled
