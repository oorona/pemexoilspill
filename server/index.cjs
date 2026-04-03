'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read a Docker secret from /run/secrets/<name>, falling back to
 * an environment variable with the same name uppercased.
 * Never logs or exposes secret values.
 */
function readSecret(name) {
  const secretPath = `/run/secrets/${name}`;
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (_) { /* secret not mounted */ }
  const envKey = name.toUpperCase().replace(/-/g, '_');
  return process.env[envKey] || '';
}

function hasSecret(name) {
  return readSecret(name).length > 0;
}

// ── Copernicus Data Space — OAuth2 token cache ────────────────────────────────
// Free account: https://dataspace.copernicus.eu (no credit card needed)
// Tokens expire in ~600 s; we refresh 60 s before expiry.
const CDSE_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CDSE_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

let _cdseToken = null;
let _cdseTokenExpiry = 0;

async function getCDSEToken() {
  const clientId     = readSecret('copernicus_client_id');
  const clientSecret = readSecret('copernicus_client_secret');
  if (!clientId || !clientSecret) return null;

  if (_cdseToken && Date.now() < _cdseTokenExpiry) return _cdseToken;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(CDSE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal:  AbortSignal.timeout(8_000),
  });

  if (!res.ok) { _cdseToken = null; return null; }
  const data = await res.json();
  _cdseToken = data.access_token;
  // Refresh 60 s before real expiry
  _cdseTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _cdseToken;
}

// Convert XYZ tile indices to EPSG:4326 bounding box
function tileToBBox(x, y, z) {
  const n = Math.pow(2, z);
  const west  =  (x / n) * 360 - 180;
  const east  =  ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return {
    west, east,
    north: (northRad * 180) / Math.PI,
    south: (southRad * 180) / Math.PI,
  };
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Basic rate limiting — 120 req/min per IP
const ratemap = new Map();
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const ip = req.ip;
  const now = Date.now();
  const window = 60_000;
  const max = 120;
  const entry = ratemap.get(ip) || { count: 0, ts: now };
  if (now - entry.ts > window) { entry.count = 0; entry.ts = now; }
  entry.count += 1;
  ratemap.set(ip, entry);
  if (entry.count > max) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    keys: {
      gfw:        hasSecret('gfw_api_key'),
      cerulean:   true, // free open API, no key required
      copernicus: hasSecret('copernicus_client_id') && hasSecret('copernicus_client_secret'),
    },
  });
});

// ── GFW Proxy ─────────────────────────────────────────────────────────────────

