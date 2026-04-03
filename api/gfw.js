// Vercel Serverless Function — GFW API proxy
// Reads from env vars set in Vercel dashboard (GFW_API_KEY)

export default async function handler(req, res) {
  const key = process.env.GFW_API_KEY;
  if (!key) return res.status(503).json({ error: 'GFW_API_KEY no configurada', fallback: true });

  // Preserve raw query string so bracket notation (datasets[0]=...) is not lost
  const rawQuery = req.url.replace(/^[^?]*\?/, '');
  const rawParams = new URLSearchParams(rawQuery);
  const endpoint = rawParams.get('endpoint') || 'vessels/search';
  rawParams.delete('endpoint');

  const allowed = ['vessels/search', 'events', 'vessels'];
  const safe = allowed.some(a => endpoint.startsWith(a));
  if (!safe) return res.status(400).json({ error: 'Endpoint no permitido' });

  const qs = rawParams.toString();
  const url = `https://gateway.api.globalfishingwatch.org/v3/${endpoint}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch {
    res.status(502).json({ error: 'Error en GFW upstream', fallback: true });
  }
}
