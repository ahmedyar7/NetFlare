import { useState, useEffect } from "react";

const WS_URL = "ws://localhost:8000/ws";

export function useLiveEvents() {
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      try {
        setLatestEvent(JSON.parse(e.data));
      } catch (error) {
        console.warn("Non-JSON WebSocket message:", e.data);
      }
    };

    ws.onclose = () => console.log("WebSocket Closed");

    return () => ws.close(); // cleanup environment
  }, []);

  return latestEvent;
}
