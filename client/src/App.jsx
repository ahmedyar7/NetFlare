import { useEffect, useState } from "react";
import GlobeView from "./components/GlobeView";

// hooks
import { useAttack } from "./hooks/useAttacks";
import { useLiveEvents } from "./hooks/useLiveEvents";
import { useTrends } from "./hooks/useTrends";
import TrendsPanel from "./components/TrendsPanel";
import Ticker from "./components/Ticker";
import StatusBar from "./components/StatusBar";
import { playLaunch, playImpact } from "./audio/threatAudio";

const jitter = () => (Math.random() - 0.5) * 0.8;

// Matches arcDashAnimateTime in GlobeView: when the dash reaches the target.
const ARC_TRAVEL_MS = 1500;

export default function App() {
  const initialPoints = useAttack();
  const liveEvents = useLiveEvents();
  const trends = useTrends();

  const [livePoints, setLivePoints] = useState([]);
  const [rings, setRings] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [sessionEvents, setSessionEvents] = useState(0);

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

    setLivePoints((prev) => [...prev, point]);

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
    };

    setArcs((prev) => [...prev, arc]);
    setTimeout(() => setArcs((prev) => prev.filter((a) => a !== arc)), 4000);

    // Audio follows the arc: blip on dispatch, impact when it lands.
    // No-ops unless the user has switched sound on in the status bar.
    playLaunch();
    setTimeout(() => playImpact(point.score), ARC_TRAVEL_MS);
  }, [liveEvents]);


  const points = [...initialPoints, ...livePoints];
  const topOrigin = trends?.l7_top_origin?.data?.top_0?.[0]?.originCountryAlpha2;

  return (
    <div className="app">
      <StatusBar
        trackedIps={points.length}
        sessionEvents={sessionEvents}
        topOrigin={topOrigin}
      />
      <div className="globe-stage">
        <GlobeView points={points} rings={rings} arcs={arcs} />
      </div>
      <div className="overlay">
        <TrendsPanel />
        <Ticker liveEvent={liveEvents} />
      </div>
    </div>
  );
}
