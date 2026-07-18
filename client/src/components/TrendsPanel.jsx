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

const GRID = "#1e2a44";
const TEXT_DIM = "#6b7a99";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: "rgba(10, 14, 23, 0.95)",
      borderColor: GRID,
      borderWidth: 1,
      titleFont: { family: MONO, size: 10 },
      bodyFont: { family: MONO, size: 11 },
      displayColors: false,
    },
  },
  scales: {
    x: {
      ticks: {
        color: TEXT_DIM,
        maxTickLimit: 6,
        font: { family: MONO, size: 9 },
      },
      grid: {
        color: GRID,
      },
      border: { color: GRID },
    },

    y: {
      ticks: {
        color: TEXT_DIM,
        font: { family: MONO, size: 9 },
      },
      grid: {
        color: GRID,
      },
      border: { color: GRID },
    },
  },
};

export default function TrendsPanel() {
  const trends = useTrends();
  if (!trends) {
    return (
      <div className="panel">
        <h2 className="panel-title">Global Attack Trends</h2>
        <p className="eyebrow">Acquiring feed…</p>
      </div>
    );
  }

  const ts = trends.l7_timeseries?.data?.serie_0;
  const origins = trends.l7_top_origin?.data?.top_0;
  const targets = trends.l7_top_target?.data?.top_0;

  return (
    <div className="panel">
      <h2 className="panel-title">Global Attack Trends</h2>

      {ts && (
        <section>
          <h3 className="eyebrow">THREAT ACTIVITY // L7</h3>
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
        </section>
      )}

      {origins && (
        <section>
          <h3 className="eyebrow">ORIGIN NODES</h3>
          <Bar
            options={{ ...chartOptions, indexAxis: "y" }}
            data={{
              labels: origins.map((o) => o.originCountryAlpha2),
              datasets: [
                {
                  data: origins.map((o) => Number(o.value)),
                  backgroundColor: "#ffaa00",
                },
              ],
            }}
          />
        </section>
      )}

      {targets && (
        <section>
          <h3 className="eyebrow">TARGET NODES</h3>
          <Bar
            options={{ ...chartOptions, indexAxis: "y" }}
            data={{
              labels: targets.map((o) => o.targetCountryAlpha2),
              datasets: [
                {
                  data: targets.map((o) => Number(o.value)),
                  backgroundColor: "#ff4444",
                },
              ],
            }}
          />
        </section>
      )}
    </div>
  );
}
