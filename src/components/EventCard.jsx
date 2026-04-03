import { useEffect, useRef } from 'react';
import { SEVERITY_COLOR } from '../data/events.js';
import styles from './EventCard.module.css';

const FMT = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDate = (iso) => {
  try { return FMT.format(new Date(iso + 'T12:00:00Z')); } catch { return iso; }
};

export default function EventCard({ event, onClose, isVessel = false, isPlaying = false, onPause, onPlay }) {
  const cardRef = useRef(null);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap click-outside
  useEffect(() => {
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    // Small delay to avoid immediate close from the click that opened the card
    const t = setTimeout(() => window.addEventListener('mousedown', handler), 120);
    return () => { clearTimeout(t); window.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const accentColor = SEVERITY_COLOR[event.severity] || '#4895ef';

  return (
    <div ref={cardRef} className={styles.card} style={{ '--accent': accentColor }}>
      {/* Colored top border */}
      <div className={styles.topBar} style={{ background: accentColor }} />

      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.date}>{fmtDate(event.date)}</p>
          <h2 className={styles.title}>{event.title}</h2>
          {event.subtitle && <p className={styles.subtitle}>{event.subtitle}</p>}
        </div>
        <div className={styles.headerActions}>
          {(onPause || onPlay) && (
            <button
              className={styles.pauseBtn}
              onClick={isPlaying ? onPause : onPlay}
              title={isPlaying ? 'Pausar reproducción' : 'Reanudar reproducción'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose} title="Cerrar">✕</button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <p className={styles.description}>{event.description}</p>

        {/* Severity badge */}
        {event.severity && event.severity !== 'none' && (
          <div className={styles.badge} style={{ borderColor: accentColor, color: accentColor }}>
            { event.severity === 'critical' ? '⚠ Evento Crítico'
            : event.severity === 'high'     ? '● Alta Relevancia'
            :                                 '○ Evento Registrado' }
          </div>
        )}

        {/* Sources */}
        {event.sources?.length > 0 && (
          <div className={styles.sources}>
            <p className={styles.sourcesTitle}>Fuentes verificadas</p>
            <ul className={styles.sourcesList}>
              {event.sources.map((src, i) => (
                <li key={i}>
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    <span className={styles.extIcon}>↗</span>
                    {src.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
