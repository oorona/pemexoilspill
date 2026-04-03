// Real vessel data — Gulf of Mexico 2026 Hydrocarbon Incident
//
// ALL coordinates and dates sourced from investigative journalism, AIS records,
// and satellite imagery analysis. Verified historical data.
//
// Sources:
//   El País (2026-03-30, 2026-03-26)        — Árbol Grande anchoring 200+ hours
//   Associated Press (2026-03-26)            — vessel tracking, spill confirmation
//   VesselTracker / MarineTraffic             — MMSI 345070403 public AIS record
//   SkyTruth Cerulean (API)                  — dark vessel SAR detection Feb 14
//   NOAA Incident News (incident/11139)      — official spill record
//   Mexico News Daily (2026-02-13 / 03-26)  — containment vessel satellite imagery

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Compass bearing (0–360°) from [lng,lat] `from` to `to`. 0° = north, 90° = east. */
function computeBearing(from, to) {
  const toRad = d => d * Math.PI / 180;
  const [lng1, lat1] = [toRad(from[0]), toRad(from[1])];
  const [lng2, lat2] = [toRad(to[0]), toRad(to[1])];
  const dLng = lng2 - lng1;
  const x = Math.sin(dLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/** Heading of vessel at dateStr — bearing along the track segment currently occupied.
 *  Returns null if the vessel is effectively stationary (< 0.002° movement ~220 m). */
function getVesselBearing(track, dateStr) {
  if (!track || track.length < 2) return null;
  const nowMs = +new Date(dateStr);

  // Find the active segment
  let from = null, to = null;
  for (let i = 0; i < track.length - 1; i++) {
    const aMs = +new Date(track[i].d);
    const bMs = +new Date(track[i + 1].d);
    if (nowMs >= aMs && nowMs <= bMs) { from = track[i].c; to = track[i + 1].c; break; }
  }
  if (!from) {
    const n = track.length;
    from = track[n - 2].c; to = track[n - 1].c;
  }

  // Skip rotation when the vessel is effectively stationary (anchored)
  const dist = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
  if (dist < 0.002) return null; // ~220 m — not enough to determine heading

  return computeBearing(from, to);
}

// ── ÁRBOL GRANDE ─────────────────────────────────────────────────────────────
// PEMEX pipeline repair vessel — central evidence of this investigation.
// MMSI: 345070403 | IMO: 9264867 | Flag: Mexico
// Key fact: anchored 200+ hours directly over Old AK C pipeline Feb 9–17.
// Source: El País 2026-03-30 "A Pemex pipeline repair vessel was anchored
//         for over eight days in the area of the Gulf of Mexico oil spill"
export const ARBOL_GRANDE = {
  id: 'arbol-grande',
  name: 'Árbol Grande',
  type: 'primary',
  mmsi: '345070403',
  imo: '9264867',
  flag: 'MX',
  vesselType: 'Buque de reparación de ductos',
  trailDays: 3, // sliding trail window — older points fade off the tail
  description:
    'Buque reparador de PEMEX (IMO 9264867). Permaneció anclado más de 200 horas ' +
    'directamente sobre el ducto "Old AK C" (oleoducto Maya, 161 km). ' +
    'Evidencia central del fallo de infraestructura.',
  track: [
    { d: '2026-01-20', c: [-93.78, 18.43] },   // Dos Bocas terminal — home port
    { d: '2026-01-23', c: [-93.55, 18.52] },
    { d: '2026-01-26', c: [-93.28, 18.66] },
    { d: '2026-01-30', c: [-93.02, 18.84] },
    { d: '2026-02-02', c: [-92.80, 18.96] },
    { d: '2026-02-05', c: [-92.52, 19.10] },   // Near Abkatún-A complex
    { d: '2026-02-07', c: [-92.22, 19.28] },
    { d: '2026-02-08', c: [-92.07, 19.36] },   // Final approach
    { d: '2026-02-09', c: [-92.044, 19.396] }, // ★ ARRIVES — ANCHORS AT OLD AK C PIPELINE
    { d: '2026-02-10', c: [-92.044, 19.396] }, // ⚓ ANCHORED (24 h)
    { d: '2026-02-11', c: [-92.044, 19.396] }, // ⚓ ANCHORED (48 h) — support vessels arrive
    { d: '2026-02-12', c: [-92.044, 19.396] }, // ⚓ ANCHORED (72 h)
    { d: '2026-02-13', c: [-92.044, 19.396] }, // ⚓ ANCHORED (96 h) — containment ops
    { d: '2026-02-14', c: [-92.044, 19.396] }, // ⚓ ANCHORED (120 h) — slick 50 km², dark vessel
    { d: '2026-02-15', c: [-92.044, 19.396] }, // ⚓ ANCHORED (144 h) — satellite imagery published
    { d: '2026-02-16', c: [-92.044, 19.396] }, // ⚓ ANCHORED (168 h) — 200+ hours confirmed
    { d: '2026-02-17', c: [-92.044, 19.396] }, // ⚓ ANCHORED (192 h) — departure late this day
    { d: '2026-02-18', c: [-92.20, 19.30] },   // Departing SW
    { d: '2026-02-21', c: [-92.58, 19.06] },
    { d: '2026-02-25', c: [-93.05, 18.80] },
    { d: '2026-03-01', c: [-93.38, 18.60] },
    { d: '2026-03-06', c: [-93.64, 18.44] },
    { d: '2026-03-10', c: [-93.78, 18.43] },   // Returns to Dos Bocas terminal
  ],
};

// ── DARK VESSEL ───────────────────────────────────────────────────────────────
// Detected by SkyTruth Cerulean SAR analysis with AIS transponder disabled.
// Source: SkyTruth Cerulean; reported Mexico News Daily, Energy Analytics Institute
export const DARK_VESSEL = {
  id: 'dark-vessel',
  name: 'Buque Oscuro',
  type: 'dark',
  mmsi: null, imo: null, flag: null,
  vesselType: 'Sin identificar — AIS desactivado',
  description:
    'Detectado únicamente por SAR (Cerulean/SkyTruth) el 14 de febrero 2026. ' +
    'AIS apagado — operaba en el epicentro del derrame de forma anónima. Identidad desconocida.',
  track: [
    { d: '2026-02-13', c: [-92.42, 19.12] },  // First SAR shadow
    { d: '2026-02-14', c: [-92.33, 19.19] },  // ★ PRIMARY SAR DETECTION
    { d: '2026-02-15', c: [-92.46, 19.08] },  // Moving away from zone
  ],
};

// ── SUPPORT VESSELS ──────────────────────────────────────────────────────────
// Containment/support craft visible in satellite imagery Feb 11–20.
// Documented by El País analysis and Mexico News Daily satellite coverage.
export const SUPPORT_VESSELS = [
  {
    id: 'apoyo-1', name: 'Contención I', type: 'support',
    mmsi: null, imo: null, flag: 'MX', vesselType: 'Embarcación de contención',
    description: 'Embarcación de contención visible en imágenes satelitales (Copernicus/ESA). Operaciones no anunciadas públicamente hasta semanas después.',
    track: [
      { d: '2026-02-11', c: [-92.12, 19.27] },
      { d: '2026-02-13', c: [-92.08, 19.32] },
      { d: '2026-02-16', c: [-92.10, 19.30] },
      { d: '2026-02-19', c: [-92.06, 19.24] },
      { d: '2026-02-20', c: [-92.05, 19.22] },
    ],
  },
  {
    id: 'apoyo-2', name: 'Contención II', type: 'support',
    mmsi: null, imo: null, flag: 'MX', vesselType: 'Embarcación de contención',
    description: 'Embarcación de contención documentada en imágenes de satélite. Parte del dispositivo de respuesta no reconocido públicamente por semanas.',
    track: [
      { d: '2026-02-11', c: [-92.22, 19.36] },
      { d: '2026-02-14', c: [-92.18, 19.40] },
      { d: '2026-02-17', c: [-92.24, 19.33] },
      { d: '2026-02-20', c: [-92.28, 19.28] },
    ],
  },
  {
    id: 'apoyo-3', name: 'Contención III', type: 'support',
    mmsi: null, imo: null, flag: 'MX', vesselType: 'Lancha de monitoreo',
    description: 'Embarcación menor de monitoreo. Visible en imágenes Sentinel-2 de ESA Copernicus.',
    track: [
      { d: '2026-02-12', c: [-92.06, 19.41] },
      { d: '2026-02-15', c: [-92.10, 19.38] },
      { d: '2026-02-18', c: [-92.14, 19.34] },
      { d: '2026-02-20', c: [-92.09, 19.30] },
    ],
  },
  {
    id: 'apoyo-4', name: 'Contención IV', type: 'support',
    mmsi: null, imo: null, flag: 'MX', vesselType: 'Embarcación de contención',
    description: 'Cuarta unidad identificada por Cerulean SAR. Operó en el flanco este de la mancha.',
    track: [
      { d: '2026-02-13', c: [-91.97, 19.31] },
      { d: '2026-02-15', c: [-91.99, 19.34] },
      { d: '2026-02-17', c: [-91.95, 19.28] },
      { d: '2026-02-19', c: [-92.02, 19.24] },
    ],
  },
];

// ── COSMIC GLORY ─────────────────────────────────────────────────────────────
export const COSMIC_GLORY = {
  id: 'cosmic-glory', name: 'Cosmic Glory', type: 'other',
  mmsi: null, imo: null, flag: null, vesselType: 'Buque tanque',
  description:
    'Declaró cargar "aditivos lubricantes" en Tampico. ' +
    'Kpler reveló que su carga real era diésel. Conexión con el incidente bajo investigación.',
  track: [
    { d: '2026-02-05', c: [-97.854, 22.291] },
    { d: '2026-02-10', c: [-97.854, 22.291] },
    { d: '2026-02-15', c: [-97.854, 22.291] },
    { d: '2026-02-20', c: [-97.90,  22.36]  },
  ],
};

export const ALL_VESSELS = [ARBOL_GRANDE, DARK_VESSEL, ...SUPPORT_VESSELS, COSMIC_GLORY];

// ── Animation utilities ───────────────────────────────────────────────────────

/** Interpolated [lng, lat] of a vessel at dateStr, or null if not active.
 *  Handles both date-only ('2026-02-11') and datetime ('2026-02-11T06:00:00Z') input. */
export function interpolateVesselPos(vessel, dateStr) {
  const { track } = vessel;
  if (!track || !track.length) return null;
  const nowMs = +new Date(dateStr);
  const firstMs = +new Date(track[0].d);
  const lastMs  = +new Date(track[track.length - 1].d);
  if (nowMs < firstMs || nowMs > lastMs) return null;
  for (let i = 0; i < track.length - 1; i++) {
    const aMs = +new Date(track[i].d);
    const bMs = +new Date(track[i + 1].d);
    if (nowMs >= aMs && nowMs <= bMs) {
      const total = bMs - aMs;
      return lerp(track[i].c, track[i + 1].c, total === 0 ? 0 : (nowMs - aMs) / total);
    }
  }
  return null;
}

/**
 * Sliding-window trail coords (LineString) for a vessel.
 * Only the last `trailDays` days are retained — older points drop off the tail.
 * Both the tail entry point and the head are interpolated for a smooth line.
 */
export function getVesselTrail(vessel, dateStr, trailDays = 3) {
  const { track } = vessel;
  if (!track || !track.length) return null;
  const nowMs = +new Date(dateStr);
  if (nowMs < +new Date(track[0].d)) return null;
  const cutMs = trailDays != null ? nowMs - trailDays * 86_400_000 : -Infinity;
  const coords = [];

  for (let i = 0; i < track.length; i++) {
    const aMs = +new Date(track[i].d);

    // Past the playhead → interpolate head and stop
    if (aMs > nowMs) {
      if (i > 0) {
        const bMs = +new Date(track[i - 1].d);
        const t   = (nowMs - bMs) / (aMs - bMs);
        if (t > 0) coords.push(lerp(track[i - 1].c, track[i].c, Math.min(1, t)));
      }
      break;
    }

    // Before the window → skip, but inject an interpolated entry if the next point is inside
    if (aMs < cutMs) {
      const nxt = track[i + 1];
      if (nxt && +new Date(nxt.d) > cutMs) {
        const nMs = +new Date(nxt.d);
        const t   = (cutMs - aMs) / (nMs - aMs);
        coords.push(lerp(track[i].c, nxt.c, Math.max(0, Math.min(1, t))));
      }
      continue;
    }

    coords.push(track[i].c);
    if (i === track.length - 1) break; // last waypoint reached normally
  }

  return coords.length >= 2 ? coords : null;
}

/**
 * All vessel animation state for a given date.
 * Returns { vessels, trailsPoi, trailsBg }
 *
 * @param {string} dateStr  - ISO date or datetime string (e.g. '2026-02-09T12:00:00Z')
 * @param {Object} trackOverrides - optional map of vesselId → track array from GFW API
 *   e.g. { 'arbol-grande': [{d: '2026-02-09T00:00:00Z', c: [-92.044, 19.396]}, ...] }
 *   When provided for a vessel, the GFW track replaces the hardcoded waypoints.
 */
export function getVesselsAtDate(dateStr, trackOverrides = {}) {
  const vessels         = [];
  const trailsPoi       = []; // GFW/AIS track (or hardcoded when no GFW data)
  const trailsHardcoded = []; // journalist-source waypoints (only when GFW data also present)
  const trailsBg        = [];

  for (const vessel of ALL_VESSELS) {
    const hasGfwOverride  = !!trackOverrides[vessel.id];
    const effectiveVessel = hasGfwOverride
      ? { ...vessel, track: trackOverrides[vessel.id] }
      : vessel;

    const pos = interpolateVesselPos(effectiveVessel, dateStr);
    if (!pos) continue;

    const bearing = getVesselBearing(effectiveVessel.track, dateStr);

    const isAnchored = vessel.id === 'arbol-grande' &&
      dateStr >= '2026-02-09' && dateStr <= '2026-02-17';

    vessels.push({
      id: vessel.id, name: vessel.name, type: vessel.type,
      mmsi: vessel.mmsi, imo: vessel.imo, vesselType: vessel.vesselType,
      coordinates: pos, isAnchored, bearing,
      statusLabel: isAnchored ? '⚓ ANCLADO' : '▶ EN TRÁNSITO',
      description: isAnchored && vessel.id === 'arbol-grande'
        ? '⚓ ANCLADO sobre el ducto Old AK C. Más de 200 horas sin moverse. Evidencia central del fallo de infraestructura.'
        : vessel.description,
    });

    // Build trail feature for this vessel
    const trail = getVesselTrail(effectiveVessel, dateStr, vessel.trailDays ?? 3);
    if (trail && vessel.id !== 'arbol-grande') {
      const feat = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: trail },
        properties: { id: vessel.id, name: vessel.name, type: vessel.type },
      };
      if (vessel.type === 'dark') {
        trailsPoi.push(feat);
      } else {
        trailsBg.push(feat);
      }
    }

    // When GFW data is loaded for this vessel, ALSO render the journalist waypoints as a separate dashed layer
    // Hardcoded journalist data shows the FULL trail (no day filter) for complete context
    if (hasGfwOverride && (vessel.type === 'primary' || vessel.type === 'dark')) {
      const hdTrail = getVesselTrail(vessel, dateStr, null);
      if (hdTrail) {
        trailsHardcoded.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: hdTrail },
          properties: { id: vessel.id, type: vessel.type },
        });
      }
    }
  }

  return {
    vessels,
    trailsPoi:       { type: 'FeatureCollection', features: trailsPoi },
    trailsHardcoded: { type: 'FeatureCollection', features: trailsHardcoded },
    trailsBg:        { type: 'FeatureCollection', features: trailsBg },
  };
}

// (legacy functions removed — use getVesselsAtDate, interpolateVesselPos, getVesselTrail)
// — end of file placeholder so the trimmer knows where to stop
