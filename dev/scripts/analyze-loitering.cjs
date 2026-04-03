#!/usr/bin/env node
'use strict';
const d = require('../public/data/gfw/loitering-events.json');
const entries = d.entries;
console.log('Total entries:', entries.length);

const byVessel = {};
entries.forEach(e => {
  const name = e.vessel?.name || 'UNKNOWN';
  const mmsi = e.vessel?.ssvid || '???';
  const key = name + ' (' + mmsi + ')';
  if (!byVessel[key]) byVessel[key] = { count: 0, positions: new Set(), durations: [] };
  byVessel[key].count++;
  byVessel[key].positions.add(e.position.lat.toFixed(3) + ',' + e.position.lon.toFixed(3));
  const hours = e.loitering?.totalTimeHours ?? 0;
  byVessel[key].durations.push(hours);
});

console.log('\nVessels by event count (count | unique positions | vessel):');
Object.entries(byVessel)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 30)
  .forEach(([k, v]) => {
    const totalH = v.durations.reduce((a, b) => a + b, 0);
    console.log(`  ${v.count} events, ${v.positions.size} unique pos, ${totalH.toFixed(0)}h total: ${k}`);
  });

// Show PAPALOAPAN specifically
console.log('\n--- PAPALOAPAN detail ---');
entries.filter(e => e.vessel?.name === 'PAPALOAPAN').forEach(e => {
  console.log(JSON.stringify({
    id: e.id,
    start: e.start,
    end: e.end,
    pos: e.position,
    hours: e.loitering?.totalTimeHours,
    distKm: e.loitering?.totalDistanceKm,
    speedKn: e.loitering?.averageSpeedKnots,
  }, null, 2));
});

// Show entries with extremely long durations (> 1000 hours)
console.log('\n--- Entries > 1000 hours ---');
const longEntries = entries.filter(e => (e.loitering?.totalTimeHours ?? 0) > 1000);
console.log('Count:', longEntries.length);
longEntries.forEach(e => {
  console.log(`  ${e.vessel?.name ?? '?'} (${e.vessel?.ssvid ?? '?'}): ${e.loitering.totalTimeHours.toFixed(0)}h, start=${e.start?.slice(0,10)}, end=${e.end?.slice(0,10)}, pos=[${e.position.lat},${e.position.lon}]`);
});
