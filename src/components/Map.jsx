import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { INFRASTRUCTURE, EVENTS } from '../data/events.js';
import ChronologyPanel from './ChronologyPanel.jsx';
import styles from './Map.module.css';

// ── Map constants ─────────────────────────────────────────────────────────────
const CENTER = [-92.45, 19.03];
const ZOOM   = 7.5;
const MIN_ZOOM = 6.2; // allow zoom out to the original wide view
const INITIAL_BOUNDS = [[-94.3092, 18.0111], [-90.5857, 20.0533]];

// ── Satellite tile sources — all free, no API key ─────────────────────────────
// ESRI World Imagery: high-res base, no key, global coverage
const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// NASA GIBS WMTS — MODIS Terra True Color, 250 m/px, daily global, no key.
// Date param format: YYYY-MM-DD injected per-request when the layer is active.
// Endpoint: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/
// Layer used: MODIS_Terra_CorrectedReflectance_TrueColor
const GIBS_LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
function gibsTileUrl(dateStr) {
  // GIBS WMTS REST endpoint — EPSG:3857 (Web Mercator), PNG, 256px tiles
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${dateStr}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`;
}

// EOX Sentinel-2 cloudless 2023 mosaic — no key, great natural colour at zoom 6–12
const EOX_S2 = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg';

// MapLibre glyph server (maintained by MapLibre)
const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

function buildMapStyle(dateStr) {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      // Layer 0: ESRI high-res (always-on base)
      satellite: {
        type: 'raster',
        tiles: [ESRI_SAT],
        tileSize: 256,
        attribution:
          'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, AEX, GeoEye',
        maxzoom: 19,
      },
      // Layer 1: EOX Sentinel-2 cloudless mosaic (no key, good natural colour)
      'eox-s2': {
        type: 'raster',
        tiles: [EOX_S2],
        tileSize: 256,
        attribution: '&copy; <a href="https://s2maps.eu">Sentinel-2 cloudless by EOX IT Services GmbH</a>',
        maxzoom: 14,
      },
      // Layer 2: NASA GIBS MODIS Terra — updated daily, initial URL set at build time
      'gibs-modis': {
        type: 'raster',
        tiles: [gibsTileUrl(dateStr)],
        tileSize: 256,
        attribution: 'Imagery courtesy NASA GIBS/Worldview',
        maxzoom: 9,
      },
      // Layer 3: Copernicus Sentinel-1 SAR (radar — sees through clouds, detects oil slicks)
      'copernicus-s1': {
        type: 'raster',
        tiles: [`/api/copernicus?z={z}&x={x}&y={y}&date=${dateStr}&layer=s1-sar`],
        tileSize: 512,
        attribution: '© Copernicus Data Space / ESA — Sentinel-1 GRD',
        minzoom: 5,
        maxzoom: 11,
      },
      // Layer 4: Copernicus Sentinel-2 true-colour optical
      'copernicus-s2': {
        type: 'raster',
        tiles: [`/api/copernicus?z={z}&x={x}&y={y}&date=${dateStr}&layer=s2-rgb`],
        tileSize: 512,
        attribution: '© Copernicus Data Space / ESA — Sentinel-2 L2A',
        minzoom: 5,
        maxzoom: 11,
      },
      // Layer 5: OpenWeatherMap wind overlay (requires owm_api_key secret)
      'wind-owm': {
        type: 'raster',
        tiles: ['/api/weather/wind?z={z}&x={x}&y={y}'],
        tileSize: 256,
        attribution: '&copy; <a href="https://openweathermap.org" target="_blank" rel="noopener">OpenWeatherMap</a>',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#04080f' } },
      // ESRI base always visible
      { id: 'satellite', type: 'raster', source: 'satellite',
        paint: { 'raster-opacity': 0.9, 'raster-saturation': -0.1, 'raster-brightness-min': 0.05 } },
      // EOX S2 mosaic (hidden — kept for potential future use)
      { id: 'eox-s2-layer', type: 'raster', source: 'eox-s2',
        paint: { 'raster-opacity': 0.0 },
        layout: { visibility: 'none' } },
      // MODIS daily (hidden)
      { id: 'gibs-modis-layer', type: 'raster', source: 'gibs-modis',
        paint: { 'raster-opacity': 0.0 },
        layout: { visibility: 'none' } },
      // Copernicus SAR overlay (hidden until user switches to SAR mode)
      { id: 'copernicus-s1-layer', type: 'raster', source: 'copernicus-s1',
        paint: { 'raster-opacity': 0.85 },
        layout: { visibility: 'none' } },
      // Copernicus optical overlay (hidden until user switches to optical mode)
      { id: 'copernicus-s2-layer', type: 'raster', source: 'copernicus-s2',
        paint: { 'raster-opacity': 0.85 },
        layout: { visibility: 'none' } },
      // Wind overlay (hidden by default — requires owm_api_key)
      { id: 'wind-layer', type: 'raster', source: 'wind-owm',
        paint: { 'raster-opacity': 0.6 },
        layout: { visibility: 'none' } },
    ],
  };
}

// ── GIS Layer registry ────────────────────────────────────────────────────────
// Basemap: radio (mutually exclusive satellite imagery base)
const BASEMAP_DEFS = [
  { id: 'esri',          label: 'Satélite alta resolución',  icon: '🛰',  mapIds: ['satellite'],
    tip: 'Imagen satelital de alta resolución (ESRI). Base predeterminada con cobertura global detallada.' },
  { id: 'copernicus-s1', label: 'Radar SAR (Sentinel-1)',    icon: '📡', mapIds: ['copernicus-s1-layer'],
    tip: 'Imagen de radar Sentinel-1 (SAR). Ve a través de nubes y detecta manchas de hidrocarburos en el mar.' },
  { id: 'copernicus-s2', label: 'Óptico natural (Sentinel-2)', icon: '🌍', mapIds: ['copernicus-s2-layer'],
    tip: 'Imagen óptica Sentinel-2 con colores naturales. Útil para verificar visualmente manchas y costa.' },
  { id: 'gibs-modis',    label: 'NASA diario (MODIS)',       icon: '🌐', mapIds: ['gibs-modis-layer'],
    tip: 'Mosaico diario NASA MODIS Terra. Muestra condiciones atmosféricas y de superficie del día seleccionado.' },
];

// Overlays: independent checkboxes
// Swatch colors must match the dominant paint color of the corresponding map layers
// `dynamic` flag indicates layers that update during timeline replay
const OVERLAY_DEFS = [
  { id: 'cerulean',        label: 'Manchas de petróleo (SAR)',             color: '#f0b429', mapIds: ['cerulean-fill', 'cerulean-line'],                                              defaultOn: true,  dynamic: true,
    tip: 'Detecciones reales de manchas de hidrocarburos por radar satelital (SkyTruth/Cerulean). Clic en una mancha para ver detalles de la detección.' },
  { id: 'infra',           label: 'Plataformas y terminales',             color: '#4cc9f0', mapIds: ['infra-circle', 'infra-label'],                                                 defaultOn: true,  dynamic: false,
    tip: 'Ubicaciones de plataformas petroleras, terminales marítimas y puntos de infraestructura clave de PEMEX en el Golfo.' },
  { id: 'pipelines',       label: 'Ductos submarinos',                    color: '#39ff7f', mapIds: ['pemex-pipelines-case', 'pemex-pipelines-line', 'pemex-pipelines-label'],       defaultOn: true,  dynamic: false,
    tip: 'Trazado aproximado de oleoductos y gasoductos submarinos de PEMEX. El ducto Old AK-C se marca en rojo (sitio del incidente). Clic para ver detalles.' },
  { id: 'boundaries',      label: 'Fronteras y estados',                  color: '#b4d2ff', mapIds: ['countries-line', 'states-line'],                                              defaultOn: true,  dynamic: false,
    tip: 'Líneas de fronteras internacionales y divisiones estatales de México y EE.UU. para referencia geográfica.' },
  { id: 'other-vessels',   label: 'Todos los buques (no PEMEX)',            color: '#43aa8b', mapIds: ['other-vessels-arrow', 'other-vessels-label'],  defaultOn: false, dynamic: true,
    tip: 'Todos los buques en el área (excluyendo flota PEMEX). Animados con trayectoria y dirección. Desactivado por defecto.' },
  { id: 'pemex-vessels',   label: 'Flota PEMEX',                          color: '#4895ef', mapIds: ['pemex-arrow', 'pemex-loitering-label'],    defaultOn: true,  dynamic: true,
    tip: 'Eventos de merodeo de buques de la flota PEMEX (24 buques identificados). Flechas azules muestran dirección de movimiento.' },
  { id: 'dark-vessels',    label: 'Buques oscuros (AIS apagado)',          color: '#ff006e', mapIds: ['dark-vessels-arrow', 'dark-vessels-label'], defaultOn: true,  dynamic: true,
    tip: 'Buques que apagaron su transpondedor AIS en el área de interés. Señal de actividad sospechosa o evasión de monitoreo.' },
  { id: 'arbol-grande',    label: 'Árbol Grande',                         color: '#e63946', mapIds: ['arbol-grande-aura', 'arbol-grande-arrow', 'arbol-grande-label'],              defaultOn: true,  dynamic: true,
    tip: 'Buque reparador de ductos de PEMEX (IMO 9264867, MMSI 345070403). Estuvo anclado más de 200 horas sobre el ducto Old AK-C durante el derrame.' },
  { id: 'events',          label: 'Cronología del derrame',               color: '#e63946', mapIds: ['event-labels-circle', 'event-labels-text'],                                    defaultOn: true,  dynamic: true,
    tip: 'Marcadores que señalan fechas y lugares clave del incidente (derrames, acciones de contención, reportes oficiales). Aparecen según avanza la línea de tiempo.' },
  { id: 'mpa',             label: 'Áreas marinas protegidas',             color: '#00c896', mapIds: ['mpa-fill', 'mpa-line', 'mpa-label'],                                          defaultOn: true,  dynamic: false,
    tip: 'Zonas de protección ambiental marina (WDPA). Permite evaluar el impacto potencial del derrame sobre ecosistemas protegidos. Clic para ver nombre.' },
];

const DEFAULT_OVERLAY_STATE = Object.fromEntries(OVERLAY_DEFS.map(d => [d.id, d.defaultOn]));

// Árbol Grande timeline cache (built once from static GFW track data)
// Árbol Grande timeline is stored in module-level arbolGrandeTimeline variable

// ── Layer initializers ────────────────────────────────────────────────────────

function initLayers(map) {
  // ── Register arrow images for vessel layers ──
  const arrowSize = 24;
  const _makeArrow = (fillColor, strokeColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = arrowSize; canvas.height = arrowSize;
    const ctx = canvas.getContext('2d');
    // Draw an upward-pointing arrowhead (triangle)
    ctx.beginPath();
    ctx.moveTo(arrowSize / 2, 2);                             // top center
    ctx.lineTo(arrowSize - 3, arrowSize - 3);                 // bottom right
    ctx.lineTo(arrowSize / 2, arrowSize * 0.65);              // notch
    ctx.lineTo(3, arrowSize - 3);                             // bottom left
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    return { width: arrowSize, height: arrowSize, data: ctx.getImageData(0, 0, arrowSize, arrowSize).data };
  };
  map.addImage('arrow-pemex',  _makeArrow('#4895ef', '#2070cc'));
  map.addImage('arrow-other',  _makeArrow('#43aa8b', '#2a7a63'));
  map.addImage('arrow-dark',   _makeArrow('#ff006e', '#cc0058'));
  map.addImage('arrow-arbol',  _makeArrow('#e63946', '#b02030'));
  map.addImage('arrow-arbol-aura', _makeArrow('#ffffff', '#e63946'));

  // ─ Cerulean real SAR oil detection polygons (visible by default) ─
  map.addSource('cerulean-slicks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'cerulean-fill', type: 'fill', source: 'cerulean-slicks',
    paint: { 'fill-color': '#f0b429', 'fill-opacity': 0.35 },
  });
  map.addLayer({
    id: 'cerulean-line', type: 'line', source: 'cerulean-slicks',
    paint: { 'line-color': '#f0b429', 'line-width': 2.0, 'line-opacity': 1.0, 'line-dasharray': [2, 1] },
  });

  // ─ Geopolitical outline (countries / states from Natural Earth) ─
  map.addSource('geo-countries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'countries-line', type: 'line', source: 'geo-countries',
    paint: { 'line-color': 'rgba(180,210,255,0.40)', 'line-width': 1.4 } });

  map.addSource('geo-states', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'states-line', type: 'line', source: 'geo-states',
    paint: { 'line-color': 'rgba(180,210,255,0.22)', 'line-width': 0.7,
              'line-dasharray': [4, 4] } });

  // ─ PEMEX pipeline infrastructure (approximate routes from public record) ─
  map.addSource('pemex-pipelines', { type: 'geojson', data: '/data/pemex_pipelines.geojson' });
  map.addLayer({
    id: 'pemex-pipelines-case', type: 'line', source: 'pemex-pipelines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#39ff7f', 'line-width': 4, 'line-opacity': 0.3 },
  });
  map.addLayer({
    id: 'pemex-pipelines-line', type: 'line', source: 'pemex-pipelines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['==', ['get', 'id'], 'old-ak-c'], '#ff4444', '#39ff7f'],
      'line-width': ['case', ['==', ['get', 'id'], 'old-ak-c'], 3.5, 2.5],
      'line-opacity': 1.0,
      'line-dasharray': ['case', ['==', ['get', 'id'], 'old-ak-c'], ['literal', [1, 0]], ['literal', [10, 2]]],
    },
  });
  map.addLayer({
    id: 'pemex-pipelines-label', type: 'symbol', source: 'pemex-pipelines',
    minzoom: 7,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 9,
      'symbol-placement': 'line',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-offset': [0, -1],
    },
    paint: { 'text-color': '#39ff7f', 'text-halo-color': '#04080f', 'text-halo-width': 1.5 },
  });

  // ─ Infrastructure POIs ─
  map.addSource('infra', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: INFRASTRUCTURE.map(poi => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: poi.coordinates },
        properties: { id: poi.id, name: poi.nameShort, type: poi.type },
      })),
    },
  });
  map.addLayer({
    id: 'infra-circle', type: 'circle', source: 'infra',
    paint: {
      'circle-radius': ['match', ['get', 'type'], 'impact', 7, 6],
      'circle-color': ['match', ['get', 'type'],
        'terminal', '#4cc9f0', 'impact', '#e63946', '#8080ff'],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.5)',
      'circle-opacity': 0.85,
    },
  });
  map.addLayer({
    id: 'infra-label', type: 'symbol', source: 'infra',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
    },
    paint: { 'text-color': '#aac8ff', 'text-halo-color': '#04080f', 'text-halo-width': 2 },
  });

  // ─ Event date labels (shown on event dates) ─
  map.addSource('event-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'event-labels-circle', type: 'circle', source: 'event-labels',
    paint: {
      'circle-radius': 14,
      'circle-color': '#e63946',
      'circle-opacity': 0.18,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#e63946',
    },
  });
  map.addLayer({
    id: 'event-labels-text', type: 'symbol', source: 'event-labels',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-max-width': 14,
    },
    paint: { 'text-color': '#ff8080', 'text-halo-color': '#04080f', 'text-halo-width': 2 },
  });

  // ─ Non-PEMEX vessels (animated arrows, disabled by default) ─
  const emptyFC = { type: 'FeatureCollection', features: [] };
  map.addSource('other-vessels', { type: 'geojson', data: emptyFC });
  map.addLayer({
    id: 'other-vessels-arrow', type: 'symbol', source: 'other-vessels',
    layout: {
      visibility: 'none',
      'icon-image': 'arrow-other',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 0.7],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'other-vessels-label', type: 'symbol', source: 'other-vessels',
    minzoom: 8,
    layout: {
      visibility: 'none',
      'text-field': ['coalesce', ['get', 'vesselName'], '?'],
      'text-size': 9,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': '#6dd4a8', 'text-halo-color': '#04080f', 'text-halo-width': 1.5 },
  });

  // ─ PEMEX fleet (arrow symbols) ─
  map.addSource('pemex-loitering', { type: 'geojson', data: emptyFC });
  map.addLayer({
    id: 'pemex-arrow', type: 'symbol', source: 'pemex-loitering',
    layout: {
      'icon-image': 'arrow-pemex',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.8],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'pemex-loitering-label', type: 'symbol', source: 'pemex-loitering',
    minzoom: 7,
    layout: {
      'text-field': ['coalesce', ['get', 'vesselName'], '?'],
      'text-size': 10,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': '#90caf9', 'text-halo-color': '#04080f', 'text-halo-width': 1.5 },
  });

  // ─ Árbol Grande (dedicated vessel — yellow arrow aura + red arrow) ─
  map.addSource('arbol-grande', { type: 'geojson', data: emptyFC });
  map.addLayer({
    id: 'arbol-grande-aura', type: 'symbol', source: 'arbol-grande',
    layout: {
      'icon-image': 'arrow-arbol-aura',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.4],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.8 },
  });
  map.addLayer({
    id: 'arbol-grande-arrow', type: 'symbol', source: 'arbol-grande',
    layout: {
      'icon-image': 'arrow-arbol',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.8],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'arbol-grande-label', type: 'symbol', source: 'arbol-grande',
    minzoom: 7,
    layout: {
      'text-field': ['coalesce', ['get', 'vesselName'], '?'],
      'text-size': 10,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': '#ff8080', 'text-halo-color': '#04080f', 'text-halo-width': 1.5 },
  });

  // ─ Dark vessels (AIS gap/disabling events) ─
  map.addSource('dark-vessels', { type: 'geojson', data: emptyFC });
  map.addLayer({
    id: 'dark-vessels-arrow', type: 'symbol', source: 'dark-vessels',
    layout: {
      'icon-image': 'arrow-dark',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.8],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'dark-vessels-label', type: 'symbol', source: 'dark-vessels',
    minzoom: 7,
    layout: {
      'text-field': ['coalesce', ['get', 'vesselName'], '?'],
      'text-size': 10,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': '#ff4d94', 'text-halo-color': '#04080f', 'text-halo-width': 1.5 },
  });

  // ─ Marine Protected Areas (WDPA via Cerulean public.aoi, type=3) ─
  map.addSource('mpa', { type: 'geojson', data: '/gulf_mpas.geojson' });
  map.addLayer({
    id: 'mpa-fill', type: 'fill', source: 'mpa',
    paint: { 'fill-color': '#00c896', 'fill-opacity': 0.10 },
  });
  map.addLayer({
    id: 'mpa-line', type: 'line', source: 'mpa',
    paint: { 'line-color': '#00c896', 'line-width': 1.4, 'line-opacity': 0.75,
              'line-dasharray': [3, 2] },
  });
  map.addLayer({
    id: 'mpa-label', type: 'symbol', source: 'mpa',
    minzoom: 7,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-anchor': 'center',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-max-width': 10,
    },
    paint: { 'text-color': '#00e8af', 'text-halo-color': '#020d0a', 'text-halo-width': 1.5 },
  });
}

// ── Cerulean real SAR detection fetch ──────────────────────────────────────────
// Fetches all historical oil slick detections from SkyTruth's Cerulean API
// for the Gulf of Mexico AOI (Jan–Mar 2026), stores in module-level cache,
// then filters client-side by slick_timestamp as the user scrubs the timeline.

let ceruleanAll = []; // module-level cache

// ── GFW vessel track fetch ────────────────────────────────────────────────────
// Fetches real AIS track from GFW API for vessels with a known MMSI.
// Result is cached module-level so hot-reload doesn't re-fetch.
// Returns track in vessels.js format: [{d: ISO_string, c: [lng, lat]}]
let _gfwTrackCache = {}; // { vesselId: [{d, c}] }
let gfwLoiteringAll = []; // module-level cache of all AOI loitering events
let pemexLoiteringAll = []; // PEMEX-only loitering events (excluding Árbol Grande)
let otherLoiteringAll = []; // non-PEMEX loitering events
let pemexVesselTimelines = {}; // { ssvid: [{t: epochMs, lon, lat}] } — sorted waypoints per vessel
let otherVesselTimelines = {}; // { ssvid: {name, flag, points: [{t, lon, lat}]} } — all non-PEMEX vessels
let darkVesselTimelines = {}; // { ssvid: {name, flag, points: [{t, lon, lat}]} } — dark vessels (AIS gap)
let arbolGrandeTimeline = null; // { name, flag, points: [{t, lon, lat}] } — single vessel timeline

const ARBOL_GRANDE_SSVID = '345070403';

async function fetchGFWTrack(vesselId, mmsi) {
  if (_gfwTrackCache[vesselId]) return _gfwTrackCache[vesselId];
  // ── Try static pre-downloaded file first ──────────────────────────────────
  try {
    const r = await fetch('/data/gfw/arbol-grande.json');
    if (r.ok) {
      const data = await r.json();
      if (data.track?.length) {
        const track = data.track.map(p => ({ d: p.t, c: [p.lon, p.lat] }));
        console.info(`[GFW] Loaded ${track.length} points from static file (${data.source ?? 'gfw'})`);
        _gfwTrackCache[vesselId] = track;
        return track;
      }
    }
  } catch (_) {}
  // ── Fallback: live API ────────────────────────────────────────────────────
  try {
    const res = await fetch(`/api/gfw/vessel-track?mmsi=${mmsi}&start=2026-01-01&end=2026-03-31`);
    if (!res.ok) {
      console.warn(`[GFW] vessel-track for MMSI ${mmsi} → HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data.track?.length) return null;
    // Convert GFW format {t, lat, lon} → vessels.js format {d, c}
    const track = data.track.map(p => ({ d: p.t, c: [p.lon, p.lat] }));
    console.info(`[GFW] Loaded ${track.length} real AIS points for MMSI ${mmsi} (${data.vesselId})`);
    _gfwTrackCache[vesselId] = track;
    return track;
  } catch (err) {
    console.error('[GFW] vessel-track fetch failed:', err.message);
    return null;
  }
}

