import { useState, useEffect } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

export function useLiveEvents() {
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    let ws;
    let retry;
    let stopped = false;

    function connect() {
      if (stopped) return;

      ws = new WebSocket(WS_URL);

      ws.onmessage = (e) => {
        try {
          setLatestEvent(JSON.parse(e.data));
        } catch {
          console.warn("Non-JSON WebSocket message:", e.data);
        }
      };

      ws.onclose = () => {
        if (!stopped) {
          retry = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retry);

      if (!ws) return;

      // Don't let our own teardown trigger a reconnect.
      ws.onclose = null;

      // Closing mid-handshake makes the browser log an error, so if the socket
      // hasn't finished connecting yet, wait until it has.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
    };
  }, []);

  return latestEvent;
}
