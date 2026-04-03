// Datos del incidente — Derrame de Hidrocarburo, Golfo de México 2026
// Fuente: Informe Técnico de Referencia

export const AOI = {
  center: [-92.45, 19.03],
  zoom: 7.5,
  bounds: [[-94.3092, 18.0111], [-90.5857, 20.0533]],
};

export const TIMELINE_START = '2026-02-05';
export const TIMELINE_END   = '2026-03-31';

// Puntos de infraestructura clave
export const INFRASTRUCTURE = [
  {
    id: 'abkatan',
    name: 'Complejo Abkatún-A',
    nameShort: 'Abkatún-A',
    coordinates: [-92.1, 19.22],
    type: 'platform',
    description: 'Primera fuente detectada del derrame el 6 de febrero de 2026.',
  },
  {
    id: 'akal-c',
    name: 'Plataforma Akal-C',
    nameShort: 'Akal-C',
    coordinates: [-92.044, 19.396],
    type: 'platform',
    description: 'Punto sospechoso de la ruptura del ducto "Old AK C". El Árbol Grande estuvo anclado aquí.',
  },
  {
    id: 'dos-bocas',
    name: 'Terminal Marítima Dos Bocas',
    nameShort: 'Dos Bocas',
    coordinates: [-93.78, 18.43],
    type: 'terminal',
    description: 'Terminal receptora del oleoducto Old AK C de 161 km.',
  },

  {
    id: 'cantarell',
    name: 'Complejo Cantarell',
    nameShort: 'Cantarell',
    coordinates: [-91.95, 19.55],
    type: 'platform',
    description: 'Complejo de infraestructura de PEMEX en la Sonda de Campeche.',
  },
];

