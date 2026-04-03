#!/usr/bin/env node
const d = require('../public/data/gfw/pemex-loitering.json');
console.log('Total events:', d.total);

const byV = {};
d.entries.forEach(function(e) {
  const k = e.vessel && e.vessel.ssvid || '?';
  if (!byV[k]) byV[k] = { name: e.vessel && e.vessel.name, count: 0, dates: [] };
  byV[k].count++;
  byV[k].dates.push(e.start && e.start.slice(0,10));
});

const sorted = Object.entries(byV).sort(function(a,b) { return b[1].count - a[1].count; });
console.log('\nTop 10 PEMEX vessels by event count:');
sorted.slice(0,10).forEach(function(pair) {
  const k = pair[0], v = pair[1];
  const uniqueDays = [...new Set(v.dates)].sort();
  console.log(k, v.name, v.count, 'events,', uniqueDays.length, 'unique days, range:', uniqueDays[0], '-', uniqueDays[uniqueDays.length-1]);
});

// Sample one event to see position structure
console.log('\nSample event:');
const sample = d.entries[0];
console.log(JSON.stringify({ start: sample.start, end: sample.end, position: sample.position, vessel: sample.vessel && sample.vessel.ssvid }, null, 2));
