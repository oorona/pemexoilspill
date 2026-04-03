#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'gfw');
const src = path.join(DATA_DIR, 'loitering-events.json');
const dst = path.join(DATA_DIR, 'other-loitering.json');

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const other = data.entries.filter(function(e) { return !e._pemex; });

const out = {
  total: other.length,
  startDate: data.startDate,
  endDate: data.endDate,
  processedAt: new Date().toISOString(),
  note: 'All loitering events EXCLUDING PEMEX-related vessels.',
  entries: other,
};

fs.writeFileSync(dst, JSON.stringify(out));
console.log('Created other-loitering.json:', other.length, 'events');
console.log('Excluded', data.entries.length - other.length, 'PEMEX events');