app.get('/api/gfw', async (req, res) => {
  const key = readSecret('gfw_api_key');
  if (!key) return res.status(503).json({ error: 'GFW_API_KEY no configurada', fallback: true });

  // Extract endpoint from raw query string to preserve bracket notation (datasets[0]=...)
  // that Express would otherwise collapse into arrays.
  const rawQuery = req.url.replace(/^[^?]*\?/, '');
  const rawParams = new URLSearchParams(rawQuery);
  const endpoint = rawParams.get('endpoint') || 'vessels/search';
  rawParams.delete('endpoint');

  // Allowlist endpoints to prevent SSRF
  const allowed = ['vessels/search', 'events', 'vessels'];
  const safe = allowed.some(a => endpoint.startsWith(a));
  if (!safe) return res.status(400).json({ error: 'Endpoint no permitido' });

  const qs = rawParams.toString();
  const url = `https://gateway.api.globalfishingwatch.org/v3/${endpoint}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[GFW]', err.message);
    res.status(502).json({ error: 'Error en GFW upstream', fallback: true });
  }
});

// ── GFW Vessel Track (POST body passthrough) ──────────────────────────────────

app.post('/api/gfw/events', async (req, res) => {
  const key = readSecret('gfw_api_key');
  if (!key) return res.status(503).json({ error: 'GFW_API_KEY no configurada', fallback: true });

  const url = 'https://gateway.api.globalfishingwatch.org/v3/events';
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[GFW events]', err.message);
    res.status(502).json({ error: 'Error en GFW upstream', fallback: true });
  }
});

// ── GFW Vessel Track — 2-step lookup: search by MMSI → fetch track ────────────
// GET /api/gfw/vessel-track?mmsi=345070403&start=2026-01-01&end=2026-03-31
//
// Step 1: search GFW vessel identity DB by MMSI/SSVID to get the internal vessel ID
// Step 2: fetch full AIS track for that vessel ID over the date range
// Returns: { vesselId, mmsi, count, track: [{t: ISO_string, lat, lon}] }
//
// Tries multiple datasets (presence → fishing-watch) for broadest coverage.
// Track is downsampled to ≤1 point per hour to keep payload small.

/**
 * Normalize GFW track API responses — handles multiple formats:
 *   - Array of {lat, lon, timestamp} objects  (GFW v3 default JSON)
 *   - GeoJSON Feature/FeatureCollection with coordinateProperties.times
 */
function normalizeGFWTrack(raw) {
  let points = [];

  if (Array.isArray(raw)) {
    // Format: [{lat, lon, timestamp (ms or s)}]
    points = raw
      .filter(p => p.lat != null && p.lon != null && p.timestamp != null)
      .map(p => {
        const ms = p.timestamp > 1e10 ? p.timestamp : p.timestamp * 1000;
        return { t: new Date(ms).toISOString(), lat: +p.lat, lon: +p.lon };
      });

  } else if (raw?.type === 'Feature' || raw?.type === 'FeatureCollection') {
    const features = raw.type === 'FeatureCollection' ? raw.features : [raw];
    for (const feat of (features ?? [])) {
      const coords = feat.geometry?.coordinates ?? [];
      const isMulti = feat.geometry?.type === 'MultiLineString';
      const flat = isMulti ? coords.flat(1) : coords;
      const timesRaw =
        feat.properties?.coordinateProperties?.times ??
        feat.properties?.times ?? [];
      const times = Array.isArray(timesRaw[0]) ? timesRaw.flat() : timesRaw;
      flat.forEach((c, i) => {
        if (c[0] == null || c[1] == null || times[i] == null) return;
        points.push({ t: new Date(times[i]).toISOString(), lat: +c[1], lon: +c[0] });
      });
    }
  }

  if (!points.length) return [];

  // Sort chronologically
  points.sort((a, b) => a.t.localeCompare(b.t));

  // Downsample: keep at most 1 point per hour to limit payload size
  const hourly = [];
  let lastHour = '';
  for (const p of points) {
    const h = p.t.slice(0, 13); // 'YYYY-MM-DDTHH'
    if (h !== lastHour) { hourly.push(p); lastHour = h; }
  }
  return hourly;
}

const GFW_BASE = 'https://gateway.api.globalfishingwatch.org/v3';
const GFW_TRACK_DATASETS = [
  'public-global-presence:latest',
  'public-global-fishing-watch:latest',
];

// Cache: avoid re-fetching the same MMSI within the same server process
const _gfwTrackCache = new Map();

app.get('/api/gfw/vessel-track', async (req, res) => {
  const key = readSecret('gfw_api_key');
  if (!key) return res.status(503).json({ error: 'GFW_API_KEY no configurada' });

  const { mmsi, start = '2026-01-01', end = '2026-03-31' } = req.query;
  if (!mmsi || !/^\d{7,9}$/.test(mmsi)) {
    return res.status(400).json({ error: 'MMSI inválido — debe ser 7-9 dígitos' });
  }

  const cacheKey = `${mmsi}:${start}:${end}`;
  if (_gfwTrackCache.has(cacheKey)) {
    return res.json(_gfwTrackCache.get(cacheKey));
  }

  const auth = { Authorization: `Bearer ${key}` };

  try {
    // Step 1 — find GFW vessel ID by MMSI (SSVID in GFW parlance)
    const searchUrl = `${GFW_BASE}/vessels/search?where=ssvid%3D%22${mmsi}%22` +
      `&datasets%5B0%5D=public-global-vessel-identity%3Alatest&limit=5`;
    const sr = await fetch(searchUrl, { headers: auth, signal: AbortSignal.timeout(12_000) });
    if (!sr.ok) {
      const detail = await sr.text().catch(() => '');
      console.error('[GFW search] HTTP', sr.status, detail);
      return res.status(sr.status).json({ error: 'GFW vessel search failed', status: sr.status });
    }
    const searchData = await sr.json();
    // v3 API: vessel ID lives in selfReportedInfo[0].id, not at entries[0].id
    const entry = searchData?.entries?.[0];
    const vesselId = entry?.selfReportedInfo?.[0]?.id ||
                     entry?.combinedSourcesInfo?.[0]?.vesselId;
    if (!vesselId) {
      console.error('[GFW search] No vesselId found in response:', JSON.stringify(searchData).slice(0, 500));
      return res.status(404).json({ error: `Vessel MMSI ${mmsi} not found in GFW identity DB` });
    }
    console.info(`[GFW] MMSI ${mmsi} → vesselId ${vesselId}`);

    // Step 2 — fetch AIS track, trying each dataset in order until we get data
    let track = null;
    for (const dataset of GFW_TRACK_DATASETS) {
      const trackUrl = `${GFW_BASE}/vessels/${vesselId}/tracks` +
        `?start-date=${start}&end-date=${end}` +
        `&datasets%5B0%5D=${encodeURIComponent(dataset)}`;
      const tr = await fetch(trackUrl, { headers: auth, signal: AbortSignal.timeout(25_000) });
      if (!tr.ok) {
        console.warn(`[GFW track] dataset ${dataset} → HTTP ${tr.status}`);
        continue;
      }
      const raw = await tr.json();
      const pts = normalizeGFWTrack(raw);
      if (pts.length) { track = pts; break; }
    }

    if (!track?.length) {
      return res.status(404).json({
        error: 'No AIS track data found for this vessel in GFW (vessel may have poor AIS coverage)',
        vesselId,
      });
    }

    const result = { vesselId, mmsi, count: track.length, track };
    _gfwTrackCache.set(cacheKey, result);
    res.set('Cache-Control', 'public, max-age=3600').json(result);
  } catch (err) {
    console.error('[GFW vessel-track]', err.message);
    res.status(502).json({ error: 'GFW upstream error', detail: err.message });
  }
});

// ── SkyTruth Cerulean Proxy ───────────────────────────────────────────────────
// Free open OGC API — no authentication required

app.get('/api/cerulean', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const url = `https://api.cerulean.skytruth.org/collections/public.slick_plus/items${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[Cerulean]', err.message);
    res.status(502).json({ error: 'Error en Cerulean upstream', fallback: true });
  }
});

