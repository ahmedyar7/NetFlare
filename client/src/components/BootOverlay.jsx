import { useEffect, useState } from "react";

const LINES = [
  "ESTABLISHING UPLINK",
  "LOADING THREAT GRID",
  "SYNCING GLOBAL FEED",
];

/**
 * Covers the cold-load gap while the globe texture streams in, so the first
 * paint reads as a deliberate boot rather than an empty canvas.
 * `done` flips when the globe reports ready; we then fade out and unmount.
 */
export default function BootOverlay({ done }) {
  const [hidden, setHidden] = useState(false);
  const [step, setStep] = useState(0);

  // Advance the status line while we wait.
  useEffect(() => {
    if (done) return;
    const id = setInterval(
      () => setStep((s) => (s + 1) % LINES.length),
      700,
    );
    return () => clearInterval(id);
  }, [done]);

  // Let the fade play out before removing from the tree.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setHidden(true), 600);
    return () => clearTimeout(id);
  }, [done]);

  if (hidden) return null;

  return (
    <div className={done ? "boot is-done" : "boot"} aria-hidden={done}>
      <div className="boot-inner">
        <span className="boot-mark">NETFLARE</span>
        <span className="boot-line">{LINES[step]}…</span>
        <div className="boot-track">
          <div className="boot-fill" />
        </div>
      </div>
    </div>
  );
}
