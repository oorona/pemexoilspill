#!/usr/bin/env node
'use strict';
/**
 * Build PEMEX vessel tracks from existing AOI-wide event data
 * ────────────────────────────────────────────────────────────
 * Reads loitering-events.json + port-visits.json (already fetched).
 * Groups ALL events by vessel SSVID, builds position tracks from
 * event start/end timestamps, then filters to PEMEX vessels only
 * and excludes Árbol Grande (has its own track file).
 *
 * Output: pemex-tracks.json
 *
 * Usage:
 *   node scripts/build-pemex-tracks.cjs
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR    = path.join(__dirname, '..', 'public', 'data', 'gfw');
const ARBOL_GRANDE_SSVID = '345070403';

function loadJSON(filename) {
  const fp = path.join(OUT_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function save(filename, data) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  ✓  ${filename}  (${kb} KB)`);
}

/**
 * Build a track from a list of events.
 * Extracts lat/lon from event.position at both start and end timestamps.
 * Deduplicates to hourly resolution, sorts chronologically.
 */
function buildTrackFromEvents(events) {
  const seen   = new Set();
  const points = [];

  for (const e of events) {
    if (!e.position?.lat || !e.position?.lon) continue;
    for (const ts of [e.start, e.end].filter(Boolean)) {
      const hourKey = ts.slice(0, 13); // deduplicate to hourly
      if (seen.has(hourKey)) continue;
      seen.add(hourKey);
      points.push({
        t:   new Date(ts).toISOString(),
        lat: e.position.lat,
        lon: e.position.lon,
      });
    }
  }

  points.sort((a, b) => a.t.localeCompare(b.t));
  return points;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Build PEMEX Vessel Tracks from AOI Event Data');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Load all event data ───────────────────────────────────────────
  console.log('[1/4] Loading event data…');

  const loiteringData = loadJSON('loitering-events.json');
  if (!loiteringData) {
    console.error('  ✗ loitering-events.json not found');
    process.exit(1);
  }
  const loiteringEvents = loiteringData.entries ?? [];
  console.log(`  Loitering events: ${loiteringEvents.length}`);

  const portVisitData = loadJSON('port-visits.json');
  const portVisitEvents = portVisitData?.entries ?? [];
  console.log(`  Port visit events: ${portVisitEvents.length}`);

  const allEvents = [...loiteringEvents, ...portVisitEvents];
  console.log(`  Total events: ${allEvents.length}`);

  // ── Step 2: Group ALL events by vessel SSVID ──────────────────────────────
  console.log('\n[2/4] Grouping events by vessel…');

  const vesselEvents = new Map(); // ssvid → { name, flag, type, vesselId, events[] }

  for (const e of allEvents) {
    const ssvid = e.vessel?.ssvid;
    if (!ssvid) continue;

    if (!vesselEvents.has(ssvid)) {
      vesselEvents.set(ssvid, {
        name:     e.vessel.name ?? null,
        flag:     e.vessel.flag ?? null,
        type:     e.vessel.type ?? null,
        vesselId: e.vessel.id   ?? null,
        events:   [],
      });
    }
    vesselEvents.get(ssvid).events.push(e);
  }

  console.log(`  Unique vessels in AOI: ${vesselEvents.size}`);

  // ── Step 3: Build tracks for ALL vessels ──────────────────────────────────
  console.log('\n[3/4] Building tracks for all vessels…');

  const allTracks = new Map(); // ssvid → { name, flag, type, vesselId, track[] }
  let totalPoints = 0;

  for (const [ssvid, info] of vesselEvents) {
    const track = buildTrackFromEvents(info.events);
    if (track.length === 0) continue;
    allTracks.set(ssvid, {
      name:     info.name,
      flag:     info.flag,
      type:     info.type,
      vesselId: info.vesselId,
      track,
    });
    totalPoints += track.length;
  }

  console.log(`  Vessels with tracks: ${allTracks.size}`);
  console.log(`  Total track points: ${totalPoints}`);

  // ── Step 4: Filter to PEMEX vessels, exclude Árbol Grande ─────────────────
  console.log('\n[4/4] Filtering to PEMEX vessels…');

  // Identify PEMEX SSVIDs from the _pemex tag in loitering events
  const pemexSSVIDs = new Set();
  for (const e of loiteringEvents) {
    if (e._pemex && e.vessel?.ssvid) {
      pemexSSVIDs.add(e.vessel.ssvid);
    }
  }
  console.log(`  PEMEX SSVIDs from loitering tags: ${pemexSSVIDs.size}`);

  // Also check pemex-vessels.json for any vessels with known MMSI
  const pemexVesselsData = loadJSON('pemex-vessels.json');
  if (pemexVesselsData?.vessels) {
    for (const pv of pemexVesselsData.vessels) {
      if (pv.mmsi) pemexSSVIDs.add(String(pv.mmsi));
    }
    console.log(`  PEMEX SSVIDs after adding known MMSIs: ${pemexSSVIDs.size}`);
  }

  // Exclude Árbol Grande
  pemexSSVIDs.delete(ARBOL_GRANDE_SSVID);
  console.log(`  After excluding Árbol Grande: ${pemexSSVIDs.size}`);

  // Filter tracks
  const pemexTracks = {};
  let pemexPoints = 0;
  for (const ssvid of pemexSSVIDs) {
    if (allTracks.has(ssvid)) {
      const t = allTracks.get(ssvid);
      pemexTracks[ssvid] = t;
      pemexPoints += t.track.length;
      console.log(`    ${t.name ?? ssvid} — ${t.track.length} track points`);
    }
  }

  const pemexCount = Object.keys(pemexTracks).length;
  console.log(`\n  PEMEX vessels with tracks: ${pemexCount}`);
  console.log(`  Total PEMEX track points: ${pemexPoints}`);
  console.log(`  Average points per vessel: ${pemexCount > 0 ? (pemexPoints / pemexCount).toFixed(1) : 0}`);

  // ── Build non-PEMEX (other) tracks ────────────────────────────────────────
  console.log('\n  Building non-PEMEX vessel tracks…');
  const otherTracks = {};
  let otherPoints = 0;
  for (const [ssvid, info] of allTracks) {
    if (pemexSSVIDs.has(ssvid) || ssvid === ARBOL_GRANDE_SSVID) continue;
    otherTracks[ssvid] = info;
    otherPoints += info.track.length;
  }
  const otherCount = Object.keys(otherTracks).length;
  console.log(`  Non-PEMEX vessels with tracks: ${otherCount}`);
  console.log(`  Total non-PEMEX track points: ${otherPoints}`);
  console.log(`  Average points per vessel: ${otherCount > 0 ? (otherPoints / otherCount).toFixed(1) : 0}`);

  // ── Save ──────────────────────────────────────────────────────────────────
  save('pemex-tracks.json', {
    total: pemexCount,
    totalPoints: pemexPoints,
    processedAt: new Date().toISOString(),
    source: 'reconstructed-from-events',
    note: 'Tracks built from loitering + port visit event positions for all AOI vessels, filtered to PEMEX, excluding Árbol Grande.',
    vessels: pemexTracks,
  });

  save('other-tracks.json', {
    total: otherCount,
    totalPoints: otherPoints,
    processedAt: new Date().toISOString(),
    source: 'reconstructed-from-events',
    note: 'Tracks built from loitering + port visit event positions for all non-PEMEX vessels in AOI.',
    vessels: otherTracks,
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Done!');
}

main();
