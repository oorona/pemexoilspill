#!/usr/bin/env node
// ── extract-vessel-tracks.cjs ────────────────────────────────────────────────
// Reads the processed loitering-events.json (after pipeline step 5) and builds
// two GeoJSON files for the map:
//   • pemex-vessel-tracks.geojson  — PEMEX-associated vessels (blue on map)
//   • other-vessel-tracks.geojson  — All other vessels (gray/teal on map)
//
// Each vessel gets a LineString feature with its loitering positions sorted by
// date, plus Point features for each position (for the animated replay).
//
// Run:  node scripts/extract-vessel-tracks.cjs
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'gfw');

// ── Load data ────────────────────────────────────────────────────────────────

const loiteringPath = path.join(DATA_DIR, 'loitering-events.json');
if (!fs.existsSync(loiteringPath)) {
  console.error('✗ loitering-events.json not found — run the pipeline first');
  process.exit(1);
}

const loitering = JSON.parse(fs.readFileSync(loiteringPath, 'utf8'));
const entries = loitering.entries ?? [];
console.log(`Loaded ${entries.length} loitering entries`);

// ── Group by vessel ──────────────────────────────────────────────────────────

const vesselMap = {};

for (const e of entries) {
  const ssvid = e.vessel?.ssvid;
  if (!ssvid) continue;

  if (!vesselMap[ssvid]) {
    vesselMap[ssvid] = {
      ssvid,
      name: e.vessel.name ?? ssvid,
      flag: e.vessel.flag ?? null,
      type: e.vessel.type ?? null,
      pemex: !!e._pemex,
      positions: [],
    };
  }

  // Use the synthetic daily position or the event centroid
  const lat = e.position?.lat;
  const lon = e.position?.lon;
  if (lat == null || lon == null) continue;

  // Use start date as the position timestamp
  const date = (e.start ?? '').slice(0, 10);
  if (!date) continue;

  vesselMap[ssvid].positions.push({
    date,
    lat,
    lon,
    durationH: e.loitering?.totalTimeHours ?? null,
  });

  // Carry forward pemex tag
  if (e._pemex) vesselMap[ssvid].pemex = true;
}

// Sort each vessel's positions by date and deduplicate by date
for (const v of Object.values(vesselMap)) {
  v.positions.sort((a, b) => a.date.localeCompare(b.date));
  // Deduplicate: keep first position per date
  const seen = new Set();
  v.positions = v.positions.filter(p => {
    if (seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
}

// ── Statistics ────────────────────────────────────────────────────────────────

const allVessels   = Object.values(vesselMap);
const pemexVessels = allVessels.filter(v => v.pemex);
const otherVessels = allVessels.filter(v => !v.pemex);

console.log(`\n─── VESSEL SUMMARY ───`);
console.log(`Total unique vessels:  ${allVessels.length}`);
console.log(`PEMEX-associated:      ${pemexVessels.length}`);
console.log(`Other vessels:         ${otherVessels.length}`);

console.log(`\nPEMEX vessels:`);
for (const v of pemexVessels) {
  console.log(`  ${v.ssvid} — ${v.name} [${v.flag ?? '?'}] (${v.positions.length} positions)`);
}

console.log(`\nOther vessels (first 40):`);
for (const v of otherVessels.slice(0, 40)) {
  console.log(`  ${v.ssvid} — ${v.name} [${v.flag ?? '?'}] (${v.positions.length} positions)`);
}
if (otherVessels.length > 40) console.log(`  ... and ${otherVessels.length - 40} more`);

// ── Build GeoJSON ────────────────────────────────────────────────────────────

function buildGeoJSON(vessels) {
  const features = [];

  for (const v of vessels) {
    if (v.positions.length === 0) continue;

    // Trail line
    if (v.positions.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: v.positions.map(p => [p.lon, p.lat]),
        },
        properties: {
          ssvid:  v.ssvid,
          name:   v.name,
          flag:   v.flag,
          vtype:  v.type,
          pemex:  v.pemex,
          featureType: 'trail',
        },
      });
    }

    // Individual position points (for time-based filtering on the map)
    for (const p of v.positions) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat],
        },
        properties: {
          ssvid:  v.ssvid,
          name:   v.name,
          flag:   v.flag,
          vtype:  v.type,
          pemex:  v.pemex,
          date:   p.date,
          durationH: p.durationH,
          featureType: 'position',
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ── Save ─────────────────────────────────────────────────────────────────────

const pemexGeo = buildGeoJSON(pemexVessels);
const otherGeo = buildGeoJSON(otherVessels);

const pemexPath = path.join(DATA_DIR, 'pemex-vessel-tracks.geojson');
const otherPath = path.join(DATA_DIR, 'other-vessel-tracks.geojson');

fs.writeFileSync(pemexPath, JSON.stringify(pemexGeo));
fs.writeFileSync(otherPath, JSON.stringify(otherGeo));

console.log(`\n─── OUTPUT ───`);
console.log(`PEMEX tracks: ${pemexPath}`);
console.log(`  ${pemexGeo.features.length} features (${pemexVessels.filter(v => v.positions.length >= 2).length} trails + ${pemexGeo.features.filter(f => f.properties.featureType === 'position').length} points)`);
console.log(`Other tracks: ${otherPath}`);
console.log(`  ${otherGeo.features.length} features (${otherVessels.filter(v => v.positions.length >= 2).length} trails + ${otherGeo.features.filter(f => f.properties.featureType === 'position').length} points)`);
console.log(`\nDone! Run the map to see the layers.`);
