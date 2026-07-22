// Explains the amber -> orange -> red ramp used by points, arcs and ticker
// scores. Thresholds mirror scoreColor() in GlobeView.
const STOPS = [
  { color: "#ffaa00", label: "LOW", range: "75–87" },
  { color: "#ff7733", label: "ELEVATED", range: "88–94" },
  { color: "#ff4444", label: "CRITICAL", range: "95+" },
];

export default function Legend() {
  return (
    <div className="legend">
      <span className="legend-title">ABUSE SCORE</span>
      {STOPS.map((s) => (
        <span className="legend-item" key={s.label}>
          <i className="legend-swatch" style={{ background: s.color }} />
          {s.label}
          <em className="legend-range">{s.range}</em>
        </span>
      ))}
    </div>
  );
}
