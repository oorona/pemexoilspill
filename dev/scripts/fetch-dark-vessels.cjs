#!/usr/bin/env node
'use strict';
/**
 * Fetch GFW dark vessel (AIS gap) events in the AOI, then build tracks
 * ─────────────────────────────────────────────────────────────────────
 * 1. Fetches AIS-disabling ("gap") events from the GFW events API
 *    for the Gulf of Mexico AOI (Feb 1 – Mar 31, 2026).
 * 2. Extracts unique dark vessels.
 * 3. For each dark vessel, fetches all event types (loitering + port visits)
 *    to reconstruct a position track.
 * 4. Outputs:
 *    - dark-vessels-events.json   — raw gap events in AOI
 *    - dark-vessels-tracks.json   — reconstructed tracks per vessel
 *
 * Usage:
 *   node scripts/fetch-dark-vessels.cjs
 */

const fs   = require('fs');
const path = require('path');

const GFW_BASE   = 'https://gateway.api.globalfishingwatch.org/v3';
const OUT_DIR    = path.join(__dirname, '..', 'public', 'data', 'gfw');
const START_DATE = '2026-02-01';
const END_DATE   = '2026-03-31';
const DELAY_MS   = 1200;

const AOI_POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [-98.5597, 16.944],
    [-87.0027, 16.944],
    [-87.0027, 23.2375],
    [-98.5597, 23.2375],
    [-98.5597, 16.944],
  ]],
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function readKey() {
  const secretPath = path.join(__dirname, '..', 'secrets', 'gfw_api_key.txt');
  try {
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (_) {}
  return process.env.GFW_API_KEY || '';
}

function save(filename, data) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  ✓  ${filename}  (${kb} KB)`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function weeklyChunks(startStr, endStr) {
  const chunks = [];
  let cur = new Date(startStr + 'T00:00:00Z');
  const endDate = new Date(endStr + 'T23:59:59Z');
  while (cur < endDate) {
    const next = new Date(Math.min(cur.getTime() + 7 * 86_400_000 - 1, endDate.getTime()));
    chunks.push({ start: cur.toISOString().slice(0, 10), end: next.toISOString().slice(0, 10) });
    cur = new Date(next.getTime() + 1);
  }
  return chunks;
}

async function gfwFetch(url, key, opts = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45_000),
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`), { status: res.status });
  }
  return res.json();
}

// ─── Step 1: Fetch dark vessel (gap) events in AOI ────────────────────────────