// ── Copernicus Data Space — Sentinel-1 SAR tile proxy ────────────────────────
// GET /api/copernicus/tile/:z/:x/:y.png?date=YYYY-MM-DD&layer=s1-sar|s2-optical
//
// Converts XYZ tile coords → Process API request → returns PNG tile.
// Free tier: 30,000 processing units/month (1 tile ≈ 1-3 PU at zoom 7-9).
//
// layer=s1-sar   → Sentinel-1 GRD IW VV/VH (radar, sees through clouds)
// layer=s2-rgb   → Sentinel-2 L2A true-colour (optical, cloud-dependent)

const S1_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: [{ bands: ["VV", "VH"] }], output: { bands: 3 } };
}
function evaluatePixel(s) {
  // Clean greyscale from VV — oil slicks appear as dark patches on bright ocean
  var vv = Math.max(0, Math.min(1, s.VV * 3.5));
  return [vv, vv, vv];
}`;

const S2_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: [{ bands: ["B04", "B03", "B02"] }], output: { bands: 3 } };
}
function evaluatePixel(s) {
  return [3.5 * s.B04, 3.5 * s.B03, 3.5 * s.B02];
}`;

app.get('/api/copernicus/tile/:z/:x/:y.png', async (req, res) => {
  const token = await getCDSEToken();
  if (!token) {
    return res.status(503).json({
      error: 'Copernicus credentials not configured',
      fallback: true,
    });
  }

  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);
  const date  = (req.query.date || '2026-02-14').slice(0, 10);
  const layer = req.query.layer === 's2-rgb' ? 's2-rgb' : 's1-sar';

  // Widen time range: Sentinel-1 revisit is ~6 days, so single-day queries often return nothing.
  // Use a 10-day window (date ± 5 days) — the API returns the MOST RECENT acquisition (mosaicking: SIMPLE).
  const dateObj = new Date(date + 'T12:00:00Z');
  const fromDate = new Date(dateObj.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
  const toDate   = new Date(dateObj.getTime() + 5 * 86_400_000).toISOString().slice(0, 10);

  // Restrict zoom range to avoid wasting processing units
  if (z < 5 || z > 11) {
    return res.status(400).json({ error: 'Zoom fuera de rango (5-11)' });
  }

  const bbox = tileToBBox(x, y, z);

  const body = {
    input: {
      bounds: {
        bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: layer === 's2-rgb' ? 'sentinel-2-l2a' : 'sentinel-1-grd',
        dataFilter: {
          timeRange: {
            from: `${fromDate}T00:00:00Z`,
            to:   `${toDate}T23:59:59Z`,
          },
          ...(layer === 's1-sar' ? {
            acquisitionMode: 'IW',
            polarization: 'DV',
            resolution: 'HIGH',
          } : {
            maxCloudCoverage: 80,
          }),
        },
      }],
    },
    output: {
      width: 512, height: 512,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript: layer === 's2-rgb' ? S2_EVALSCRIPT : S1_EVALSCRIPT,
  };

  try {
    const upstream = await fetch(CDSE_PROCESS_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      return res.status(upstream.status).json({ error: txt });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[Copernicus tile]', err.message);
    res.status(502).json({ error: 'Error en Copernicus upstream', fallback: true });
  }
});

// ── Copernicus token status (no secret values exposed) ────────────────────────
// Query-param alias: GET /api/copernicus?z=&x=&y=&date=&layer=
// (MapLibre tile URL template uses {z}/{x}/{y} placeholders in query strings)
app.get('/api/copernicus', async (req, res) => {
  const { z, x, y, date = '2026-02-14', layer = 's1-sar' } = req.query;
  req.params = { z, x, y };
  req.query.date  = date;
  req.query.layer = layer;
  // Reuse path-handler logic via internal forward
  const token = await getCDSEToken();
  if (!token) {
    return res.status(503).json({ error: 'Copernicus credentials not configured', fallback: true });
  }
  const zi = parseInt(z, 10), xi = parseInt(x, 10), yi = parseInt(y, 10);
  if (isNaN(zi) || isNaN(xi) || isNaN(yi) || zi < 5 || zi > 11) {
    return res.status(400).json({ error: 'Zoom fuera de rango (5-11)' });
  }
  const safeDate = date.slice(0, 10);
  const isS2 = layer === 's2-rgb';

  // Widen time range (same as /tile route) so tiles always have imagery
  const dateObj2 = new Date(safeDate + 'T12:00:00Z');
  const fromDate2 = new Date(dateObj2.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
  const toDate2   = new Date(dateObj2.getTime() + 5 * 86_400_000).toISOString().slice(0, 10);

  const bbox = tileToBBox(xi, yi, zi);
  const body = {
    input: {
      bounds: {
        bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: isS2 ? 'sentinel-2-l2a' : 'sentinel-1-grd',
        dataFilter: {
          timeRange: { from: `${fromDate2}T00:00:00Z`, to: `${toDate2}T23:59:59Z` },
          ...(isS2 ? { maxCloudCoverage: 80 } : { acquisitionMode: 'IW', polarization: 'DV', resolution: 'HIGH' }),
        },
      }],
    },
    output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: isS2 ? S2_EVALSCRIPT : S1_EVALSCRIPT,
  };
  try {
    const upstream = await fetch(CDSE_PROCESS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      const txt = await upstream.text();
      return res.status(upstream.status).json({ error: txt });
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[Copernicus tile]', err.message);
    res.status(502).json({ error: 'Error en Copernicus upstream', fallback: true });
  }
});

app.get('/api/copernicus/status', async (_req, res) => {
  const hasCredentials = hasSecret('copernicus_client_id') && hasSecret('copernicus_client_secret');
  if (!hasCredentials) return res.json({ configured: false });
  try {
    const token = await getCDSEToken();
    res.json({ configured: true, tokenOk: !!token });
  } catch {
    res.json({ configured: true, tokenOk: false });
  }
});

// ── OpenWeatherMap wind tile proxy ───────────────────────────────────────────
// Requires secrets/owm_api_key.txt — sign up at openweathermap.org (free tier ok)
app.get('/api/weather/wind', async (req, res) => {
  const key = readSecret('owm_api_key');
  if (!key) return res.status(503).json({ error: 'owm_api_key not configured', fallback: true });
  const { z, x, y } = req.query;
  if (!z || !x || !y) return res.status(400).json({ error: 'z, x, y required' });
  const url = `https://tile.openweathermap.org/map/wind_new/${z}/${x}/${y}.png?appid=${key}`;
  try {
    const up = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!up.ok) return res.status(up.status).json({ error: 'OWM upstream error' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(Buffer.from(await up.arrayBuffer()));
  } catch (err) {
    console.error('[OWM wind]', err.message);
    res.status(502).json({ error: 'Wind tile fetch failed' });
  }
});

// ── Serve static files (production only) ─────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath, { maxAge: '1d' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Servidor escuchando en puerto ${PORT}`);
  console.log(`[API] GFW key:        ${hasSecret('gfw_api_key') ? '✓' : '✗ (modo sintético)'}`);
  console.log(`[API] Cerulean:       ✓ (API pública, sin clave)`);
  console.log(`[API] Copernicus ID:  ${hasSecret('copernicus_client_id') ? '✓' : '✗ (sin imágenes SAR)'}`);
  console.log(`[API] Copernicus Sec: ${hasSecret('copernicus_client_secret') ? '✓' : '✗ (sin imágenes SAR)'}`);
});
