import { useState, useEffect } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

export function useLiveEvents() {
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    let ws;
    let stopped = false;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (e) => {
        try {
          setLatestEvent(JSON.parse(e.data));
        } catch (error) {
          console.warn("Non-JSON WebSocket message:", e.data);
        }
      };

      ws.onclose = () => {
        if (!stopped) {
          setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      ws.close();
    };
  }, []);

  return latestEvent;
}
