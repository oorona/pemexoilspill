import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './components/Map.jsx';
import Timeline from './components/Timeline.jsx';
import EventCard from './components/EventCard.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import Header from './components/Header.jsx';
import { EVENTS, TIMELINE_START, TIMELINE_END, nextHour, getActiveEventForDate } from './data/events.js';
import styles from './App.module.css';

const PLAY_INTERVAL_MS = 125; // ms per 1-hour step → 3 seconds per day

export default function App() {
  // Full ISO datetime for sub-day vessel interpolation; derive date-only where needed
  const [currentDatetime, setCurrentDatetime] = useState(TIMELINE_START + 'T00:00:00Z');
  const currentDate = currentDatetime.slice(0, 10); // 'YYYY-MM-DD' for tiles/events/cerulean
  const [activeEvent, setActiveEvent]   = useState(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [showInfo, setShowInfo]         = useState(false);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [eventsOverlayOn, setEventsOverlayOn] = useState(true);

  const intervalRef = useRef(null);
  const eventDismissRef = useRef(null);

  // ── Auto-replay ──────────────────────────────────────────────────────────
  const stopPlay = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsPlaying(false);
  }, []);

  const startPlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    intervalRef.current = setInterval(() => {
      setCurrentDatetime(prev => {
        if (prev.slice(0, 10) >= TIMELINE_END) { stopPlay(); return prev; }
        return nextHour(prev, 1);
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, stopPlay]);

  // ── Auto-dismiss event card after 5 seconds ──────────────────────────────
  const showEventBriefly = useCallback((evt) => {
    clearTimeout(eventDismissRef.current);
    setActiveEvent(evt);
    eventDismissRef.current = setTimeout(() => setActiveEvent(null), 5000);
  }, []);

  // ── Sync active event with current date ──────────────────────────────────
  useEffect(() => {
    const exact = EVENTS.find(e => e.date === currentDate && e.id !== 'baseline');
    if (exact) showEventBriefly(exact);
  }, [currentDate, showEventBriefly]);

  const handleTimelineChange = useCallback((date) => {
    stopPlay();
    setCurrentDatetime(date + 'T00:00:00Z');
    setActiveEvent(null);
  }, [stopPlay]);

  const handleEventSelect = useCallback((event) => {
    stopPlay();
    setCurrentDatetime(event.date + 'T00:00:00Z');
    showEventBriefly(event);
  }, [stopPlay, showEventBriefly]);

  const handleCloseEventCard = useCallback(() => {
    clearTimeout(eventDismissRef.current);
    setActiveEvent(null);
  }, []);

  const handleVesselClick = useCallback((vessel) => {
    setSelectedVessel(vessel);
    stopPlay();
  }, [stopPlay]);

  const handleCloseVesselCard = useCallback(() => {
    setSelectedVessel(null);
  }, []);

  const handleEventsOverlayChange = useCallback((isOn) => {
    setEventsOverlayOn(isOn);
    if (!isOn) {
      setActiveEvent(null);
    }
  }, []);

  return (
    <div className={styles.layout}>
      {/* Full-screen map — renders first for fastest perceived load */}
      <MapView
        currentDate={currentDate}
        currentDatetime={currentDatetime}
        activeEvent={activeEvent}
        onVesselClick={handleVesselClick}
        onEventSelect={handleEventSelect}
        onEventsOverlayChange={handleEventsOverlayChange}
      />

      {/* Floating header */}
      <Header onToggleInfo={() => setShowInfo(v => !v)} showInfo={showInfo} />

      {/* Event detail card */}
      {eventsOverlayOn && activeEvent && (
        <EventCard event={activeEvent} onClose={handleCloseEventCard} isPlaying={isPlaying} onPause={stopPlay} onPlay={startPlay} />
      )}

      {/* Vessel detail card — always visible on click, independent of events overlay */}
      {selectedVessel && (
        <EventCard
          event={{
            title: selectedVessel.name,
            subtitle: selectedVessel.vesselType || selectedVessel.type,
            description: selectedVessel.description,
            date: currentDate,
            sources: selectedVessel.mmsi
              ? [{ label: `MyShipTracking IMO ${selectedVessel.imo}`, url: `https://myshiptracking.com/vessels/arbol-grande-mmsi-${selectedVessel.mmsi}-imo-${selectedVessel.imo}` }]
              : [],
            severity: selectedVessel.type === 'primary' ? 'critical' : 'medium',
          }}
          onClose={handleCloseVesselCard}
          isVessel
          isPlaying={isPlaying}
          onPause={stopPlay}
          onPlay={startPlay}
        />
      )}

      {/* Slide-in report panel */}
      <InfoPanel visible={showInfo} onClose={() => setShowInfo(false)} />

      {/* Timeline scrubber */}
      <Timeline
        currentDate={currentDate}
        currentDatetime={currentDatetime}
        isPlaying={isPlaying}
        onDateChange={handleTimelineChange}
        onEventSelect={handleEventSelect}
        onPlay={startPlay}
        onPause={stopPlay}
      />
    </div>
  );
}
