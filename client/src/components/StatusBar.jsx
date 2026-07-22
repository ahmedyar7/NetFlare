import { useEffect, useRef, useState } from "react";
import { enableAudio, disableAudio } from "../audio/threatAudio";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tweens a number toward `target` with rAF. Snaps instantly under reduced motion.
function useCountUp(target, duration = 500) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

function StatCell({ label, value, accent = false }) {
  return (
    <div className="stat-cell">
      <span className="stat-label">{label}</span>
      <span className={accent ? "stat-value is-accent" : "stat-value"}>
        {value}
      </span>
    </div>
  );
}

// Five-segment gauge; filled segments and colour come from the rolling
// average of recent abuse scores.
function ThreatGauge({ threat }) {
  const { label, segments, tone } = threat;

  return (
    <div className={`threat threat-${tone}`}>
      <span className="stat-label">Threat Level</span>
      <div className="threat-row">
        <div
          className="threat-bars"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={segments}
          aria-label={`Threat level ${label}`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= segments ? "bar is-lit" : "bar"} />
          ))}
        </div>
        <span className="threat-label">{label}</span>
      </div>
    </div>
  );
}

export default function StatusBar({
  trackedIps = 0,
  sessionEvents = 0,
  topOrigin,
  threat = { label: "STANDBY", segments: 0, tone: "idle" },
  onAudioChange,
}) {
  const tracked = useCountUp(trackedIps);
  const events = useCountUp(sessionEvents);
  const [sound, setSound] = useState(false);

  // Browsers only allow an AudioContext to start from a user gesture, so the
  // click that flips this toggle is also what unlocks playback.
  const toggleSound = async () => {
    if (sound) {
      disableAudio();
      setSound(false);
      onAudioChange?.(false);
      return;
    }
    const ok = await enableAudio();
    setSound(ok);
    onAudioChange?.(ok);
  };

  return (
    <header className="statusbar">
      <div className="statusbar-left">
        <span className="wordmark">NETFLARE</span>
        <span className="system-status">SYSTEM: MONITORING</span>
      </div>

      <div className="statusbar-right">
        <ThreatGauge threat={threat} />
        <StatCell label="Tracked IPs" value={tracked.toLocaleString()} />
        <StatCell label="Events / Session" value={events.toLocaleString()} />
        <StatCell label="Top Origin" value={topOrigin || "—"} accent />

        <button
          type="button"
          className={sound ? "sound-toggle is-on" : "sound-toggle"}
          onClick={toggleSound}
          aria-pressed={sound}
          title="Audio alerts on arc launch and impact"
        >
          {sound ? "SOUND: ON" : "SOUND: OFF"}
        </button>
      </div>
    </header>
  );
}