async function fetchGapEvents(key) {
  const chunks = weeklyChunks(START_DATE, END_DATE);
  console.log(`\n[1/3] Fetching AIS gap (dark vessel) events — AOI × ${chunks.length} weekly chunks…`);

  const PAGE = 50;
  const seen = new Set();
  const entries = [];

  for (const { start, end } of chunks) {
    process.stdout.write(`    ${start}–${end}… `);
    let offset = 0;
    let total = null;
    const chunkEntries = [];

    try {
      while (true) {
        const url = `${GFW_BASE}/events?offset=${offset}&limit=${PAGE}`;
        const body = JSON.stringify({
          datasets: ['public-global-gaps-events:latest'],
          startDate: start,
          endDate: end,
          geometry: AOI_POLYGON,
        });
        const data = await gfwFetch(url, key, { method: 'POST', body });
        const page = data.entries ?? [];
        chunkEntries.push(...page);
        if (total === null) total = data.total ?? 0;
        if (page.length < PAGE || chunkEntries.length >= total) break;
        offset += PAGE;
        await sleep(DELAY_MS);
      }

      let added = 0;
      for (const e of chunkEntries) {
        if (!seen.has(e.id)) { seen.add(e.id); entries.push(e); added++; }
      }
      process.stdout.write(`+${added} (total ${entries.length})\n`);
    } catch (err) {
      if (err.status === 404) {
        process.stdout.write('no data\n');
      } else {
        process.stdout.write(`⚠ ${err.message}\n`);
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`  Gap events total: ${entries.length}`);
  return entries;
}

// ─── Step 2: Extract unique dark vessels ──────────────────────────────────────

function extractDarkVessels(gapEvents) {
  console.log('\n[2/3] Extracting unique dark vessels…');

  const vesselMap = new Map();
  for (const e of gapEvents) {
    const ssvid = e.vessel?.ssvid;
    if (!ssvid) continue;
    if (!vesselMap.has(ssvid)) {
      vesselMap.set(ssvid, {
        ssvid,
        vesselId: e.vessel?.id ?? null,
        name: e.vessel?.name ?? null,
        flag: e.vessel?.flag ?? null,
        type: e.vessel?.type ?? null,
        gapCount: 0,
        totalGapHours: 0,
      });
    }
    const v = vesselMap.get(ssvid);
    v.gapCount++;
    if (e.gap?.totalTimeHours) v.totalGapHours += e.gap.totalTimeHours;
    // Also try gaps.durationHours or compute from start/end
    if (!e.gap?.totalTimeHours && e.start && e.end) {
      v.totalGapHours += (new Date(e.end) - new Date(e.start)) / 3_600_000;
    }
  }

  const vessels = [...vesselMap.values()].sort((a, b) => b.totalGapHours - a.totalGapHours);
  console.log(`  Unique dark vessels: ${vessels.length}`);
  for (const v of vessels.slice(0, 10)) {
    console.log(`    ${v.name ?? v.ssvid} (${v.flag ?? '?'}) — ${v.gapCount} gaps, ${v.totalGapHours.toFixed(1)}h total`);
  }
  if (vessels.length > 10) console.log(`    … and ${vessels.length - 10} more`);

  return vessels;
}

// ─── Step 3: Build tracks from gap event positions ────────────────────────────

function buildDarkVesselTracks(gapEvents) {
  console.log('\n[3/3] Building tracks from gap event positions…');

  // Group events by vessel
  const byVessel = {};
  for (const e of gapEvents) {
    const ssvid = e.vessel?.ssvid;
    if (!ssvid || !e.position?.lat || !e.position?.lon) continue;
    if (!byVessel[ssvid]) {
      byVessel[ssvid] = {
        name: e.vessel?.name ?? null,
        flag: e.vessel?.flag ?? null,
        type: e.vessel?.type ?? null,
        vesselId: e.vessel?.id ?? null,
        events: [],
      };
    }
    byVessel[ssvid].events.push(e);
  }

  // Build tracks from event positions (same approach as PEMEX tracks)
  const tracks = {};
  let totalPoints = 0;

  for (const [ssvid, info] of Object.entries(byVessel)) {
    const seen = new Set();
    const points = [];

    for (const e of info.events) {
      for (const ts of [e.start, e.end].filter(Boolean)) {
        const hourKey = ts.slice(0, 13);
        if (seen.has(hourKey)) continue;
        seen.add(hourKey);
        points.push({
          t: new Date(ts).toISOString(),
          lat: e.position.lat,
          lon: e.position.lon,
        });
      }
    }

    points.sort((a, b) => a.t.localeCompare(b.t));
    if (points.length === 0) continue;

    tracks[ssvid] = {
      name: info.name,
      flag: info.flag,
      type: info.type,
      vesselId: info.vesselId,
      track: points,
    };
    totalPoints += points.length;
  }

  const count = Object.keys(tracks).length;
  console.log(`  Dark vessels with tracks: ${count}`);
  console.log(`  Total track points: ${totalPoints}`);
  console.log(`  Average points per vessel: ${count > 0 ? (totalPoints / count).toFixed(1) : 0}`);

  return tracks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const key = readKey();
  if (!key) {
    console.error('ERROR: GFW API key not found (secrets/gfw_api_key.txt or GFW_API_KEY env)');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GFW Dark Vessel (AIS Gap) Events — Gulf of Mexico');
  console.log(`  Period: ${START_DATE} → ${END_DATE}`);
  console.log('═══════════════════════════════════════════════════════════════');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Step 1: Fetch gap events in AOI
  const gapEvents = await fetchGapEvents(key);

  // Hard filter: only events starting on or after Feb 1 2026
  const filtered = gapEvents.filter(e => e.start >= '2026-02-01T');
  console.log(`  After hard date filter: ${filtered.length} events`);

  // Step 2: Extract unique dark vessels
  const darkVessels = extractDarkVessels(filtered);

  // Save gap events
  save('dark-vessels-events.json', {
    total: filtered.length,
    uniqueVessels: darkVessels.length,
    processedAt: new Date().toISOString(),
    startDate: START_DATE,
    endDate: END_DATE,
    note: 'AIS gap/disabling events in the Gulf of Mexico AOI. Vessels that turned off AIS transponders.',
    vessels: darkVessels,
    entries: filtered,
  });

  // Step 3: Build tracks from gap event positions
  const tracks = buildDarkVesselTracks(filtered);

  save('dark-vessels-tracks.json', {
    total: Object.keys(tracks).length,
    totalPoints: Object.values(tracks).reduce((s, v) => s + v.track.length, 0),
    processedAt: new Date().toISOString(),
    source: 'reconstructed-from-gap-events',
    note: 'Tracks for dark vessels built from AIS gap event positions in the AOI.',
    vessels: tracks,
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