// Cronología de eventos — todos los textos en español
export const EVENTS = [
  {
    id: 'baseline',
    date: '2026-01-01',
    title: 'Condiciones de Referencia',
    subtitle: 'Enero 2026 — Sin anomalías detectadas',
    description:
      'La Sonda de Campeche exhibe características operacionales rutinarias. Los sistemas NESDIS de NOAA y el procesamiento independiente de SAR (Radar de Apertura Sintética) indican niveles de filtración estándar, consistentes con las "chapopoteras" naturales del fondo marino. No se detecta ningún derrame de envergadura.',
    sources: [
      { label: 'NOAA Incident News', url: 'https://incidentnews.noaa.gov/incident/11139' },
    ],
    coordinates: null,
    severity: 'none',
  },
  {
    id: 'first-detection',
    date: '2026-02-06',
    title: 'Primera Detección del Derrame',
    subtitle: 'Origen confirmado cerca del complejo Abkatún',
    description:
      'Se confirma la primera detección del hidrocarburo en la Sonda de Campeche, originándose cerca de la plataforma Abkatún-A. Las imágenes satelitales de radar muestran una mancha oscura en la superficie del mar. Las organizaciones ambientalistas internacionales son las primeras en alertar sobre el evento.',
    sources: [
      { label: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/' },
      { label: 'El País (Investigación)', url: 'https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html' },
      { label: 'Coast TV', url: 'https://www.coasttv.com/news/international/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/article_86937061-1daa-5ab7-b760-fd8ac77dcdad.html' },
    ],
    coordinates: [-92.1, 19.22],
    severity: 'medium',
  },
  {
    id: 'arbol-grande-arrives',
    date: '2026-02-09',
    title: 'El "Árbol Grande" se Ancla sobre el Ducto',
    subtitle: 'Vessel de reparación PEMEX — IMO 9264867',
    description:
      'El buque de reparación de ductos Árbol Grande (IMO: 9264867, MMSI: 345070403) llega y ancla directamente sobre el ducto "Old AK C" (oleoducto Maya de 161 km entre Akal-C y Dos Bocas). Permanece estacionario más de 200 horas (8 días) en el punto exacto del derrame. Su presencia es considerada la "prueba de humo" de un fallo en la infraestructura submarina.',
    sources: [
      { label: 'El País — Buque 8 días en zona del derrame', url: 'https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html' },
      { label: 'Ground.news — PEMEX negó reparación', url: 'https://ground.news/article/pemex-denied-pipeline-repair' },
      { label: 'VesselTracker — Árbol Grande', url: 'https://www.vesseltracker.com/en/Ships/Arbol-Grande-9264867.html' },
    ],
    coordinates: [-92.044, 19.396],
    severity: 'high',
    vesselHighlight: 'arbol-grande',
  },
  {
    id: 'containment-visible',
    date: '2026-02-13',
    title: 'Buques de Contención Visibles en Imágenes',
    subtitle: 'Intervención oficial no reconocida',
    description:
      'Las imágenes satelitales muestran múltiples embarcaciones realizando maniobras de contención en la zona del derrame, lo que indica conocimiento oficial temprano del incidente, semanas antes de cualquier comunicado público. PEMEX no ha emitido ningún reconocimiento oficial.',
    sources: [
      { label: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/news/mexico-week-in-review-rate-cut-peso-oil-spill/' },
      { label: 'El País', url: 'https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html' },
      { label: 'Associated Press', url: 'https://apnews.com/article/gulf-of-mexico-veracruz-oil-spill-environment-pemex-pipeline-a38d99ba63e41a288c54afd0f82432c9' },
    ],
    coordinates: [-92.2, 19.3],
    severity: 'high',
  },
  {
    id: 'peak-slick',
    date: '2026-02-14',
    title: 'Mancha Alcanza Tamaño Máximo (~50 km²)',
    subtitle: 'SkyTruth detecta "buque oscuro" con AIS apagado',
    description:
      'La mancha de hidrocarburo alcanza su magnitud máxima de aproximadamente 50 kilómetros cuadrados. El sistema Cerulean de SkyTruth detecta un "buque oscuro" (con el sistema AIS desactivado) desplazándose en la zona del derrame en la Bahía de Campeche, evadiendo el rastreo marítimo convencional.',
    sources: [
      { label: 'Energy Analytics Institute', url: 'https://energy-analytics-institute.org/2026/03/27/press-digest-27-mar-2026-mexico-oil-spill-clean-up-efforts-houston-we-have-a-problem/' },
      { label: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/' },
      { label: 'SkyTruth Cerulean API', url: 'https://skytruth.org/cerulean-methods/' },
    ],
    coordinates: [-92.5, 19.35],
    severity: 'critical',
    vesselHighlight: 'dark-vessel',
  },
  {
    id: 'imagery-arbol',
    date: '2026-02-15',
    title: 'Imágenes Capturan al Árbol Grande Rodeado de Apoyo',
    subtitle: 'Evidencia visual del epicentro de la fuga',
    description:
      'Las imágenes satelitales capturan al Árbol Grande rodeado de embarcaciones de apoyo en el centro exacto de la enorme mancha. Esta evidencia visual correlaciona directamente la posición del buque de reparación con el origen del derrame, contradiciendo la narrativa oficial.',
    sources: [
      { label: 'El País — Análisis de imágenes', url: 'https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html' },
      { label: 'Associated Press (confirmación visual)', url: 'https://www.newsday.com/news/nation/gulf-of-mexico-veracruz-oil-spill-environment-pemex-pipeline-n71685' },
      { label: 'Copernicus Sentinel-1 Docs', url: 'https://documentation.dataspace.copernicus.eu/Data/Sentinel1.html' },
    ],
    coordinates: [-92.044, 19.396],
    severity: 'critical',
    vesselHighlight: 'arbol-grande',
  },
  {
    id: 'tabasco-landfall',
    date: '2026-03-02',
    title: 'Hidrocarburo llega a las Costas de Tabasco',
    subtitle: 'Confirmación oficial de la Marina (SEMAR)',
    description:
      'La Secretaría de Marina (SEMAR) confirma que residuos de hidrocarburo han llegado a las playas del estado de Tabasco. Es el primer reconocimiento oficial de impacto costero, 24 días después de la primera detección satelital. Comunidades pesqueras y artesanales comienzan a reportar graves afectaciones.',
    sources: [
      { label: 'NOAA Incident News (registro oficial)', url: 'https://incidentnews.noaa.gov/incident/11139' },
      { label: 'AP Video — Limpieza Naval', url: 'https://newsroom.ap.org/detail/GulfofMexicooilspillspreadhundredsofmilesandpollutedMexicanreserves/9cfc445f4c5940a4b44b794b0ccc29a5/video' },
      { label: 'NNPC Marine — Alerta puertos', url: 'https://nnpc-marine.com/member-circular-big-oil-spill-affecting-ports-of-mexico-veracruz-and-coatzacoalcos/' },
    ],
    coordinates: [-93.4, 18.79],
    severity: 'critical',
  },
  {
    id: 'official-denial-1',
    date: '2026-03-12',
    title: 'Gobierno Culpa a "Barco Privado" Anónimo',
    subtitle: 'Gobernadora Nahle y PEMEX reconocen el derrame, niegan responsabilidad',
    description:
      'La Gobernadora Rocío Nahle y PEMEX reconocen públicamente el derrame por primera vez, pero atribuyen la causa a un "barco privado" no identificado. Esta narrativa contradice directamente la evidencia AIS que muestra al Árbol Grande (buque de PEMEX) anclado sobre el ducto durante 8 días.',
    sources: [
      { label: 'Energy Analytics — Sheinbaum exonera a PEMEX', url: 'https://energy-analytics-institute.org/2026/03/24/sheinbaum-exonerates-pemex-from-the-oil-spill-in-the-gulf-of-mexico/' },
      { label: 'El Sol de México — Ducto roto', url: 'https://oem.com.mx/elsoldemexico/analisis/aguas-profundas-el-derrame-es-por-un-ducto-roto-29149148' },
      { label: 'Business & Human Rights', url: 'https://www.business-humanrights.org/en/latest-news/mexico-more-than-a-dozen-oil-spills-have-been-affecting-39-communities-in-the-gulf-of-mexico/' },
    ],
    coordinates: [-94.0, 19.5],
    severity: 'high',
  },
  {
    id: 'multiple-sources',
    date: '2026-03-26',
    title: 'Autoridades Admiten 800 Toneladas; Culpan Fuentes Naturales',
    subtitle: 'Versión oficial: filtraciones naturales e ilegal dumping',
    description:
      'Las autoridades admiten que se han recuperado 800 toneladas de residuos de hidrocarburo, pero atribuyen el derrame a "filtraciones naturales del fondo marino" y vertidos ilegales. 630-680 kilómetros de litoral están contaminados, afectando 39 comunidades en Veracruz, Tabasco y Tamaulipas. Siete Áreas Naturales Protegidas están comprometidas.',
    sources: [
      { label: 'Investing.com — Marina dice causas múltiples', url: 'https://www.investing.com/news/commodities-news/mexican-navy-says-petroleum-tanker-natural-seabed-likely-caused-gulf-coast-spill-4584052' },
      { label: 'Associated Press — Derrame Veracruz', url: 'https://apnews.com/article/mexico-oil-spill-veracruz-17d98fc79f37987932ebddde9909a630' },
      { label: 'Mexico Business News — Múltiples fuentes', url: 'https://mexicobusiness.news/oilandgas/news/mexico-finds-multiple-sources-behind-gulf-oil-spill' },
    ],
    coordinates: [-95.0, 20.0],
    severity: 'critical',
  },
  {
    id: 'sheinbaum-denies',
    date: '2026-03-31',
    title: 'Presidenta Sheinbaum Niega la Fuga del Ducto',
    subtitle: 'Conferencia matutina: descarta afectación al turismo',
    description:
      'En su conferencia mañanera, la Presidenta Claudia Sheinbaum niega categóricamente que un ducto de PEMEX haya causado el derrame y descarta afectaciones significativas al turismo costero. Grupos ambientalistas internacionales acusan al gobierno mexicano de mentir sobre los orígenes del derrame, citando la evidencia satelital y AIS como prueba de lo contrario.',
    sources: [
      { label: 'Eje Central — Mañanera Sheinbaum', url: 'https://www.ejecentral.com.mx/nuestro-eje/mananera-de-claudia-sheinbaum-en-vivo-resumen-de-la-conferencia-matutina-del-31-de-marzo-of-2026' },
      { label: 'Diario de Xalapa', url: 'https://oem.com.mx/diariodexalapa/local/claudia-sheinbaum-deslinda-a-pemex-por-derrame-de-hidrocarburo-y-descarta-afectaciones-al-turismo-29142288' },
      { label: 'AP vía WKYC — Acusaciones de mentira', url: 'https://www.wkyc.com/article/syndication/associatedpress/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/616-b8bacdc2-77a9-49ca-b87f-c23c030612a6' },
    ],
    coordinates: [-95.5, 20.5],
    severity: 'medium',
  },
];

// Mapa de severidad → color UI
export const SEVERITY_COLOR = {
  none: '#64748b',
  medium: '#f4a261',
  high: '#e07b39',
  critical: '#e63946',
};

/** Array of every day (YYYY-MM-DD) between TIMELINE_START and TIMELINE_END. */
export function getDayMarkers() {
  const days = [];
  const d = new Date(TIMELINE_START + 'T00:00:00Z');
  const end = new Date(TIMELINE_END + 'T00:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/**
 * Dado un string de fecha ISO, devuelve el evento más cercano EN o ANTES de esa fecha,
 * o null si no hay ninguno.
 */
export function getActiveEventForDate(dateStr) {
  const sorted = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.filter(e => e.date <= dateStr && e.id !== 'baseline').pop() || null;
}

/**
 * Devuelve el porcentaje (0-100) de la posición de una fecha en el timeline.
 */
export function dateToPercent(dateStr) {
  const start = new Date(TIMELINE_START).getTime();
  const end   = new Date(TIMELINE_END).getTime();
  const d     = new Date(dateStr).getTime();
  return Math.max(0, Math.min(100, ((d - start) / (end - start)) * 100));
}

/**
 * Convierte un porcentaje del slider a una fecha ISO.
 */
export function percentToDate(pct) {
  const start = new Date(TIMELINE_START).getTime();
  const end   = new Date(TIMELINE_END).getTime();
  const ms    = start + (end - start) * (pct / 100);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Avanza una fecha ISO en +1 día. Clamp al TIMELINE_END.
 */
export function nextDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  return iso > TIMELINE_END ? TIMELINE_END : iso;
}

/** Advance a full ISO datetime by stepH hours, clamped to TIMELINE_END. */
export function nextHour(isoDatetime, stepH = 6) {
  const d = new Date(isoDatetime);
  d.setUTCHours(d.getUTCHours() + stepH);
  const dateOnly = d.toISOString().slice(0, 10);
  if (dateOnly > TIMELINE_END) return TIMELINE_END + 'T00:00:00Z';
  return d.toISOString().slice(0, 16) + ':00Z';
}
