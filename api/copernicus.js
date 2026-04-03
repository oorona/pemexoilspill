// Vercel Serverless Function — Copernicus Data Space tile proxy
// Reads from env vars: COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET
// GET /api/copernicus?z=7&x=30&y=55&date=2026-02-14&layer=s1-sar

const CDSE_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CDSE_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

// Vercel functions are stateless per invocation — token cache lives in module scope
// (shared across warm invocations on same Lambda instance)
let _token = null;
let _tokenExpiry = 0;

async function getToken(clientId, clientSecret) {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(CDSE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

function tileToBBox(x, y, z) {
  const n = Math.pow(2, z);
  const west  =  (x / n) * 360 - 180;
  const east  =  ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return { west, east, north: (northRad * 180) / Math.PI, south: (southRad * 180) / Math.PI };
}

const S1_EVALSCRIPT = `//VERSION=3
function setup() { return { input: [{ bands: ["VV","VH"] }], output: { bands: 3 } }; }
function evaluatePixel(s) {
  const vv = Math.max(0, Math.min(1, s.VV * 3.5));
  const vh = Math.max(0, Math.min(1, s.VH * 5.0));
  return [vv, vh, vv * 0.6];
}`;

const S2_EVALSCRIPT = `//VERSION=3
function setup() { return { input: [{ bands: ["B04","B03","B02"] }], output: { bands: 3 } }; }
function evaluatePixel(s) { return [3.5 * s.B04, 3.5 * s.B03, 3.5 * s.B02]; }`;

export default async function handler(req, res) {
  const clientId     = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'Copernicus credentials not configured', fallback: true });
  }

  const { z, x, y, date = '2026-02-14', layer = 's1-sar' } = req.query;
  const zi = parseInt(z, 10), xi = parseInt(x, 10), yi = parseInt(y, 10);
  if (isNaN(zi) || isNaN(xi) || isNaN(yi) || zi < 5 || zi > 11) {
    return res.status(400).json({ error: 'Parámetros de tile inválidos' });
  }

  const token = await getToken(clientId, clientSecret);
  if (!token) return res.status(502).json({ error: 'No se pudo obtener token CDSE' });

  const bbox = tileToBBox(xi, yi, zi);
  const safeDate = date.slice(0, 10);
  const isS2 = layer === 's2-rgb';

  const body = {
    input: {
      bounds: {
        bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: isS2 ? 'sentinel-2-l2a' : 'sentinel-1-grd',
        dataFilter: {
          timeRange: { from: `${safeDate}T00:00:00Z`, to: `${safeDate}T23:59:59Z` },
          ...(isS2 ? { maxCloudCoverage: 80 } : { acquisitionMode: 'IW', polarization: 'DV', resolution: 'HIGH' }),
        },
      }],
    },
    output: {
      width: 512, height: 512,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
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
  } catch {
    res.status(502).json({ error: 'Error en Copernicus upstream', fallback: true });
  }
}
