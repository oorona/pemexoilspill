#!/usr/bin/env node
'use strict';
/**
 * Process GFW raw data → 5 clean output files
 * ─────────────────────────────────────────────
 * Reads existing raw data (loitering-events-raw.json, port-visits.json,
 * track-arbol-grande.json) plus pemex-vessels.json reference list.
 *
 * Hard-filters to: start >= 2026-02-01 (no old mega-events from 2023).
 *
 * OUTPUT FILES (exactly 5):
 *   1. vessels-aoi.json         — unique vessel list in AOI, Feb–Mar 2026
 *   2. loitering-events.json    — filtered loitering events with positions
 *   3. pemex-loitering.json     — PEMEX-only subset (tagged _pemex=true)
 *   4. arbol-grande.json        — Árbol Grande events + track combined
 *   5. port-visits.json         — port visits, filtered
 *
 * After producing the 5 files, deletes all other stale files.
 *
 * Usage:
 *   node scripts/process-gfw-data.cjs
 */

const fs   = require('fs');
const path = require('path');

const GFW_BASE   = 'https://gateway.api.globalfishingwatch.org/v3';
const OUT_DIR    = path.join(__dirname, '..', 'public', 'data', 'gfw');
const START_DATE = '2026-02-01';
const END_DATE   = '2026-03-31';
const DELAY_MS   = 1200;

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