// ── GFW loitering events — static file load + date filter ────────────────────

function _loiteringToFeatures(events, day) {
  return events
    .filter(e => e.start?.slice(0, 10) <= day && e.end?.slice(0, 10) >= day)
    .map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.position.lon, e.position.lat] },
      properties: {
        vesselName:   e.vessel?.name ?? null,
        ssvid:        e.vessel?.ssvid ?? null,
        flag:         e.vessel?.flag ?? null,
        hours:        e.loitering?.totalTimeHours ?? null,
        distanceKm:   e.loitering?.averageDistanceFromShoreKm ?? null,
        totalDistKm:  e.loitering?.totalDistanceKm ?? null,
        avgSpeedKn:   e.loitering?.averageSpeedKnots ?? null,
        startDate:    e.start ?? null,
        endDate:      e.end ?? null,
        eventId:      e.id,
      },
    }));
}

// ── Per-vessel timeline building & interpolation ─────────────────────────────

/** Build timelines from pemex-tracks.json track arrays.
 *  Input: { vessels: { [ssvid]: { name, track: [{t, lat, lon}] } } }
 *  Output: { [ssvid]: { name, flag, points: [{t: epochMs, lon, lat}] } } */
function _buildVesselTimelinesFromTracks(tracksData) {
  const byVessel = {};
  const vessels = tracksData?.vessels ?? {};
  for (const [ssvid, info] of Object.entries(vessels)) {
    const points = (info.track ?? []).map(p => ({ t: +new Date(p.t), lon: p.lon, lat: p.lat }));
    points.sort((a, b) => a.t - b.t);
    if (points.length === 0) continue;
    byVessel[ssvid] = { name: info.name ?? null, flag: info.flag ?? null, points };
  }
  return byVessel;
}

