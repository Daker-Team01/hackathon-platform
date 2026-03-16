import { useParams } from 'react-router-dom'
import Overview from '../features/Overview'
import Schedule from '../features/Schedule'
import Prize from '../features/Prize'
import Teams from '../features/Teams'
import Submit from '../features/Submit'
import Leaderboard from '../features/Leaderboard'

export default function HackathonDetail(){

 const {slug} = useParams()

 return(

  <div>

   <h1>Hackathon Detail {slug}</h1>

   <Overview/>
   <Schedule/>
   <Prize/>
   <Teams/>
   <Submit/>
   <Leaderboard/>

  </div>

 )

}