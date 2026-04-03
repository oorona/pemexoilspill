#!/usr/bin/env node
'use strict';
/**
 * GFW historical data fetch script — 2026 Gulf of Mexico PEMEX Spill
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO-PHASE STRATEGY
 *
 * Phase 1 — Vessel discovery:
 *   Query the GFW 4Wings presence report (grouped by VESSEL_ID) to get every
 *   vessel that was in the AOI during Jan 20 – Mar 31 2026.
 *   Saves: vessels-aoi.json
 *
 * Phase 2 — Targeted event fetch:
 *   For each event type (loitering, encounters, port visits), query by:
 *     • vessels: [<ids from phase 1>]   — filters to discovered vessel set
 *     • geometry: AOI_GEO               — keep only events inside AOI
 *     • weekly time chunks              — avoid 524 timeouts on large ranges
 *   Vessel IDs are batched in groups of 20 per request.
 *   Saves: loitering-events.json, encounter-events.json, port-visits.json
 *
 * Also fetches:
 *   track-arbol-grande.json   — full AIS track for Árbol Grande (MMSI 345070403)
 *   manifest.json             — fetch metadata
 *
 * Usage:
 *   node scripts/fetch-gfw-data.cjs
 *
 * API key read from (in order):
 *   secrets/gfw_api_key   (Docker secret / local dev)
 *   GFW_API_KEY           (env var)
 */

const fs   = require('fs');
const path = require('path');

const GFW_BASE = 'https://gateway.api.globalfishingwatch.org/v3';
const OUT_DIR  = path.join(__dirname, '..', 'public', 'data', 'gfw');

// Date range for the investigation — only Feb 1 – Mar 31 2026
const START_DATE = '2026-02-01';
const END_DATE   = '2026-03-31';
const MMSI       = '345070403';  // Árbol Grande

// ── PEMEX vessel list ─────────────────────────────────────────────────────────
// Loaded from public/data/gfw/pemex-vessels.json at runtime.
// Vessels can be identified by IMO number (preferred) or MMSI.
// Format: { vessels: [{ imo: "1234567", name: "VESSEL" }, ...] }
const PEMEX_VESSELS_FILE = path.join(OUT_DIR, 'pemex-vessels.json');

function loadPemexVessels() {
  try {
    if (fs.existsSync(PEMEX_VESSELS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PEMEX_VESSELS_FILE, 'utf8'));
      return data.vessels ?? [];
    }
  } catch (_) {}
  return [];
}

// Gulf of Mexico AOI — covers the spill area + terminal ports
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

// Max vessel IDs per events request (keeps request body size manageable)
const VESSEL_BATCH_SIZE = 20;
// Delay between API requests to respect rate limits
const DELAY_MS = 1200;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split [startStr, endStr] into 7-day windows.
 * Each window is { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }.
 */
function weeklyChunks(startStr, endStr) {
  const chunks  = [];
  let   cur     = new Date(startStr + 'T00:00:00Z');
  const endDate = new Date(endStr   + 'T23:59:59Z');
  while (cur < endDate) {
    const next = new Date(Math.min(cur.getTime() + 7 * 86_400_000 - 1, endDate.getTime()));
    chunks.push({ start: cur.toISOString().slice(0, 10), end: next.toISOString().slice(0, 10) });
    cur = new Date(next.getTime() + 1);
  }
  return chunks;
}