function loadJSON(filename) {
  const fp = path.join(OUT_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gfwFetch(url, key, opts = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveVesselByIMO(imo, key) {
  const url = new URL(`${GFW_BASE}/vessels/search`);
  url.searchParams.set('where', `imo='${imo}'`);
  url.searchParams.set('datasets[0]', 'public-global-vessel-identity:latest');
  url.searchParams.set('limit', '5');
  try {
    const data = await gfwFetch(url.toString(), key);
    const entry = data?.entries?.[0];
    if (!entry) return null;
    const sri = entry.selfReportedInfo?.[0] ?? {};
    const csi = entry.combinedSourcesInfo?.[0] ?? {};
    const id  = sri.id || csi.vesselId || entry.id || null;
    return {
      vesselId: id,
      name: sri.shipname || csi.shipname || null,
      flag: sri.flag || csi.flag || null,
      ssvid: sri.ssvid || csi.ssvid || entry.ssvid || null,
      imo,
    };
  } catch (err) {
    console.warn(`    ⚠ IMO ${imo}: ${err.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const key = readKey();
  if (!key) {
    console.error('ERROR: GFW API key not found (secrets/gfw_api_key.txt or GFW_API_KEY env)');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GFW Data Processor — Feb 1 – Mar 31, 2026');
  console.log('  Hard filter: start >= 2026-02-01');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Load + filter loitering data ──────────────────────────────────
  console.log('[1/5] Filtering loitering events (start >= 2026-02-01)…');
  const raw = loadJSON('loitering-events-raw.json');
  if (!raw) {
    console.error('  ✗ loitering-events-raw.json not found. Run fetch-gfw-data.cjs first.');
    process.exit(1);
  }
  const rawEntries = raw.entries ?? [];
  console.log(`  Raw entries: ${rawEntries.length}`);

  // Hard filter: only events starting on or after Feb 1 2026
  const filtered = rawEntries.filter(e => e.start >= '2026-02-01T');
  console.log(`  After hard filter: ${filtered.length} events`);

  // Extract unique vessels
  const vesselMap = new Map();
  for (const e of filtered) {
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
  const vesselList = [...vesselMap.values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''));
  console.log(`  Unique vessels: ${vesselList.length}`);

  // Output 1: vessels-aoi.json
  save('vessels-aoi.json', {
    total: vesselList.length,
    startDate: START_DATE,
    endDate: END_DATE,
    processedAt: new Date().toISOString(),
    entries: vesselList,
  });

  // Output 2: loitering-events.json
  save('loitering-events.json', {
    total: filtered.length,
    startDate: START_DATE,
    endDate: END_DATE,
    processedAt: new Date().toISOString(),
    note: 'Hard-filtered: start >= 2026-02-01. PEMEX vessels tagged _pemex=true.',
    entries: filtered,
  });

  // ── Step 2: Resolve PEMEX vessels + extract subset ────────────────────────
  console.log('\n[2/5] Resolving PEMEX vessels (IMO → MMSI)…');
  const pemexFile = path.join(OUT_DIR, 'pemex-vessels.json');
  let pemexVessels = [];
  try {
    const pdata = JSON.parse(fs.readFileSync(pemexFile, 'utf8'));
    pemexVessels = pdata.vessels ?? [];
  } catch (_) {}

  if (pemexVessels.length === 0) {
    console.log('  ⚠ No pemex-vessels.json found — skipping PEMEX tagging');
    save('pemex-loitering.json', { total: 0, entries: [] });
  } else {
    console.log(`  PEMEX vessel list: ${pemexVessels.length} vessels`);

    const pemexMMSIs = new Set();

    // First pass: vessels that already have MMSI
    for (const pv of pemexVessels) {
      if (pv.mmsi) {
        pemexMMSIs.add(String(pv.mmsi));
        console.log(`    ✓ ${pv.name ?? pv.mmsi} — MMSI ${pv.mmsi} (known)`);
      }
    }

    // Second pass: resolve IMO → MMSI for the rest
    const needsResolve = pemexVessels.filter(pv => !pv.mmsi && pv.imo);
    console.log(`  Resolving ${needsResolve.length} IMOs via GFW API…`);

    for (let i = 0; i < needsResolve.length; i++) {
      const pv = needsResolve[i];
      process.stdout.write(`    [${i + 1}/${needsResolve.length}] IMO ${pv.imo} (${pv.name ?? '?'})… `);
      const info = await resolveVesselByIMO(String(pv.imo), key);
      if (info?.ssvid) {
        pemexMMSIs.add(info.ssvid);
        // Cache resolution back in the vessel entry
        pv.ssvid = info.ssvid;
        pv.vesselId = info.vesselId;
        process.stdout.write(`→ MMSI ${info.ssvid}\n`);
      } else {
        process.stdout.write('✗ not found\n');
      }
      if (i < needsResolve.length - 1) await sleep(DELAY_MS);
    }

    console.log(`  Total PEMEX MMSIs resolved: ${pemexMMSIs.size}`);

    // Tag loitering entries + extract subset
    let tagCount = 0;
    for (const e of filtered) {
      if (e.vessel?.ssvid && pemexMMSIs.has(e.vessel.ssvid)) {
        e._pemex = true;
        tagCount++;
      }
    }
    const pemexEvents = filtered.filter(e => e._pemex);
    console.log(`  PEMEX loitering events: ${pemexEvents.length} (from ${tagCount} tagged)`);

    // Count unique PEMEX vessels found in data
    const pemexInData = new Set(pemexEvents.map(e => e.vessel?.ssvid));
    console.log(`  PEMEX vessels with loitering data: ${pemexInData.size}/${pemexVessels.length}`);

    // Output 3: pemex-loitering.json
    save('pemex-loitering.json', {
      total: pemexEvents.length,
      startDate: START_DATE,
      endDate: END_DATE,
      processedAt: new Date().toISOString(),
      pemexVesselsTotal: pemexVessels.length,
      pemexVesselsFound: pemexInData.size,
      entries: pemexEvents,
    });

    // Output 4: other-loitering.json (non-PEMEX vessels only)
    const otherEvents = filtered.filter(e => !e._pemex);
    console.log(`  Non-PEMEX loitering events: ${otherEvents.length}`);
    save('other-loitering.json', {
      total: otherEvents.length,
      startDate: START_DATE,
      endDate: END_DATE,
      processedAt: new Date().toISOString(),
      note: 'All loitering events EXCLUDING PEMEX-related vessels.',
      entries: otherEvents,
    });

    // Re-save loitering-events.json with _pemex tags applied
    save('loitering-events.json', {
      total: filtered.length,
      startDate: START_DATE,
      endDate: END_DATE,
      processedAt: new Date().toISOString(),
      note: 'Hard-filtered: start >= 2026-02-01. PEMEX vessels tagged _pemex=true.',
      entries: filtered,
    });
  }

  // ── Step 3: Árbol Grande ──────────────────────────────────────────────────
  console.log('\n[3/5] Árbol Grande…');
  const trackData = loadJSON('track-arbol-grande.json');
  const evtData   = loadJSON('arbol-grande-events.json');

  if (trackData && evtData) {
    // Combine into single file
    save('arbol-grande.json', {
      mmsi: '345070403',
      vesselId: trackData.vesselId ?? evtData.vesselId ?? null,
      startDate: START_DATE,
      endDate: END_DATE,
      processedAt: new Date().toISOString(),
      track: trackData.track ?? [],
      events: evtData.entries ?? [],
    });
    console.log(`  Track points: ${(trackData.track ?? []).length}, Events: ${(evtData.entries ?? []).length}`);
  } else if (trackData) {
    save('arbol-grande.json', { ...trackData, processedAt: new Date().toISOString() });
    console.log(`  Track points: ${(trackData.track ?? []).length} (no events file)`);
  } else {
    console.log('  ⚠ No Árbol Grande data found — run fetch-gfw-data.cjs --track-only');
    save('arbol-grande.json', { mmsi: '345070403', track: [], events: [] });
  }

  // ── Step 4: Port visits ───────────────────────────────────────────────────
  console.log('\n[4/5] Filtering port visits…');
  const portRaw = loadJSON('port-visits.json');
  if (portRaw) {
    const portEntries = portRaw.entries ?? [];
    console.log(`  Raw port visit entries: ${portEntries.length}`);
    const portFiltered = portEntries.filter(e => e.start >= '2026-02-01T');
    console.log(`  After hard filter: ${portFiltered.length}`);
    save('port-visits.json', {
      total: portFiltered.length,
      startDate: START_DATE,
      endDate: END_DATE,
      processedAt: new Date().toISOString(),
      entries: portFiltered,
    });
  } else {
    console.log('  ⚠ No port-visits.json found');
    save('port-visits.json', { total: 0, entries: [] });
  }

  // ── Step 5: Clean up stale files ──────────────────────────────────────────
  console.log('\n[5/5] Cleaning up stale files…');
  const KEEP = new Set([
    'vessels-aoi.json',
    'loitering-events.json',
    'pemex-loitering.json',
    'other-loitering.json',
    'arbol-grande.json',
    'port-visits.json',
    'pemex-vessels.json',     // input reference file (not pipeline output)
  ]);

  const allFiles = fs.readdirSync(OUT_DIR);
  let deleted = 0;
  for (const f of allFiles) {
    if (!KEEP.has(f)) {
      const fp = path.join(OUT_DIR, f);
      if (fs.statSync(fp).isFile()) {
        fs.unlinkSync(fp);
        console.log(`  🗑  ${f}`);
        deleted++;
      }
    }
  }
  console.log(`  Deleted ${deleted} stale files`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Done! Output files:');
  for (const f of KEEP) {
    const fp = path.join(OUT_DIR, f);
    if (fs.existsSync(fp)) {
      const kb = (fs.statSync(fp).size / 1024).toFixed(1);
      console.log(`    ${f}  (${kb} KB)`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
