import { useState, useEffect } from "react";

const API = "https://localhost:8000";

export function useTrends() {
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    fetch(`${API}/trends`)
      .then((res) => res.json())
      .then(setTrends)
      .catch((err) => console.error("Failed to load trends: ", err));
  }, []);
}
