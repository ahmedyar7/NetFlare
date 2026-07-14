import GlobeView from "./components/GlobeView";
import { useAttack } from "./hooks/useAttacks";

export default function App(){
  
  const points = useAttack();

  return <GlobeView points={points}/>;
}