function _interpolatePosition(timeline, nowMs) {
  const pts = timeline.points;
  if (!pts.length) return null;
  if (nowMs <= pts[0].t) return null; // before first event
  if (nowMs >= pts[pts.length - 1].t) {
    // After last event — only show if within 12h of the last point
    if (nowMs - pts[pts.length - 1].t > 12 * 3600_000) return null;
    return [pts[pts.length - 1].lon, pts[pts.length - 1].lat];
  }
  // Find surrounding points
  for (let i = 0; i < pts.length - 1; i++) {
    if (nowMs >= pts[i].t && nowMs <= pts[i + 1].t) {
      const span = pts[i + 1].t - pts[i].t;
      if (span === 0) return [pts[i].lon, pts[i].lat];
      const frac = (nowMs - pts[i].t) / span;
      return [
        pts[i].lon + (pts[i + 1].lon - pts[i].lon) * frac,
        pts[i].lat + (pts[i + 1].lat - pts[i].lat) * frac,
      ];
    }
  }
  return null;
}

function _pemexAnimatedPositions(datetime) {
  const nowMs = +new Date(datetime);
  const features = [];
  for (const [ssvid, tl] of Object.entries(pemexVesselTimelines)) {
    const coord = _interpolatePosition(tl, nowMs);
    if (!coord) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: { vesselName: tl.name, ssvid, flag: tl.flag, bearing: _computeBearing(tl, nowMs) },
    });
  }
  return features;
}

