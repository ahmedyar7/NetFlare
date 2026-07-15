import { Line, Bar } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler,
  scales,
} from "chart.js";

import { useTrends } from "../hooks/useTrends";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler,
);

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#8899bb",
        maxTickLimit: 6,
      },
      grid: {
        color: "#1a2340",
      },
    },

    y: {
      ticks: {
        color: "#8899bb",
      },
      grid: {
        color: "#1a2340",
      },
    },
  },
};

export default function TrendsPanel() {
  const trends = useTrends();
  if (!trends) {
    return <div className="panel">Loading Panel...</div>;
  }

  const ts = trends.l7_timeseries?.data?.serie_0;
  const origins = trends.l7_top_origin?.data?.top_0;

  return (
    <div className="panel">
      <h2>Global Attack Trends</h2>

      {ts && (
        <>
          <h3>L7 attack activity (24hr, relative)</h3>
          <Line
            options={chartOptions}
            data={{
              labels: ts.timestamps.map((t) =>
                new Date(t).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              ),

              datasets: [
                {
                  data: ts.values.map(Number),
                  borderColor: "#ff5533",
                  backgroundColor: "rgba(255, 85, 51, 0.15)",
                  fill: true,
                  pointRadius: 0,
                  tension: 0.3,
                },
              ],
            }}
          />
        </>
      )}

      {origins && (
        <>
          <h3>Top attacks Origin</h3>
          <Bar
            options={{ ...chartOptions, indexAxis: "y" }}
            data={{
              labels: origins.map(
                (o) => o.originCountryAlpha2 || o.originCountryAlpha2,
              ),
              datasets: [
                {
                  data: origins.map((o) => Number(o.value)),
                  backgroundColor: "#ffaa00",
                },
              ],
            }}
          />
        </>
      )}
    </div>
  );
}
