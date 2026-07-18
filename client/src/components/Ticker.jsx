import { useState, useEffect, useRef } from "react";

const scoreClass = (score) => {
  if (score >= 95) return "score-high";
  if (score >= 88) return "score-mid";
  return "score-low";
};

export default function Ticker({ liveEvent, onSelect, selectedIp }) {
  const [events, setEvents] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!liveEvent) {
      return;
    }

    setEvents((prev) =>
      [
        {
          ...liveEvent,
          id: idRef.current++,
          time: new Date().toLocaleTimeString([], {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...prev,
      ].slice(0, 20),
    );
  }, [liveEvent]);

  return (
    <div className="ticker">
      <div className="ticker-head">
        <h3 className="eyebrow">Live Feed</h3>
        <span className="live-dot">LIVE</span>
      </div>

      {events.length === 0 && (
        <div className="ticker-empty muted">Awaiting telemetry…</div>
      )}

      {events.map((e, i) => (
        <div
          className={[
            "ticker-row",
            i === 0 ? "is-new" : "",
            e.score >= 95 ? "score-high-row" : "",
            e.ip === selectedIp ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={e.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect?.(e)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelect?.(e);
            }
          }}
        >
          <span className="time">{e.time}</span>
          <span className="country">{e.country}</span>
          <span className="ip">{e.ip}</span>
          <span className={`score ${scoreClass(e.score)}`}>{e.score}</span>
        </div>
      ))}
    </div>
  );
}
