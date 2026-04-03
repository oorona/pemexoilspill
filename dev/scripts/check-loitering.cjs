const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'data', 'gfw');

for (const fname of ['loitering-events.json', 'loitering-events-raw.json']) {
  const fp = path.join(dir, fname);
  if (!fs.existsSync(fp)) { console.log(fname, '— NOT FOUND'); continue; }
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const entries = d.entries || [];
  const total = d.total || entries.length;

  const hasPemex = entries.some(e => '_pemex' in e);
  const hasSynthetic = entries.some(e => '_synthetic' in e);

  const starts = entries.map(e => e.start.slice(0, 10)).sort();
  const pre2026 = entries.filter(e => e.start < '2026-02-01').length;

  console.log(`\n=== ${fname} ===`);
  console.log(`  Total: ${total}`);
  console.log(`  Has _pemex: ${hasPemex}`);
  console.log(`  Has _synthetic: ${hasSynthetic}`);
  console.log(`  Earliest start: ${starts[0]}`);
  console.log(`  Latest start: ${starts[starts.length - 1]}`);
  console.log(`  Before 2026-02-01: ${pre2026}`);
  console.log(`  From 2026-02-01+: ${total - pre2026}`);
  if (d.startDate) console.log(`  Meta startDate: ${d.startDate}`);
  if (d.endDate) console.log(`  Meta endDate: ${d.endDate}`);
  if (d.note) console.log(`  Note: ${d.note}`);
}
