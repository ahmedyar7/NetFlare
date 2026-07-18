import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useTrends() {
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    fetch(`${API}/trends`)
      .then((res) => res.json())
      .then((data) => {
        setTrends(data);
      })
      .catch((err) => console.error("Failed to load trends: ", err));
  }, []);

  return trends;
}
