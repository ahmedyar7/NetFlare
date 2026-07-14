import React, { useEffect, useRef } from "react";
import Globe from "react-globe.gl";


export default function GlobeView({points , rings=[], arcs=[]}){

    const globeRef = useRef();

    useEffect(()=>{
        
        // This would run after the globe component is mounted.
        const controls = globeRef.current.controls();
        controls.autoRotate = true,
        controls.autoRotateSpeed = 0.5;

    }, [])

    return (
        <Globe
            ref={globeRef}
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundColor="#000010"
            
            // --- Points data --- //
            
            pointsData={points}
            pointLat='lat'
            pointLng='lng'
            
            pointColor={
                (d)=>(
                    d.score >= 90 ? "#ff3333" : "#ffaa00"
                )
            }

            pointAltitude={0.01}
            pointRadius={0.4}
            
            pointLabel={
                (d)=>`${d.country} - score ${d.score}`
            }

            // --- Ring Data --- //
            
            ringsData={rings}
            ringColor={() => (t) => `rgba(255,60,60,${1 - t})`}
            ringMaxRadius={4}
            ringPropagationSpeed={2}
            ringRepeatPeriod={600}
            
            
            // --- Arc Data --- //

            arcsData={arcs}
            arcColor={()=>"#ff5533"}
            arcDashAnimateTime={1500}
            arcDashLength={0.5}
            arcDashGap={1}
            arcStroke={0.5}


        />
    );
    
}
