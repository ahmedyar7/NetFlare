import { useEffect, useState } from "react";
import GlobeView from "./components/GlobeView";

// hooks
import { useAttack } from "./hooks/useAttacks";
import { useLiveEvents } from "./hooks/useLiveEvents";
import { useTrends } from "./hooks/useTrends";
import TrendsPanel from "./components/TrendsPanel";
import Ticker from "./components/Ticker";
import StatusBar from "./components/StatusBar";
import BootOverlay from "./components/BootOverlay";
import Legend from "./components/Legend";
import { playLaunch, playImpact } from "./audio/threatAudio";

const jitter = () => (Math.random() - 0.5) * 0.8;

// Matches arcDashAnimateTime in GlobeView: when the dash reaches the target.
const ARC_TRAVEL_MS = 1500;

// Cap the live layer so a long-running session doesn't accumulate geometry
// forever and drag the frame rate down.
const MAX_LIVE_POINTS = 150;

// Rolling window of scores the threat gauge averages over.
const THREAT_WINDOW = 20;

// AbuseIPDB only returns scores >= 75, so the ramp is tuned to that range.
const threatLevel = (scores) => {
  if (!scores.length) return { label: "STANDBY", segments: 0, tone: "idle" };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg >= 95) return { label: "CRITICAL", segments: 5, tone: "critical" };
  if (avg >= 90) return { label: "HIGH", segments: 4, tone: "high" };
  if (avg >= 85) return { label: "ELEVATED", segments: 3, tone: "elevated" };
  if (avg >= 80) return { label: "GUARDED", segments: 2, tone: "guarded" };
  return { label: "LOW", segments: 1, tone: "low" };
};

export default function App() {
  const initialPoints = useAttack();
  const liveEvents = useLiveEvents();
  const trends = useTrends();

  const [livePoints, setLivePoints] = useState([]);
  const [rings, setRings] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [sessionEvents, setSessionEvents] = useState(0);

  // Selected attack: drives the globe fly-to and the ticker row highlight.
  const [focus, setFocus] = useState(null);
  const [selectedIp, setSelectedIp] = useState(null);

  // Boot overlay stays up until the globe texture has actually loaded.
  const [globeReady, setGlobeReady] = useState(false);

  // Rolling scores feeding the status-bar threat gauge.
  const [recentScores, setRecentScores] = useState([]);

  const selectAttack = (d) => {
    if (!d) return;
    setFocus({ lat: d.lat, lng: d.lng });
    setSelectedIp(d.ip ?? null);
  };

  useEffect(() => {
    if (!liveEvents) {
      return;
    }

    setSessionEvents((n) => n + 1);

    const point = {
      ...liveEvents,
      lat: liveEvents.lat + jitter(),
      lng: liveEvents.lng + jitter(),
    };

    // Keep only the most recent points; unbounded growth degrades the globe.
    setLivePoints((prev) => [...prev, point].slice(-MAX_LIVE_POINTS));
    setRecentScores((prev) =>
      [...prev, Number(point.score)].slice(-THREAT_WINDOW),
    );

    // Ripple ring at edge location
    // removed after 3 second

    const ring = {
      lat: point.lat,
      lng: point.lng,
    };

    setRings((prev) => [...prev, ring]);
    setTimeout(() => setRings((prev) => prev.filter((r) => r !== ring)), 3000);

    // arc form a random origin to the events after 4 second.

    const arc = {
      startLat: (Math.random() - 0.5) * 140,
      startLng: (Math.random() - 0.5) * 360,
      endLat: point.lat,
      endLng: point.lng,
      score: point.score,
    };

    setArcs((prev) => [...prev, arc]);
    // 4500 = 3 x arcDashAnimateTime, so the arc is culled at a clean
    // dash seam instead of vanishing mid-flight.
    setTimeout(() => setArcs((prev) => prev.filter((a) => a !== arc)), 4500);

    // Audio follows the arc: blip on dispatch, impact when it lands.
    // No-ops unless the user has switched sound on in the status bar.
    playLaunch();
    setTimeout(() => playImpact(point.score), ARC_TRAVEL_MS);
  }, [liveEvents]);

  const points = [...initialPoints, ...livePoints];
  const topOrigin =
    trends?.l7_top_origin?.data?.top_0?.[0]?.originCountryAlpha2;
  const threat = threatLevel(recentScores);

  return (
    <div className="app">
      <BootOverlay done={globeReady} />
      <StatusBar
        trackedIps={points.length}
        sessionEvents={sessionEvents}
        topOrigin={topOrigin}
        threat={threat}
      />
      <div className="globe-stage">
        <GlobeView
          points={points}
          rings={rings}
          arcs={arcs}
          focus={focus}
          onPointClick={selectAttack}
          onReady={() => setGlobeReady(true)}
        />
        <Legend />
      </div>
      <div className="overlay">
        <TrendsPanel />
        <Ticker
          liveEvent={liveEvents}
          onSelect={selectAttack}
          selectedIp={selectedIp}
        />
      </div>
    </div>
  );
}
