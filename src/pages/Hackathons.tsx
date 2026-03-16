import { useHackathons } from '../hooks/useHackathons'
import HackathonCard from '../components/HackathonCard'

export default function Hackathons(){

 const {data,isLoading} = useHackathons()

 if(isLoading) return <div>loading...</div>

 return (
  <div>

   <h1>Hackathons</h1>

   {data.map((h:any)=> (
    <HackathonCard key={h.id} hackathon={h}/>
   ))}

  </div>
 )

}