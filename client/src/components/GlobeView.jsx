import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";

// Threat ramp: amber -> orange -> red as the score climbs.
const scoreColor = (score) => {
  if (score >= 95) return "#ff4444";
  if (score >= 88) return "#ff7733";
  return "#ffaa00";
};

export default function GlobeView({ points, rings = [], arcs = [] }) {
  const globeRef = useRef();
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // This would run after the globe component is mounted.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const controls = globeRef.current.controls();
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.5;
  }, []);

  // Keep the canvas matched to its container so CSS owns the layout.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      <Globe
        ref={globeRef}
        width={size.width || undefined}
        height={size.height || undefined}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="#0a0e17"
        // --- Atmosphere --- //

        showAtmosphere={true}
        atmosphereColor="#3a6ea5"
        atmosphereAltitude={0.15}
        // --- Points data --- //

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => scoreColor(d.score)}
        pointAltitude={0.01}
        pointRadius={0.4}
        pointLabel={(d) => `${d.country} - score ${d.score}`}
        // --- Ring Data --- //

        ringsData={rings}
        ringColor={() => (t) => `rgba(255,60,60,${1 - t})`}
        ringMaxRadius={4}
        ringPropagationSpeed={2}
        ringRepeatPeriod={600}
        // --- Arc Data --- //

        arcsData={arcs}
        arcColor={() => "#ff5533"}
        arcDashAnimateTime={1500}
        arcDashLength={0.5}
        arcDashGap={1}
        arcStroke={0.5}
      />
    </div>
  );
}