const LOOK_BACK_MS = 3_600_000; // 1 hour look-back to compute heading

/** Compute bearing in degrees (0 = north, clockwise) from past to current position */
function _computeBearing(tl, nowMs) {
  const pastMs = nowMs - LOOK_BACK_MS;
  const head = _interpolatePosition(tl, nowMs);
  if (!head) return 0;
  let past = _interpolatePosition(tl, pastMs);
  if (!past) {
    for (let i = tl.points.length - 1; i >= 0; i--) {
      if (tl.points[i].t <= nowMs) { past = [tl.points[i].lon, tl.points[i].lat]; break; }
    }
  }
  if (!past) return 0;
  const dx = head[0] - past[0];
  const dy = head[1] - past[1];
  if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return 0;
  return (90 - Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
}

/** Dark vessel animated positions with bearing */
function _darkVesselAnimatedPositions(datetime) {
  const nowMs = +new Date(datetime);
  const features = [];
  for (const [ssvid, tl] of Object.entries(darkVesselTimelines)) {
    const coord = _interpolatePosition(tl, nowMs);
    if (!coord) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: { vesselName: tl.name, ssvid, flag: tl.flag, bearing: _computeBearing(tl, nowMs) },
    });
  }
  return features;
}

// Called every sub-day tick — updates PEMEX animated dots + traces
function updatePemexAnimation(map, datetime) {
  // Animated interpolated dots
  if (map.getSource('pemex-loitering')) {
    map.getSource('pemex-loitering').setData({
      type: 'FeatureCollection',
      features: _pemexAnimatedPositions(datetime),
    });
  }
}

// Called every sub-day tick — updates dark vessel animated dots + traces
function updateDarkVesselAnimation(map, datetime) {
  if (map.getSource('dark-vessels')) {
    map.getSource('dark-vessels').setData({
      type: 'FeatureCollection',
      features: _darkVesselAnimatedPositions(datetime),
    });
  }
}

/** Other-vessel animated positions with bearing */
function _otherVesselAnimatedPositions(datetime) {
  const nowMs = +new Date(datetime);
  const features = [];
  for (const [ssvid, tl] of Object.entries(otherVesselTimelines)) {
    const coord = _interpolatePosition(tl, nowMs);
    if (!coord) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: { vesselName: tl.name, ssvid, flag: tl.flag, bearing: _computeBearing(tl, nowMs) },
    });
  }
  return features;
}

// Called every sub-day tick — updates non-PEMEX vessel animated dots + traces
function updateOtherVesselAnimation(map, datetime) {
  if (map.getSource('other-vessels')) {
    map.getSource('other-vessels').setData({
      type: 'FeatureCollection',
      features: _otherVesselAnimatedPositions(datetime),
    });
  }
}

