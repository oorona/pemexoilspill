#!/usr/bin/env node
// Quick analysis of loitering data — vessel counts and structure
const fs = require('fs');
const path = require('path');

const loiteringPath = path.join(__dirname, '..', 'public', 'data', 'gfw', 'loitering-events.json');
const data = JSON.parse(fs.readFileSync(loiteringPath, 'utf8'));

console.log('Total events:', data.length);
if (data.length === 0) { console.log('No data'); process.exit(0); }
console.log('Sample event keys:', Object.keys(data[0]).join(', '));
console.log('Sample event (first 600 chars):', JSON.stringify(data[0], null, 2).slice(0, 600));

// Unique vessels
const vesselMap = {};
for (const e of data) {
  const ssvid = e.vessel?.ssvid || e.ssvid || 'unknown';
  if (!vesselMap[ssvid]) vesselMap[ssvid] = { name: e.vessel?.name || e._vesselName || ssvid, events: 0, pemex: false };
  vesselMap[ssvid].events++;
  if (e._pemex) vesselMap[ssvid].pemex = true;
}

const allVessels = Object.keys(vesselMap);
const pemexVessels = allVessels.filter(v => vesselMap[v].pemex);
const otherVessels = allVessels.filter(v => !vesselMap[v].pemex);

console.log('\n--- VESSEL SUMMARY ---');
console.log('Total unique vessels:', allVessels.length);
console.log('PEMEX-tagged vessels:', pemexVessels.length);
console.log('Other vessels:', otherVessels.length);

console.log('\nPEMEX vessels:');
pemexVessels.forEach(v => console.log(`  ${v} — ${vesselMap[v].name} (${vesselMap[v].events} events)`));

console.log('\nOther vessels (first 30):');
otherVessels.slice(0, 30).forEach(v => console.log(`  ${v} — ${vesselMap[v].name} (${vesselMap[v].events} events)`));
if (otherVessels.length > 30) console.log(`  ... and ${otherVessels.length - 30} more`);
