// Vercel Serverless Function — SkyTruth Cerulean API proxy
// Cerulean is a free, open OGC API — no authentication required
// https://api.cerulean.skytruth.org

export default async function handler(req, res) {
  const qs = new URLSearchParams(req.query).toString();
  const url = `https://api.cerulean.skytruth.org/collections/public.slick_plus/items${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch {
    res.status(502).json({ error: 'Error en Cerulean upstream', fallback: true });
  }
}
