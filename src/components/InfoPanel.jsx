import styles from './InfoPanel.module.css';
import { EVENTS, INFRASTRUCTURE, SEVERITY_COLOR } from '../data/events.js';

const FMT_SHORT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' });
const fmtShort = (iso) => FMT_SHORT.format(new Date(iso + 'T12:00:00Z'));

export default function InfoPanel({ visible, onClose }) {
  return (
    <>
      {/* Backdrop */}
      {visible && <div className={styles.backdrop} onClick={onClose} />}

      <aside className={`${styles.panel} ${visible ? styles.open : ''}`}>
        <div className={styles.inner}>
          {/* Panel header */}
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Informe Técnico</h2>
              <p className={styles.panelSub}>Derrame de Hidrocarburo 2026 — Golfo de México</p>
            </div>
            <button className={styles.closeBtn} onClick={onClose} title="Cerrar panel">✕</button>
          </div>

          {/* ── Overview ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Resumen Ejecutivo</h3>
            <p className={styles.prose}>
              Esta plataforma documenta geoespacialmente la evolución de una descarga masiva de
              hidrocarburo en la Bahía de Campeche durante el primer trimestre de 2026. Integrando
              imágenes satelitales SAR (Sentinel-1) con datos AIS marítimos, se construye una
              cronología verificable que identifica el origen y progresión del derrame, el cual
              impactó más de <strong>630 km de litoral mexicano</strong>.
            </p>
          </section>

          {/* ── AOI ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Área de Interés (AOI)</h3>
            <table className={styles.table}>
              <tbody>
                <tr><td>Norte</td><td>21.5° N — Veracruz / Tamaulipas</td></tr>
                <tr><td>Sur</td><td>18.0° N — Tabasco / Dos Bocas</td></tr>
                <tr><td>Este</td><td>91.3° O — Cantarell / Abkatún</td></tr>
                <tr><td>Oeste</td><td>97.5° O — Tuxpan / Tampico</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Chronology ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Cronología de Eventos</h3>
            <ul className={styles.eventList}>
              {EVENTS.filter(e => e.id !== 'baseline').map(evt => (
                <li key={evt.id} className={styles.eventItem}>
                  <span
                    className={styles.eventDot}
                    style={{ background: SEVERITY_COLOR[evt.severity] }}
                  />
                  <div>
                    <span className={styles.eventDate}>{fmtShort(evt.date)}</span>
                    <span className={styles.eventTitle}>{evt.title}</span>
                    <p className={styles.eventDesc}>{evt.description}</p>
                    {evt.sources?.length > 0 && (
                      <ul className={styles.srcLinks}>
                        {evt.sources.map((src, i) => (
                          <li key={i}>
                            <a href={src.url} target="_blank" rel="noopener noreferrer">↗ {src.label}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Vessels ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Análisis Forense Marítimo</h3>

            <div className={styles.vesselCard}>
              <div className={styles.vesselHeader}>
                <span className={styles.vesselDot} style={{ background: '#e63946' }} />
                <strong>Árbol Grande</strong>
                <span className={styles.tag}>Buque primario</span>
              </div>
              <table className={styles.table}>
                <tbody>
                  <tr><td>IMO</td><td>9264867</td></tr>
                  <tr><td>MMSI</td><td>345070403</td></tr>
                  <tr><td>Tipo</td><td>Apoyo / Reparación de ductos</td></tr>
                  <tr><td>Período</td><td>9–16 Feb 2026 (200+ horas)</td></tr>
                  <tr><td>Posición</td><td>Ducto Old AK C (Akal-C)</td></tr>
                </tbody>
              </table>
              <p className={styles.prose} style={{ marginTop: 8, fontSize: 12 }}>
                Estuvo anclado directamente sobre el ducto submarino en falla durante todo
                el período de máximo flujo de hidrocarburo. Su presencia es la principal
                evidencia de un fallo de infraestructura PEMEX.
              </p>
            </div>

            <div className={styles.vesselCard} style={{ marginTop: 10 }}>
              <div className={styles.vesselHeader}>
                <span className={styles.vesselDot} style={{ background: '#ffd166' }} />
                <strong>Buque Oscuro (14 Feb)</strong>
                <span className={styles.tag}>AIS apagado</span>
              </div>
              <p className={styles.prose} style={{ fontSize: 12, marginTop: 6 }}>
                Detectado por SkyTruth mediante SAR con AIS desactivado dentro de la zona
                del derrame. Evasión del rastreo marítimo convencional.
              </p>
            </div>

            <div className={styles.vesselCard} style={{ marginTop: 10 }}>
              <div className={styles.vesselHeader}>
                <span className={styles.vesselDot} style={{ background: '#64b5f6' }} />
                <strong>Cosmic Glory</strong>
                <span className={styles.tag}>Cargo irregular</span>
              </div>
              <p className={styles.prose} style={{ fontSize: 12, marginTop: 6 }}>
                Declaró cargar "aditivos lubricantes" en Tampico. La plataforma Kpler reveló
                que transportaba diésel, sugiriendo prácticas de comercio ilícito.
              </p>
            </div>
          </section>

          {/* ── Infrastructure ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Infraestructura Clave</h3>
            <ul className={styles.infraList}>
              {INFRASTRUCTURE.map(poi => (
                <li key={poi.id}>
                  <strong>{poi.name}</strong>
                  <span>{poi.coordinates[1].toFixed(3)}° N, {Math.abs(poi.coordinates[0]).toFixed(3)}° O</span>
                  <p>{poi.description}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Environmental impacts ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Impacto Ambiental y Social</h3>
            <ul className={styles.impactList}>
              <li><span>🌊</span> <strong>630–680 km</strong> de litoral contaminado</li>
              <li><span>🏘</span> <strong>39 comunidades</strong> afectadas en Veracruz, Tabasco y Tamaulipas</li>
              <li><span>🌿</span> <strong>7 Áreas Naturales Protegidas</strong>, incluyendo el Sistema Arrecifal Veracruzano y Los Tuxtlas</li>
              <li><span>🐢</span> 5 especies contaminadas: tortugas, aves, delfines, manatíes</li>
              <li><span>🎣</span> Pesca artesanal interrumpida; hydrocarburos empujaron cardúmenes a aguas profundas</li>
              <li><span>⚖</span> <strong>800 toneladas</strong> de residuos recuperadas al 26 de marzo</li>
            </ul>
          </section>

          {/* ── Technical notes ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Metodología Técnica</h3>
            <p className={styles.prose}>
              La detección de manchas de hidrocarburo emplea imágenes de radar <strong>Sentinel-1 SAR</strong>
              (polarización VV, GRD). El aceite amortigua las ondas capilares de la superficie, creando
              zonas oscuras claramente diferenciables. Se aplica umbralización adaptativa (desplazamiento
              de ~−3.5 dB sobre el fondo marino promedio) para segmentar píxeles del derrrame.
            </p>
            <p className={styles.prose} style={{ marginTop: 8 }}>
              Los datos de seguimiento de embarcaciones provienen de la API de{' '}
              <a href="https://globalfishingwatch.org" target="_blank" rel="noopener" className={styles.link}>
                <strong>Global Fishing Watch</strong>
              </a>{' '}
              (detecciones de posición estacionaria y brechas AIS). Las manchas vectorizadas son
              proporcionadas por la API <strong>SkyTruth Cerulean</strong>.
            </p>
          </section>

          <div className={styles.footer}>
            <p>Sistema de Coordenadas: WGS-84 | Datos: Sentinel-1, GFW, SkyTruth, NOAA</p>
            <p>Fuente primaria: El País, Associated Press, NOAA Incident News</p>
            <p style={{ marginTop: 8 }}>
              <a href="https://globalfishingwatch.org" target="_blank" rel="noopener" className={styles.link}>
                Powered by Global Fishing Watch
              </a>
              {' '}© 2026, actualizado diariamente. Vessel Presence y AIS Gap Events API, ene–abr 2026.
              Datos consultados {new Date().toISOString().slice(0, 10)} en{' '}
              <a href="https://globalfishingwatch.org/our-apis/" target="_blank" rel="noopener" className={styles.link}>
                globalfishingwatch.org/our-apis/
              </a>.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
