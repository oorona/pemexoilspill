import { useCallback, useRef } from 'react';
import { EVENTS, TIMELINE_START, TIMELINE_END, dateToPercent, percentToDate, SEVERITY_COLOR, getDayMarkers } from '../data/events.js';
import styles from './Timeline.module.css';

const FMT  = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
const FMT_T = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
const formatDate     = (iso) => FMT.format(new Date(iso + 'T12:00:00Z'));
const formatDatetime = (iso) => {
  const d = new Date(iso);
  return FMT.format(d) + ' · ' + FMT_T.format(d);
};

// Events shown on timeline bar (excluding baseline)
const TIMELINE_EVENTS = EVENTS.filter(e => e.id !== 'baseline');
const DAY_MARKERS = getDayMarkers();

export default function Timeline({ currentDate, currentDatetime, isPlaying, onDateChange, onEventSelect, onPlay, onPause }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  // Use full datetime for sub-day scrubber precision when available
  const pct = dateToPercent(currentDatetime || currentDate);

  // ── Drag handling ──────────────────────────────────────────────────────────
  const pctFromEvent = useCallback((e) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handleTrackPointerDown = useCallback((e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDateChange(percentToDate(pctFromEvent(e)));
  }, [onDateChange, pctFromEvent]);

  const handleTrackPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    onDateChange(percentToDate(pctFromEvent(e)));
  }, [onDateChange, pctFromEvent]);

  const handleTrackPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className={styles.root}>
      {/* ── Top row: date display + controls ── */}
      <div className={styles.controls}>
        <button
          className={styles.playBtn}
          onClick={isPlaying ? onPause : onPlay}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span className={styles.dateDisplay}>
          {currentDatetime ? formatDatetime(currentDatetime) : formatDate(currentDate)}
        </span>

        <span className={styles.range}>
          {formatDate(TIMELINE_START)}
          <span className={styles.rangeSep}>→</span>
          {formatDate(TIMELINE_END)}
        </span>
      </div>

      {/* ── Scrubber track ── */}
      <div className={styles.trackWrap}>
        {/* Filled progress bar */}
        <div
          ref={trackRef}
          className={styles.track}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
        >
          <div className={styles.fill} style={{ width: `${pct}%` }} />

          {/* Day marker dots */}
          {DAY_MARKERS.map(day => (
            <button
              key={day}
              className={styles.dayDot}
              style={{ left: `${dateToPercent(day)}%` }}
              title={formatDate(day)}
              onPointerDown={(e) => { e.stopPropagation(); onDateChange(day); }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}

          {/* Thumb */}
          <div className={styles.thumb} style={{ left: `${pct}%` }} />

          {/* Event markers */}
          {TIMELINE_EVENTS.map(evt => {
            const evtPct = dateToPercent(evt.date);
            const isActive = evt.date === currentDate;
            return (
              <button
                key={evt.id}
                className={`${styles.eventDot} ${isActive ? styles.eventDotActive : ''}`}
                style={{
                  left: `${evtPct}%`,
                  '--dot-color': SEVERITY_COLOR[evt.severity] || '#64748b',
                }}
                title={`${formatDate(evt.date)} — ${evt.title}`}
                onClick={(e) => { e.stopPropagation(); onEventSelect(evt); }}
              />
            );
          })}
        </div>
      </div>

      {/* ── Event labels row (only visible events near current date) ── */}
      <div className={styles.labelsRow}>
        {TIMELINE_EVENTS.map(evt => {
          const evtPct = dateToPercent(evt.date);
          const dist = Math.abs(evtPct - pct);
          if (dist > 8) return null; // only show nearby event titles
          return (
            <div
              key={evt.id}
              className={styles.nearLabel}
              style={{ left: `${evtPct}%` }}
            >
              {evt.title}
            </div>
          );
        })}
      </div>
    </div>
  );
}
