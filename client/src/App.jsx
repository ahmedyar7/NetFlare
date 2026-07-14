import { useEffect, useState } from "react";
import GlobeView from "./components/GlobeView";

// hooks
import { useAttack } from "./hooks/useAttacks";
import { useLiveEvents } from "./hooks/useLiveEvents";

const jitter = () => (Math.random() - 0.5) * 0.8;


export default function App(){

  const initialPoints = useAttack();
  const liveEvents = useLiveEvents();

  const [livePoints, setLivePoints] = useState([]);
  const [rings, setRings] = useState([]);
  const [arcs, setArcs] = useState([]);

  useEffect(()=>{

    if(!liveEvents){
      return;
    }

    const point = {
      ...liveEvents,
      lat: liveEvents.lat + jitter(),
      lng : liveEvents.lng + jitter()
    }

    setLivePoints((prev)=>[...prev, point]);

    // Ripple ring at edge location
    // removed after 3 second

    const ring = {
      lat: point.lat,
      lng : point.lng
    }

    setRings((prev)=>[...prev, ring]);
    setTimeout(()=>setRings(
      (prev)=>prev.filter((r)=>r!=ring),
      3000
    ));

    // arc form a random origin to the events after 4 second.

    const arc = {
      startLat: (Math.random()-0.5) * 140,
      startLng: (Math.random()-0.5) * 360,
      endLat: point.lat,
      endLng: point.lng
    }

    setArcs((prev)=>[...prev, arc])
    setTimeout(() => setArcs((prev)=>prev.filter((a)=>a!==arc)), 4000);

  }, [liveEvents])

  return <GlobeView 
  points={[...initialPoints, ...livePoints]}
  rings={rings}
  arcs={arcs}

  />;
}