async function loadGFWLoitering(map) {
  try {
    const [pemexRes, otherRes] = await Promise.all([
      fetch('/data/gfw/pemex-loitering.json'),
      fetch('/data/gfw/other-loitering.json'),
    ]);
    if (pemexRes.ok) {
      const data = await pemexRes.json();
      // Exclude Árbol Grande — it has its own dedicated layer
      pemexLoiteringAll = (data.entries ?? []).filter(e => e.vessel?.ssvid !== ARBOL_GRANDE_SSVID);
      console.info(`[GFW] Loaded ${pemexLoiteringAll.length} PEMEX loitering events (excl. Árbol Grande)`);
    }
    // Load real vessel tracks (built from loitering + port visit event positions)
    const tracksRes = await fetch('/data/gfw/pemex-tracks.json');
    if (tracksRes.ok) {
      const tracksData = await tracksRes.json();
      pemexVesselTimelines = _buildVesselTimelinesFromTracks(tracksData);
      console.info(`[GFW] Loaded PEMEX tracks: ${Object.keys(pemexVesselTimelines).length} vessels, ${Object.values(pemexVesselTimelines).reduce((s, v) => s + v.points.length, 0)} track points`);
    }
    if (otherRes.ok) {
      const data = await otherRes.json();
      otherLoiteringAll = data.entries ?? [];
      console.info(`[GFW] Loaded ${otherLoiteringAll.length} non-PEMEX loitering events`);
    }
    // Load other-vessel tracks for animation
    const otherTracksRes = await fetch('/data/gfw/other-tracks.json');
    if (otherTracksRes.ok) {
      const otherTracksData = await otherTracksRes.json();
      otherVesselTimelines = _buildVesselTimelinesFromTracks(otherTracksData);
      console.info(`[GFW] Loaded other-vessel tracks: ${Object.keys(otherVesselTimelines).length} vessels, ${Object.values(otherVesselTimelines).reduce((s, v) => s + v.points.length, 0)} track points`);
    }
    // Load dark vessel tracks (AIS gap events)
    const darkRes = await fetch('/data/gfw/dark-vessels-tracks.json');
    if (darkRes.ok) {
      const darkData = await darkRes.json();
      darkVesselTimelines = _buildVesselTimelinesFromTracks(darkData);
      console.info(`[GFW] Loaded dark vessel tracks: ${Object.keys(darkVesselTimelines).length} vessels, ${Object.values(darkVesselTimelines).reduce((s, v) => s + v.points.length, 0)} track points`);
    }
  } catch (_) { return; }
}

async function fetchCeruleanSlicks(map) {
  const BASE   = '/api/cerulean?';
  const fixed  = new URLSearchParams({
    bbox    : '-97.5,18.0,-91.3,21.5',
    datetime: '2026-01-01T00:00:00Z/2026-03-31T23:59:59Z',
    sortby  : 'slick_timestamp',
    limit   : '500',
  });
  try {
    const res = await fetch(BASE + fixed.toString());
    if (!res.ok) return;
    const data = await res.json();
    ceruleanAll = data?.features ?? [];
  } catch {
    // Cerulean is optional — degrade gracefully
  }
}

// Show slicks detected in the 10-day trailing window ending at dateStr
function updateCeruleanByDate(map, dateStr) {
  if (!map.getSource('cerulean-slicks')) return;
  const end   = new Date(dateStr + 'T23:59:59Z');
  const start = new Date(end.getTime() - 10 * 86_400_000);
  const features = ceruleanAll.filter(f => {
    const ts = f.properties?.slick_timestamp;
    if (!ts) return false;
    const d = new Date(ts);
    return d >= start && d <= end;
  });
  map.getSource('cerulean-slicks').setData({ type: 'FeatureCollection', features });
}

// ── Boundary loading ──────────────────────────────────────────────────────────
async function loadBoundaries(map) {
  try {
    // Simplified Natural Earth data via GitHub
    const [cRes, sRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson'),
      fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson'),
    ]);

    if (cRes.ok) {
      const countries = await cRes.json();
      // Filter to Gulf of Mexico region (bounding box)
      const filtered = {
        ...countries,
        features: countries.features.filter(f =>
          ['Mexico', 'United States of America', 'Cuba', 'Guatemala', 'Belize'].includes(
            f.properties?.ADMIN || f.properties?.name || '',
          ),
        ),
      };
      if (map.getSource('geo-countries')) map.getSource('geo-countries').setData(filtered);
    }

    if (sRes.ok) {
      const states = await sRes.json();
      // Filter to Mexico + Gulf states
      const filtered = {
        ...states,
        features: states.features.filter(f => {
          const sr = f.properties?.sr_adm0_a3 || f.properties?.adm0_a3 || '';
          return ['MEX', 'USA'].includes(sr);
        }),
      };
      if (map.getSource('geo-states')) map.getSource('geo-states').setData(filtered);
    }
  } catch {
    // Boundaries are decorative — graceful degradation
  }
}

// ── Layer update functions ────────────────────────────────────────────────────

/** Build Árbol Grande timeline from GFW track cache (called once after data loads) */
function _buildArbolGrandeTimeline(trackData) {
  if (!trackData || !trackData.length) return null;
  const points = trackData.map(p => ({ t: +new Date(p.d), lon: p.c[0], lat: p.c[1] }));
  points.sort((a, b) => a.t - b.t);
  return { name: 'Árbol Grande', flag: 'MX', points };
}

/** Árbol Grande animated positions — identical pattern to _pemexAnimatedPositions */
function _arbolGrandeAnimatedPositions(datetime) {
  if (!arbolGrandeTimeline) return [];
  const nowMs = +new Date(datetime);
  const tl = arbolGrandeTimeline;
  const coord = _interpolatePosition(tl, nowMs);
  if (!coord) return [];
  return [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord },
    properties: { vesselName: tl.name, ssvid: ARBOL_GRANDE_SSVID, flag: tl.flag, bearing: _computeBearing(tl, nowMs) },
  }];
}

/** Update Árbol Grande on each sub-day tick — identical pattern to updatePemexAnimation */
function updateArbolGrandeAnimation(map, datetime) {
  if (map.getSource('arbol-grande')) {
    map.getSource('arbol-grande').setData({
      type: 'FeatureCollection',
      features: _arbolGrandeAnimatedPositions(datetime),
    });
  }
}

function updateEventLabels(map, dateStr) {
  const event = EVENTS.find(e => e.date === dateStr && e.coordinates && e.id !== 'baseline');
  const fc = {
    type: 'FeatureCollection',
    features: event
      ? [{ type: 'Feature',
           geometry: { type: 'Point', coordinates: event.coordinates },
           properties: { label: event.title } }]
      : [],
  };
  if (map.getSource('event-labels')) map.getSource('event-labels').setData(fc);
}

// ── GIS Layer Panel ───────────────────────────────────────────────────────────

