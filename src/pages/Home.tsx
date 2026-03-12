import { useNavigate } from 'react-router-dom'

export default function Home(){

 const navigate = useNavigate()

 return (
  <div>

   <h1>Hackathon Platform</h1>

   <button onClick={()=>navigate('/hackathons')}>
   해커톤 보기
   </button>

   <button onClick={()=>navigate('/camp')}>
   팀 찾기
   </button>

   <button onClick={()=>navigate('/rankings')}>
   랭킹 보기
   </button>

  </div>
 )

}