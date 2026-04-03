#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const KEY = fs.readFileSync(path.join(__dirname, '..', 'secrets', 'gfw_api_key.txt'), 'utf8').trim();
const BASE = 'https://gateway.api.globalfishingwatch.org/v3';
const HDR  = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const VESSELID = 'fb2bd204f-f62b-42db-45f4-dd335f3c783c';

async function get(url) {
  const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(15000) });
  const t = await r.text();
  console.log(`\nGET ${url}\n→ ${r.status}\n${t.slice(0, 600)}`);
  return r.ok ? JSON.parse(t) : null;
}
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: HDR, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const t = await r.text();
  console.log(`\nPOST ${url}\nbody: ${JSON.stringify(body).slice(0, 300)}\n→ ${r.status}\n${t.slice(0, 600)}`);
  return r.ok ? JSON.parse(t) : null;
}

const AOI = { type: 'Polygon', coordinates: [[[-98.5,17.5],[-90.5,17.5],[-90.5,23.0],[-98.5,23.0],[-98.5,17.5]]] };

async function main() {
  // 1. Events for Árbol Grande vessel ID directly
  console.log('\n=== 1. Loitering events for specific vessel ===');
  await post(`${BASE}/events?offset=0&limit=5`, {
    datasets: ['public-global-loitering-events:latest'],
    startDate: '2026-01-20',
    endDate: '2026-03-31',
    vessels: [VESSELID],
  });

  // 2. Port visits for specific vessel
  console.log('\n=== 2. Port visits for specific vessel ===');
  await post(`${BASE}/events?offset=0&limit=5`, {
    datasets: ['public-global-port-visits-events:latest'],
    startDate: '2026-01-20',
    endDate: '2026-03-31',
    vessels: [VESSELID],
    confidences: ['3', '4'],
  });

  // 3. Encounters for specific vessel
  console.log('\n=== 3. Encounters for specific vessel ===');
  await post(`${BASE}/events?offset=0&limit=5`, {
    datasets: ['public-global-encounters-events:latest'],
    startDate: '2026-01-20',
    endDate: '2026-03-31',
    vessels: [VESSELID],
  });

  // 4. Vessel detail — correct query format (single dataset string)
  console.log('\n=== 4. Vessel detail (single dataset param) ===');
  const r = await fetch(`${BASE}/vessels/${VESSELID}?dataset=public-global-vessel-identity:latest`, { headers: HDR, signal: AbortSignal.timeout(10000) });
  const t = await r.text();
  console.log(`→ ${r.status}: ${t.slice(0, 400)}`);
}

main().catch(console.error);