/** Split an array into fixed-size batches. */
function batches(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

// ─── Phase 1: Vessel discovery ────────────────────────────────────────────────

/**
 * Use the 4Wings presence report (grouped by VESSEL_ID) to enumerate every
 * vessel that had AIS presence in the AOI during the investigation window.
 * Returns array of { vesselId, ssvid, hours }.
 */
/**
 * Resolve Árbol Grande's GFW vessel ID from MMSI via identity search.
 * Returns the vessel ID string, or null if not found.
 */
async function resolveVesselId(key) {
  return resolveVesselIdByMMSI(MMSI, key);
}

/**
 * Resolve any MMSI to a GFW vessel ID via identity search.
 * Returns { vesselId, name, flag, ssvid } or null.
 */
async function resolveVesselIdByMMSI(mmsi, key) {
  const url = new URL(`${GFW_BASE}/vessels/search`);
  url.searchParams.set('where', `ssvid="${mmsi}"`);
  url.searchParams.set('datasets[0]', 'public-global-vessel-identity:latest');
  url.searchParams.set('limit', '5');
  try {
    const data = await gfwFetch(url.toString(), key);
    const entry = data?.entries?.[0];
    if (!entry) return null;
    const id = entry.selfReportedInfo?.[0]?.id ||
               entry.combinedSourcesInfo?.[0]?.vesselId ||
               entry.id || null;
    const sri = entry.selfReportedInfo?.[0] ?? {};
    const csi = entry.combinedSourcesInfo?.[0] ?? {};
    return {
      vesselId: id,
      name: sri.shipname || csi.shipname || null,
      flag: sri.flag || csi.flag || null,
      ssvid: mmsi,
    };
  } catch (err) {
    console.warn(`  ⚠  Failed to resolve MMSI ${mmsi}: ${err.message}`);
    return null;
  }
}

/**
 * Resolve an IMO number to a GFW vessel ID + MMSI via identity search.
 * Returns { vesselId, name, flag, ssvid (MMSI), imo } or null.
 */
async function resolveVesselByIMO(imo, key) {
  const url = new URL(`${GFW_BASE}/vessels/search`);
  url.searchParams.set('where', `imo='${imo}'`);
  url.searchParams.set('datasets[0]', 'public-global-vessel-identity:latest');
  url.searchParams.set('limit', '5');
  try {
    const data = await gfwFetch(url.toString(), key);
    const entry = data?.entries?.[0];
    if (!entry) return null;
    const id = entry.selfReportedInfo?.[0]?.id ||
               entry.combinedSourcesInfo?.[0]?.vesselId ||
               entry.id || null;
    const sri = entry.selfReportedInfo?.[0] ?? {};
    const csi = entry.combinedSourcesInfo?.[0] ?? {};
    const ri  = entry.registryInfo?.[0] ?? {};
    return {
      vesselId: id,
      name: sri.shipname || csi.shipname || ri.shipname || null,
      flag: sri.flag || csi.flag || ri.flag || null,
      ssvid: sri.ssvid || csi.ssvid || entry.ssvid || null,
      imo: imo,
    };
  } catch (err) {
    console.warn(`  ⚠  Failed to resolve IMO ${imo}: ${err.message}`);
    return null;
  }
}

/**
 * Paginate through all events for a vessel (no geometry filter — vessel ID is precise enough).
 * Returns { total, entries }.
 */
async function fetchAllEventsForVessel(dataset, vesselId, extraBody, key) {
  const PAGE    = 50;
  let   offset  = 0;
  let   total   = null;
  const entries = [];
  while (true) {
    const url  = `${GFW_BASE}/events?offset=${offset}&limit=${PAGE}`;
    const body = JSON.stringify({
      datasets: [dataset],
      startDate: START_DATE,
      endDate:   END_DATE,
      vessels:   [vesselId],
      ...extraBody,
    });
    const data = await gfwFetch(url, key, { method: 'POST', body });
    const page = data.entries ?? [];
    entries.push(...page);
    if (total === null) total = data.total ?? 0;
    process.stdout.write(`    ${entries.length}/${total}\r`);
    if (page.length < PAGE || entries.length >= total) break;
    offset += PAGE;
    await sleep(DELAY_MS);
  }
  process.stdout.write('\n');
  return { total: entries.length, entries };
}

/**
 * Fetch Árbol Grande specific events (loitering + port visits) by vessel ID.
 * Also builds a position-based track from those events and saves:
 *   arbol-grande-events.json — all vessel-specific events
 *   track-arbol-grande.json  — time-ordered positions from events
 *   vessels-aoi.json         — placeholder (vessel enumeration not available on public tier)
 */
async function fetchArbolGrandeData(key) {
  console.log('\n[1/4] Resolving Árbol Grande vessel ID (MMSI 345070403)…');

  const resolved = await resolveVesselIdByMMSI(MMSI, key);
  const vesselId = resolved?.vesselId;
  if (!vesselId) {
    console.warn('  ⚠  Vessel not found in GFW identity DB');
    save('track-arbol-grande.json', { mmsi: MMSI, vesselId: null, count: 0, track: [] });
    save('arbol-grande-events.json', { total: 0, entries: [] });
    return;
  }
  console.log(`  vesselId: ${vesselId}`);

  // Fetch all event types for this specific vessel
  console.log('  Fetching loitering events for vessel…');
  const loitering = await fetchAllEventsForVessel(
    'public-global-loitering-events:latest', vesselId, {}, key);
  console.log(`  → ${loitering.total} loitering events`);
  await sleep(DELAY_MS);

  console.log('  Fetching port visit events for vessel (confidence 3–4)…');
  const portVisits = await fetchAllEventsForVessel(
    'public-global-port-visits-events:latest', vesselId, { confidences: ['3', '4'] }, key);
  console.log(`  → ${portVisits.total} port visit events`);
  await sleep(DELAY_MS);

  console.log('  Fetching encounter events for vessel…');
  const encounters = await fetchAllEventsForVessel(
    'public-global-encounters-events:latest', vesselId, {}, key);
  console.log(`  → ${encounters.total} encounter events`);

  // Combine and sort all events by time
  const allEvents = [
    ...loitering.entries,
    ...portVisits.entries,
    ...encounters.entries,
  ].sort((a, b) => a.start.localeCompare(b.start));

  save('arbol-grande-events.json', {
    total: allEvents.length,
    vesselId,
    mmsi: MMSI,
    startDate: START_DATE,
    endDate:   END_DATE,
    entries:   allEvents,
  });

  // Build track: extract positions from events
  // Each event has a position + start/end timestamps → contributes start + end points
  const seen    = new Set();
  const points  = [];
  for (const e of allEvents) {
    for (const ts of [e.start, e.end].filter(Boolean)) {
      const key2 = ts.slice(0, 13); // deduplicate to hourly
      if (seen.has(key2)) continue;
      seen.add(key2);
      if (e.position?.lat && e.position?.lon) {
        points.push({ t: new Date(ts).toISOString(), lat: e.position.lat, lon: e.position.lon });
      }
    }
  }
  points.sort((a, b) => a.t.localeCompare(b.t));

  console.log(`  Track reconstructed from events: ${points.length} position points`);
  save('track-arbol-grande.json', {
    mmsi: MMSI,
    vesselId,
    count:     points.length,
    source:    'reconstructed-from-events',
    note:      'GFW public tier does not expose AIS tracks for non-fishing vessels. Track built from loitering+port-visit event positions.',
    track:     points,
  });

  // vessels-aoi placeholder (4Wings group-by not supported on public-global-presence)
  save('vessels-aoi.json', {
    total: 1,
    note:  'GFW 4Wings group-by not available for public-global-presence on public API tier. Known vessel listed.',
    entries: [{ vesselId, ssvid: MMSI, name: 'ARBOL GRANDE', flag: 'MEX' }],
  });
}

// ─── AOI-wide events fetcher (weekly-chunked) ────────────────────────────────

/**
 * Paginate one events request (one vessel batch × one time chunk).
 * Returns entries array.
 */
async function fetchEventPage(dataset, extraBody, start, end, key) {
  const PAGE    = 50;
  let   offset  = 0;
  let   total   = null;
  const entries = [];

  while (true) {
    const url  = `${GFW_BASE}/events?offset=${offset}&limit=${PAGE}`;
    const body = JSON.stringify({
      datasets: [dataset],
      startDate: start,
      endDate:   end,
      geometry:  AOI_POLYGON,
      ...extraBody,
    });
    const data = await gfwFetch(url, key, { method: 'POST', body });
    const page = data.entries ?? [];
    entries.push(...page);
    if (total === null) total = data.total ?? 0;
    if (page.length < PAGE || entries.length >= total) break;
    offset += PAGE;
    await sleep(DELAY_MS);
  }
  return entries;
}

/**
 * Fetch all events for a dataset:
 *   - batches vessel IDs (VESSEL_BATCH_SIZE per request)
 *   - weekly time chunks
 *   - deduplicates by event id
 */
async function fetchEventsByWeek(label, dataset, extraBody, key) {
  const chunks = weeklyChunks(START_DATE, END_DATE);
  console.log(`\n  Fetching ${label} — AOI × ${chunks.length} weekly chunks…`);

  const seen    = new Set();
  const entries = [];

  for (const { start, end } of chunks) {
    process.stdout.write(`    ${start}–${end}… `);
    try {
      const page = await fetchEventPage(dataset, extraBody, start, end, key);
      let added = 0;
      for (const e of page) {
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

  console.log(`  ${label}: ${entries.length} unique events`);
  return { total: entries.length, entries };
}

// ─── Step 2: AOI-wide loitering events ────────────────────────────────────────

async function fetchLoiteringEvents(key) {
  console.log('\n[2/5] AOI-wide loitering events (weekly chunks)…');
  const result = await fetchEventsByWeek(
    'loitering',
    'public-global-loitering-events:latest',
    {},
    key,
  );
  save('loitering-events-raw.json', result);
  return result;
}

// ─── Step 3: AOI-wide encounter events ────────────────────────────────────────

async function fetchEncounterEvents(key) {
  console.log('\n[3/5] AOI-wide encounter events (weekly chunks)…');
  const result = await fetchEventsByWeek(
    'encounters',
    'public-global-encounters-events:latest',
    {},
    key,
  );
  save('encounter-events.json', result);
}

// ─── Step 4: AOI-wide port visit events ───────────────────────────────────────

async function fetchPortVisitEvents(key) {
  console.log('\n[4/5] AOI-wide port visit events (confidence 3–4)…');
  const result = await fetchEventsByWeek(
    'port visits',
    'public-global-port-visits-events:latest',
    { confidences: ['3', '4'] },
    key,
  );
  save('port-visits.json', result);
}

// ─── Step 5: Build clean loitering-events.json ───────────────────────────────
// Strategy:
//  1. Take raw AOI-wide loitering events (step 2)
//  2. Filter to only events whose date range overlaps START_DATE–END_DATE
//  3. For mega-events (>7 days, single position), split into daily entries
//     so they appear on the map timeline correctly
//  4. Collect the unique vessel list (vessels-aoi.json) for reference
//  5. If pemex-vessels.json exists, flag which vessels are PEMEX-related

/**
 * Split a mega-event (spanning many days with a single position) into daily
 * synthetic entries so the map shows the vessel on every day it was loitering.
 */
function splitMegaEvent(event) {
  const startMs = +new Date(event.start);
  const endMs   = +new Date(event.end);
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return [event];

  const totalDays = totalMs / 86_400_000;
  if (totalDays <= 7) return [event];

  const hoursPerDay = (event.loitering?.totalTimeHours ?? totalDays * 24) / totalDays;
  const distPerDay  = (event.loitering?.totalDistanceKm ?? 0) / totalDays;
  const synthetics  = [];

  // Clamp to investigation window
  const windowStart = new Date(START_DATE + 'T00:00:00Z');
  const windowEnd   = new Date(END_DATE   + 'T23:59:59Z');
  let cursor = new Date(Math.max(startMs, +windowStart));
  const clampEnd = new Date(Math.min(endMs, +windowEnd));

  while (cursor < clampEnd) {
    const dayEnd = new Date(Math.min(cursor.getTime() + 86_400_000 - 1, +clampEnd));
    synthetics.push({
      ...event,
      id: `${event.id}_${cursor.toISOString().slice(0, 10)}`,
      start: cursor.toISOString(),
      end:   dayEnd.toISOString(),
      _synthetic: true,
      _originalId: event.id,
      loitering: {
        ...event.loitering,
        totalTimeHours: hoursPerDay,
        totalDistanceKm: distPerDay,
      },
    });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return synthetics;
}

/**
 * Checks whether an event's date range overlaps with our investigation window.
 */
function eventOverlapsWindow(event) {
  const eStart = event.start?.slice(0, 10) ?? '';
  const eEnd   = event.end?.slice(0, 10)   ?? eStart;
  // Event overlaps window if it doesn't end before our start AND doesn't start after our end
  return eEnd >= START_DATE && eStart <= END_DATE;
}

async function buildCleanLoitering(key) {
  console.log('\n[5/5] Building clean loitering-events.json…');

  // Load raw AOI-wide data
  const rawPath = path.join(OUT_DIR, 'loitering-events-raw.json');
  let rawEntries = [];
  try {
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    rawEntries = raw.entries ?? [];
    console.log(`  Loaded ${rawEntries.length} raw AOI-wide entries`);
  } catch (_) {
    console.log('  ⚠ No loitering-events-raw.json found — run step 2 first');
    return;
  }

  // Filter to only events overlapping our investigation window
  const inWindow = rawEntries.filter(eventOverlapsWindow);
  console.log(`  After date filter (${START_DATE} – ${END_DATE}): ${inWindow.length} events`);

  // Split mega-events into daily synthetics
  let splitCount = 0;
  const final = [];
  for (const e of inWindow) {
    const startMs = +new Date(e.start);
    const endMs   = +new Date(e.end);
    const days    = (endMs - startMs) / 86_400_000;

    if (days > 7) {
      const pieces = splitMegaEvent(e);
      final.push(...pieces);
      splitCount++;
      console.log(`    Split: ${e.vessel?.name ?? '?'} (${days.toFixed(0)} days) → ${pieces.length} daily entries`);
    } else {
      final.push(e);
    }
  }
  console.log(`  Final: ${final.length} entries (${splitCount} mega-events split into daily)`);

  // Build unique vessel list
  const vesselMap = new Map();
  for (const e of inWindow) {
    const ssvid = e.vessel?.ssvid;
    if (ssvid && !vesselMap.has(ssvid)) {
      vesselMap.set(ssvid, {
        ssvid,
        name: e.vessel.name ?? null,
        flag: e.vessel.flag ?? null,
        vesselId: e.vessel.id ?? null,
        type: e.vessel.type ?? null,
      });
    }
  }
  const vesselList = [...vesselMap.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  console.log(`  Unique vessels in window: ${vesselList.length}`);

  // Check PEMEX vessel list and tag entries
  // Supports both IMO and MMSI identifiers — resolves IMO→MMSI via GFW API
  const pemexVessels = loadPemexVessels();
  if (pemexVessels.length > 0) {
    console.log(`  PEMEX vessel list loaded: ${pemexVessels.length} vessels`);

    // Resolve all PEMEX vessels to MMSIs
    const pemexMMSIs = new Set();
    const pemexResolved = [];
    for (const pv of pemexVessels) {
      if (pv.mmsi) {
        // Already has MMSI
        pemexMMSIs.add(String(pv.mmsi));
        pemexResolved.push({ ...pv, ssvid: String(pv.mmsi) });
        console.log(`    ✓ ${pv.name ?? pv.mmsi} — MMSI ${pv.mmsi}`);
      } else if (pv.imo) {
        // Resolve IMO → MMSI via GFW API
        const info = await resolveVesselByIMO(String(pv.imo), key);
        if (info?.ssvid) {
          pemexMMSIs.add(info.ssvid);
          pemexResolved.push({ ...pv, ssvid: info.ssvid, vesselId: info.vesselId, resolvedName: info.name });
          console.log(`    ✓ ${pv.name ?? pv.imo} — IMO ${pv.imo} → MMSI ${info.ssvid} (${info.name ?? '?'})`);
        } else {
          console.log(`    ✗ ${pv.name ?? pv.imo} — IMO ${pv.imo} not found in GFW`);
          pemexResolved.push({ ...pv, ssvid: null });
        }
        await sleep(DELAY_MS);
      }
    }

    // Tag matching loitering entries
    for (const e of final) {
      if (e.vessel?.ssvid && pemexMMSIs.has(e.vessel.ssvid)) {
        e._pemex = true;
      }
    }
    const pemexMatches = vesselList.filter(v => pemexMMSIs.has(v.ssvid));
    console.log(`  PEMEX vessels found in AOI data: ${pemexMatches.length}/${pemexVessels.length}`);

    // Save resolved PEMEX list for the map layer
    save('pemex-vessels-resolved.json', {
      total: pemexResolved.length,
      resolvedAt: new Date().toISOString(),
      note: 'PEMEX vessels resolved from IMO/MMSI. ssvid=MMSI used to match loitering data.',
      entries: pemexResolved,
    });
  }

  // Save clean loitering
  save('loitering-events.json', {
    total: final.length,
    fetchedAt: new Date().toISOString(),
    startDate: START_DATE,
    endDate: END_DATE,
    note: 'Filtered to investigation window. Mega-events (>7 days) split into daily synthetic entries (_synthetic=true). PEMEX vessels tagged with _pemex=true.',
    entries: final,
  });

  // Save vessel list
  save('vessels-aoi.json', {
    total: vesselList.length,
    fetchedAt: new Date().toISOString(),
    startDate: START_DATE,
    endDate: END_DATE,
    note: 'All vessels with loitering events in the AOI during the investigation window.',
    entries: vesselList,
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const key = readKey();
  if (!key) {
    console.error('ERROR: GFW API key not found.\n' +
      '  Place it in secrets/gfw_api_key  OR  set env var GFW_API_KEY');
    process.exit(1);
  }

  // ── CLI flags ──────────────────────────────────────────────────────────────
  const trackOnly = process.argv.includes('--track-only');

  const chunks = weeklyChunks(START_DATE, END_DATE);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GFW Historical Data Fetch — 2026 Gulf of Mexico Oil Spill');
  console.log(`  Period  : ${START_DATE} → ${END_DATE}  (${chunks.length} weekly chunks)`);
  if (trackOnly) console.log('  Mode    : --track-only (skipping event steps)');
  console.log('═══════════════════════════════════════════════════════════════');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = {};
  const run = async (name, fn) => {
    try { await fn(); results[name] = 'ok'; }
    catch (e) { console.error(`\n  ✗ ${name}:`, e.message); results[name] = e.message; }
  };

  if (trackOnly) {
    // Only re-fetch Árbol Grande events + track (vessel-ID-filtered)
    await run('arbolGrande', () => fetchArbolGrandeData(key));
  } else {
    // ── Step 1: Árbol Grande vessel data (events + reconstructed track) ──────
    await run('arbolGrande', () => fetchArbolGrandeData(key));

    // ── Steps 2–4: AOI-wide events (skip if files already exist unless --force) ──
    const force = process.argv.includes('--force');
    const skip  = (file) => !force && fs.existsSync(path.join(OUT_DIR, file));

    if (skip('loitering-events-raw.json')) {
      console.log('\n[2/5] loitering-events-raw.json exists, skipping (use --force to re-download)');
      results.loitering = 'skipped';
    } else {
      await run('loitering', () => fetchLoiteringEvents(key));
    }

    if (skip('encounter-events.json')) {
      console.log('\n[3/5] encounter-events.json exists, skipping');
      results.encounters = 'skipped';
    } else {
      await run('encounters', () => fetchEncounterEvents(key));
    }

    if (skip('port-visits.json')) {
      console.log('\n[4/5] port-visits.json exists, skipping');
      results.portVisits = 'skipped';
    } else {
      await run('portVisits', () => fetchPortVisitEvents(key));
    }

    // ── Step 5: Build clean loitering + resolve PEMEX IMOs ──────────────────
    await run('cleanLoitering', () => buildCleanLoitering(key));
  }

  // Update manifest with completion info
  try {
    const mPath = path.join(OUT_DIR, 'manifest.json');
    const mData = fs.existsSync(mPath)
      ? JSON.parse(fs.readFileSync(mPath, 'utf8'))
      : { fetchedAt: new Date().toISOString(), startDate: START_DATE, endDate: END_DATE };
    mData.completedAt = new Date().toISOString();
    mData.results     = results;
    save('manifest.json', mData);
  } catch (_) {}

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Done! Static data written to public/data/gfw/');
  Object.entries(results).forEach(([k, v]) =>
    console.log(`  ${v === 'ok' ? '✓' : '✗'} ${k}: ${v}`));
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
