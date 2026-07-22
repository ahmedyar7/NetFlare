import { useState, useEffect } from "react";

// FastAPI Endpoint
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Jitter is added so that it could have some form of offset
// that would be useful so that the markers don't stacks up

const jitter = () => (Math.random() - 0.5) * 0.8;

export function useAttack() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    fetch(`${API}/attacks`)
      .then((res) => res.json())
      .then((data) => {
        setPoints(
          data.map((d) => ({
            ...d,
            lat: d.lat + jitter(),
            lng: d.lng + jitter(),
          })),
        );
      })
      .catch((err) => console.error("Failed to load error: ", err));
  }, []);

  return points;
}