function LayerPanel({ activeBasemap, setActiveBasemap, overlaySt, setOverlaySt }) {
  const [open, setOpen] = useState(true);

  const toggle = (id) => setOverlaySt(s => ({ ...s, [id]: !s[id] }));

  return (
    <div className={styles.layerPanel}>
      <button className={styles.layerPanelToggle} onClick={() => setOpen(v => !v)}>
        <span>≡ Capas</span>
        <span className={styles.layerPanelCaret}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.layerPanelBody}>
          {/* ── Basemap group (radio) ── */}
          <div className={styles.layerGroup}>
            <div className={styles.layerGroupTitle}>
              <span className={styles.dot} style={{ background: '#4cc9f0' }} />
              Imagen de fondo
            </div>
            {BASEMAP_DEFS.map(b => (
              <label key={b.id} className={`${styles.layerRow} ${activeBasemap === b.id ? styles.layerRowActive : ''}`}
                data-tip={b.tip}>
                <input
                  type="radio" name="basemap"
                  className={styles.layerInput}
                  checked={activeBasemap === b.id}
                  onChange={() => setActiveBasemap(b.id)}
                />
                <span className={styles.layerIcon}>{b.icon}</span>
                <span className={styles.layerLabel}>{b.label}</span>
              </label>
            ))}
          </div>

          {/* ── Data overlays (checkboxes) ── */}
          <div className={styles.layerGroup}>
            <div className={styles.layerGroupTitle}>
              <span className={styles.dot} style={{ background: '#f0b429' }} />
              Capas de datos
            </div>
            {OVERLAY_DEFS.map(o => {
              const on = overlaySt[o.id] ?? true;
              return (
                <label key={o.id} className={`${styles.layerRow} ${on ? styles.layerRowActive : ''}`}
                  data-tip={o.tip}>
                  <input
                    type="checkbox"
                    className={styles.layerInput}
                    checked={on}
                    onChange={() => toggle(o.id)}
                  />
                  {/* Color swatch — matches actual map layer color */}
                  <span className={styles.layerIcon} style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: on ? o.color : '#3a4a5a',
                    boxShadow: on ? `0 0 6px 1px ${o.color}80` : 'none',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <span className={styles.layerLabel}>
                    {o.label}
                    {o.dynamic && <span style={{ fontSize: 9, color: '#7090b0', marginLeft: 4, fontStyle: 'italic' }}>⏱</span>}
                  </span>
                  <span className={`${styles.layerBadge} ${on ? styles.layerBadgeOn : styles.layerBadgeOff}`}>
                    {on ? 'ON' : 'OFF'}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Legend footnote */}
          <div style={{ padding: '4px 8px', fontSize: 9, color: '#506880', lineHeight: 1.4 }}>
            <span style={{ fontStyle: 'italic' }}>⏱ = cambia con la línea de tiempo</span>
            <br />
            <span>Haga clic en puntos/líneas del mapa para ver detalles</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── React component ───────────────────────────────────────────────────────────

export default function MapView({ currentDate, currentDatetime, activeEvent, onVesselClick, onEventSelect, onEventsOverlayChange }) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const loadedRef       = useRef(false);
  const setActiveBMRef  = useRef(null);
  const datetimeRef     = useRef(currentDatetime ?? currentDate); // always-current for load closure
  const overlayStRef    = useRef(null);                            // current overlaySt for date-effect guard
  const gfwTracksRef    = useRef({});                              // GFW track overrides keyed by vessel id
  const lastCopernicusDateRef = useRef(null);                      // last date used for Copernicus tile URL (avoid flashing)
  const onVesselClickRef = useRef(onVesselClick);                  // always-current callback ref
  const onEventSelectRef = useRef(onEventSelect);                  // always-current callback ref
  const coordBarRef = useRef(null);                                // coordinate readout DOM element
  const aoiBarRef = useRef(null);                                  // AOI bounds readout DOM element
  const arbolPulseRef = useRef(null);                               // requestAnimationFrame id for aura pulse (unused for now)
  const [activeBasemap, setActiveBasemap] = useState('esri');
  const [overlaySt, setOverlaySt]         = useState(DEFAULT_OVERLAY_STATE);
  const [showAoi, setShowAoi]             = useState(false);       // toggle AOI viewport display

  // Keep refs in sync every render
  setActiveBMRef.current = setActiveBasemap;
  datetimeRef.current    = currentDatetime ?? currentDate;
  overlayStRef.current   = overlaySt;
  onVesselClickRef.current = onVesselClick;
  onEventSelectRef.current = onEventSelect;

  // Initialize map once
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container:  containerRef.current,
      style:      buildMapStyle(currentDate),
      bounds:     INITIAL_BOUNDS,
      fitBoundsOptions: { padding: 0 },
      minZoom:    MIN_ZOOM,
      maxZoom:    15,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '© Esri | SkyTruth Cerulean | <a href="https://globalfishingwatch.org" target="_blank" rel="noopener">Powered by Global Fishing Watch</a> | © Copernicus/ESA',
      }),
      'bottom-right',
    );

    map.on('load', () => {
      initLayers(map);
      loadBoundaries(map);

      // Fetch all Cerulean slicks for the incident period, then apply date filter
      fetchCeruleanSlicks(map).then(() => updateCeruleanByDate(map, currentDate));
      // Load real GFW AIS track for Árbol Grande (MMSI 345070403) — falls back to hardcoded on failure
      fetchGFWTrack('arbol-grande', '345070403').then(track => {
        if (track) {
          gfwTracksRef.current['arbol-grande'] = track;
          arbolGrandeTimeline = _buildArbolGrandeTimeline(track);
          updateArbolGrandeAnimation(map, datetimeRef.current);

          // Pulsing aura animation (opacity oscillation: 0.3 – 0.65)
          const pulseAura = () => {
            if (map.getLayer('arbol-grande-aura')) {
              const t = performance.now() / 1000;
              const opacity = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.5));
              map.setPaintProperty('arbol-grande-aura', 'icon-opacity', opacity);
            }
            arbolPulseRef.current = requestAnimationFrame(pulseAura);
          };
          arbolPulseRef.current = requestAnimationFrame(pulseAura);
        }
      });
      loadGFWLoitering(map).then(() => {
        updatePemexAnimation(map, datetimeRef.current);
        updateDarkVesselAnimation(map, datetimeRef.current);
        updateOtherVesselAnimation(map, datetimeRef.current);
      });
      updateEventLabels(map, currentDate);
      loadedRef.current = true;
    });

    // Click on MPA polygons — show name popup
    map.on('click', 'mpa-fill', (e) => {
      const p = e.features[0]?.properties;
      if (!p) return;
      new maplibregl.Popup({ maxWidth: '220px' })
        .setLngLat(e.lngLat)
        .setHTML(`<div style="font:13px/1.5 'Inter',sans-serif;color:#e0eaff;padding:2px 4px"><div style="font-weight:700;color:#00e8af;margin-bottom:4px">🟢 Área Marina Protegida</div><div>${p.name}</div><div style="font-size:11px;color:#7090b0;margin-top:4px">Fuente: WDPA vía Cerulean/SkyTruth</div></div>`)
        .addTo(map);
    });

    // Click on infra POIs
    map.on('click', 'infra-circle', (e) => {
      const props = e.features[0]?.properties;
      if (!props) return;
      const poi = INFRASTRUCTURE.find(p => p.id === props.id);
      if (poi && onEventSelectRef.current) {
        onEventSelectRef.current({
          id: poi.id, title: poi.name, subtitle: 'Infraestructura',
          description: poi.description, date: currentDate, sources: [], severity: 'medium',
          coordinates: poi.coordinates,
        });
      }
    });

    // Click on Cerulean real oil slick detections — show popup with SAR detection info
    // Also switches to the Sentinel-1 SAR basemap (same imagery Cerulean uses under the hood)
    map.on('click', 'cerulean-fill', (e) => {
      const p = e.features[0]?.properties;
      if (!p) return;
      const areakm2 = p.area ? `${(Number(p.area) / 1e6).toFixed(2)} km²` : 'N/D';
      const ts = p.slick_timestamp
        ? new Date(p.slick_timestamp).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
        : 'N/D';
      const conf  = p.machine_confidence != null ? Number(p.machine_confidence).toFixed(2) : 'N/D';
      const score = p.max_source_collated_score != null ? Number(p.max_source_collated_score).toFixed(2) : 'N/D';
      const hitl  = p.hitl_cls_name || '—';
      const url   = p.slick_url || '#';

      // Auto-switch to SAR basemap — this is the same Sentinel-1 imagery Cerulean renders
      setActiveBMRef.current?.('copernicus-s1');

      new maplibregl.Popup({ maxWidth: '252px', className: 'cerulean-popup' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font:13px/1.5 'Inter',sans-serif;color:#e0eaff;padding:2px 4px">
            <div style="font-weight:700;color:#f0b429;margin-bottom:4px">🛰 Detección Cerulean SAR</div>
            <div><b>Fecha detección:</b> ${ts}</div>
            <div><b>Área:</b> ${areakm2}</div>
            <div><b>Confianza modelo:</b> ${conf}</div>
            <div><b>Score fuente:</b> ${score}</div>
            <div><b>Revisión humana:</b> ${hitl}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <a href="${url}" target="_blank" rel="noopener"
                 style="color:#f0b429;text-decoration:none;font-weight:600">
                Ver imagen SAR en Cerulean ↗
              </a>
            </div>
            <div style="font-size:10px;color:#4a6a8a;margin-top:4px">📡 Imagen: Sentinel-1 SAR (misma fuente que arriba)</div>
          </div>`)
        .addTo(map);
    });

    // Coordinate readout on mouse move
    map.on('mousemove', (e) => {
      if (coordBarRef.current) {
        const { lng, lat } = e.lngLat;
        coordBarRef.current.textContent = `${lat.toFixed(5)}° N  ${lng.toFixed(5)}° W`;
      }
    });
    map.on('mouseout', () => {
      if (coordBarRef.current) coordBarRef.current.textContent = '';
    });

    // AOI viewport bounds readout
    const updateAoiBounds = () => {
      if (!aoiBarRef.current) return;
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      const fmt = (v) => v.toFixed(4);
      aoiBarRef.current.textContent =
        `SW: ${fmt(sw.lng)}, ${fmt(sw.lat)}  |  NE: ${fmt(ne.lng)}, ${fmt(ne.lat)}`;
      aoiBarRef.current.dataset.polygon = JSON.stringify([
        [+fmt(sw.lng), +fmt(sw.lat)],
        [+fmt(ne.lng), +fmt(sw.lat)],
        [+fmt(ne.lng), +fmt(ne.lat)],
        [+fmt(sw.lng), +fmt(ne.lat)],
        [+fmt(sw.lng), +fmt(sw.lat)],
      ]);
    };
    map.on('moveend', updateAoiBounds);
    map.on('load', updateAoiBounds);

    // Cursors
    ['infra-circle', 'cerulean-fill', 'mpa-fill',
     'pemex-arrow', 'other-vessels-arrow', 'dark-vessels-arrow', 'arbol-grande-arrow', 'pemex-pipelines-line'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // Click on loitering events — rich popup with vessel info, hours, speed
    const handleLoiteringClick = (isPemex) => (e) => {
      const p = e.features[0]?.properties;
      if (!p) return;
      const name   = p.vesselName || 'Desconocido';
      const flag   = p.flag || '—';
      const mmsi   = p.ssvid || '—';
      const hours  = p.hours != null ? Number(p.hours).toFixed(1) : 'N/D';
      const days   = p.hours != null ? (Number(p.hours) / 24).toFixed(1) : 'N/D';
      const dist   = p.distanceKm != null ? Number(p.distanceKm).toFixed(1) + ' km' : 'N/D';
      const speed  = p.avgSpeedKn != null ? Number(p.avgSpeedKn).toFixed(2) + ' kn' : 'N/D';
      const start  = p.startDate ? new Date(p.startDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const end    = p.endDate   ? new Date(p.endDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const badge  = isPemex
        ? '<div style="font-weight:700;color:#4895ef;margin-bottom:6px">🔵 Merodeo PEMEX</div>'
        : '<div style="font-weight:700;color:#64b5f6;margin-bottom:6px">🔵 Merodeo GFW</div>';

      new maplibregl.Popup({ maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font:13px/1.5 'Inter',sans-serif;color:#e0eaff;padding:2px 4px">
            ${badge}
            <div><b>Buque:</b> ${name}</div>
            <div><b>Bandera:</b> ${flag} &nbsp;|&nbsp; <b>MMSI:</b> ${mmsi}</div>
            <div style="margin-top:4px"><b>Duración:</b> ${hours} h (${days} días)</div>
            <div><b>Vel. media:</b> ${speed}</div>
            <div><b>Dist. costa:</b> ${dist}</div>
            <div style="margin-top:4px;font-size:11px;color:#7090b0"><b>Período:</b> ${start} — ${end}</div>
            <div style="font-size:10px;color:#4a6a8a;margin-top:6px">Fuente: Global Fishing Watch — eventos de merodeo AOI</div>
          </div>`)
        .addTo(map);
    };
    map.on('click', 'pemex-arrow', handleLoiteringClick(true));
    map.on('click', 'other-vessels-arrow', handleLoiteringClick(false));
    map.on('click', 'dark-vessels-arrow', handleLoiteringClick(false));

    // Click on Árbol Grande arrow — enrich with GFW registry then notify parent
    map.on('click', 'arbol-grande-arrow', async (e) => {
      const base = {
        id: 'arbol-grande', name: 'Árbol Grande', type: 'primary',
        mmsi: '345070403', imo: '9264867', vesselType: 'Buque de reparación de ductos',
        description: 'Buque reparador de PEMEX (IMO 9264867). Permaneció anclado más de 200 horas directamente sobre el ducto Old AK C.',
      };
      if (onVesselClickRef.current) onVesselClickRef.current(base);
      try {
        const r = await fetch('/api/gfw?endpoint=vessels%2Fsearch&where=ssvid%3D%22345070403%22&datasets%5B0%5D=public-global-vessel-identity%3Alatest&limit=1');
        if (r.ok) {
          const d = await r.json();
          const entry = d?.entries?.[0];
          if (entry) {
            const sri = entry.selfReportedInfo?.[0] ?? {};
            const csi = entry.combinedSourcesInfo?.[0] ?? {};
            if (onVesselClickRef.current) onVesselClickRef.current({
              ...base,
              callsign: sri.callsign || base.callsign,
              flag: csi.flag || sri.flag || 'MX',
              gfwClass: csi.vesselType || csi.geartype || 'repair',
              gfwId: entry.id,
              gfwEnriched: true,
            });
          }
        }
      } catch (_) {}
    });

    // Click on pipelines — show pipeline info popup
    map.on('click', 'pemex-pipelines-line', (e) => {
      const p = e.features[0]?.properties;
      if (!p) return;
      const isIncident = p.id === 'old-ak-c';
      const color = isIncident ? '#ff4444' : '#ff9f1c';
      const statusBadge = isIncident
        ? '<span style="color:#ff4444;font-weight:700">⚠ INCIDENTE ACTIVO</span>'
        : `<span style="color:#82c91e">${p.status || 'Activo'}</span>`;

      new maplibregl.Popup({ maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font:13px/1.5 'Inter',sans-serif;color:#e0eaff;padding:2px 4px">
            <div style="font-weight:700;color:${color};margin-bottom:6px">🛢 Ducto PEMEX</div>
            <div><b>Nombre:</b> ${p.name || '—'}</div>
            <div><b>Operador:</b> ${p.operator || 'PEMEX'}</div>
            ${p.substance ? `<div><b>Sustancia:</b> ${p.substance}</div>` : ''}
            ${p.length_km ? `<div><b>Longitud:</b> ${p.length_km} km</div>` : ''}
            ${p.diameter_in ? `<div><b>Diámetro:</b> ${p.diameter_in}"</div>` : ''}
            <div style="margin-top:4px"><b>Estado:</b> ${statusBadge}</div>
            ${p.significance ? `<div style="font-size:11px;color:#7090b0;margin-top:4px">${p.significance}</div>` : ''}
          </div>`)
        .addTo(map);
    });

    return () => { cancelAnimationFrame(arbolPulseRef.current); map.remove(); mapRef.current = null; loadedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update all animated vessel layers every sub-day tick
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const dt = currentDatetime ?? currentDate;
    // Rebuild Árbol Grande timeline from cached track if lost (e.g. after HMR)
    if (!arbolGrandeTimeline && gfwTracksRef.current['arbol-grande']) {
      arbolGrandeTimeline = _buildArbolGrandeTimeline(gfwTracksRef.current['arbol-grande']);
    }
    updateArbolGrandeAnimation(map, dt);
    updatePemexAnimation(map, dt);
    updateDarkVesselAnimation(map, dt);
    updateOtherVesselAnimation(map, dt);
  }, [currentDatetime, currentDate]);

  // Update tiles, cerulean slicks, event labels only when calendar day changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    updateCeruleanByDate(map, currentDate);
    // other vessels now animate per sub-day tick, no daily update needed
    // Respect 'events' overlay toggle — clear source when disabled to prevent stale flash
    if (overlayStRef.current?.events !== false) {
      updateEventLabels(map, currentDate);
    } else {
      if (map.getSource('event-labels')) map.getSource('event-labels').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map.getSource('gibs-modis')) map.getSource('gibs-modis').setTiles([gibsTileUrl(currentDate)]);
    // Only refresh Copernicus tiles every 3+ days to avoid flashing during replay
    // (server uses ±5-day window anyway, so tiles stay valid for multiple days)
    const lastCopDate = lastCopernicusDateRef.current;
    const daysDiff = lastCopDate ? Math.abs(+new Date(currentDate) - +new Date(lastCopDate)) / 86_400_000 : Infinity;
    if (daysDiff >= 3) {
      lastCopernicusDateRef.current = currentDate;
      if (map.getSource('copernicus-s1')) map.getSource('copernicus-s1').setTiles([`/api/copernicus?z={z}&x={x}&y={y}&date=${currentDate}&layer=s1-sar`]);
      if (map.getSource('copernicus-s2')) map.getSource('copernicus-s2').setTiles([`/api/copernicus?z={z}&x={x}&y={y}&date=${currentDate}&layer=s2-rgb`]);
    }
  }, [currentDate]);

  // Switch basemap — hide all basemap raster layers, show the active one
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const allIds = BASEMAP_DEFS.flatMap(b => b.mapIds);
    allIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
    const active = BASEMAP_DEFS.find(b => b.id === activeBasemap);
    active?.mapIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
  }, [activeBasemap]);

  // Toggle overlay layers independently
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    OVERLAY_DEFS.forEach(({ id, mapIds }) => {
      const vis = (overlaySt[id] ?? true) ? 'visible' : 'none';
      mapIds.forEach(lid => { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis); });
      // Also clear the event-labels source when that overlay is disabled
      if (id === 'events' && vis === 'none' && map.getSource('event-labels')) {
        map.getSource('event-labels').setData({ type: 'FeatureCollection', features: [] });
      }

    });
  }, [overlaySt]);

  // Notify parent when events overlay is toggled so it can hide EventCard
  useEffect(() => {
    onEventsOverlayChange?.(overlaySt.events ?? true);
  }, [overlaySt.events, onEventsOverlayChange]);

  // (no auto-flyTo on events — viewport stays where the user left it)

  return (
    <div className={styles.mapWrap}>
      <div ref={containerRef} className={styles.map} />

      {/* Coordinate readout bar */}
      <div ref={coordBarRef} className={styles.coordBar} />

      {/* AOI viewport bounds bar */}
      {showAoi && (
        <div className={styles.aoiBar}>
          <span ref={aoiBarRef}>Pan/zoom to set AOI</span>
          <button
            className={styles.aoiCopyBtn}
            title="Copiar coordenadas como GeoJSON Polygon"
            onClick={() => {
              const poly = aoiBarRef.current?.dataset?.polygon;
              if (poly) {
                const geojson = JSON.stringify({ type: 'Polygon', coordinates: [JSON.parse(poly)] }, null, 2);
                navigator.clipboard.writeText(geojson);
                const btn = document.querySelector(`.${styles.aoiCopyBtn}`);
                if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '📋'; }, 1200); }
              }
            }}
          >
            📋
          </button>
        </div>
      )}

      {/* Home button */}
      <button
        className={styles.homeBtn}
        title="Volver al área de interés"
        onClick={() => mapRef.current?.flyTo({ center: CENTER, zoom: ZOOM, speed: 1.2 })}
      >
        ⌂
      </button>

      {/* AOI toggle button */}
      <button
        className={`${styles.aoiToggle} ${showAoi ? styles.aoiToggleActive : ''}`}
        title="Mostrar/ocultar coordenadas del viewport (AOI)"
        onClick={() => setShowAoi(v => !v)}
      >
        ◰
      </button>

      {/* Left stack: layer panel + chronology */}
      <div className={styles.leftStack}>
        <LayerPanel
          activeBasemap={activeBasemap}
          setActiveBasemap={setActiveBasemap}
          overlaySt={overlaySt}
          setOverlaySt={setOverlaySt}
        />
        <ChronologyPanel
          currentDate={currentDate}
          onEventSelect={onEventSelect}
        />
      </div>
    </div>
  );
}
