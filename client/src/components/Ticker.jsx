import { useState, useEffect } from "react";

export default function Ticker({ liveEvent }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!liveEvent) {
      return;
    }

    setEvents((prev) =>
      [{ ...liveEvent, time: new Date().toLocaleDateString() }, ...prev].slice(
        0,
        20,
      ),
    );
  }, [liveEvent]);

  return (
    <div className="ticker">
      <h3>Live Feed</h3>
      {events.length === 0 && (
        <div className="ticker-row muted">Waiting for events...</div>
      )}

      {events.map((e, i) => (
        <div className="ticker-row" key={`${e.ip}-${e.time}-${i}`}>
            <span className="time">{e.time}</span>
            <span className="country">{e.country}</span>
            <span className="ip">{e.ip}</span>
            <span className="score">{e.score}</span>
        </div>
      ))}
    </div>
  );
}
