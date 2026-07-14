import React, { useEffect, useRef } from "react";
import Globe from "react-globe.gl";


export default function GlobeView({points}){

    const globeRef = useRef();

    useEffect(()=>{
        
        // This would run after the globe component is mounted.
        const control = globeRef.current.controls();
        controls.autoRotate = true,
        controls.autoRotateSpeed = 0.5;

    }, [])

    return (
        <Globe
            ref={globeRef}
            globeImageUrl={"//unpkg.com/three-globe/example/img/earth-night.jpg"}
            backgroundColor="#000010"
            pointsData={points}
            pointLat='lat'
            pointLng='lng'
            pointColor={
                (d)=>(
                    d.score >= 90 ? "#ff3333" : "ffaa00"
                )
            }
            pointAltitude={0.01}
            pointRadius={0.4}
            pointLabel={
                (d)=>`${d.country} - score ${d.score}`
            }
        />
    );
    
}
