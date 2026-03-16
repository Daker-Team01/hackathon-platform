import { useNavigate } from 'react-router-dom'

export default function Home(){

 const navigate = useNavigate()

 return (
  <div style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>

   <h1>Hackathon Platform</h1>

   <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
     <button 
       onClick={()=>navigate('/hackathons')}
       style={{
         padding: '12px 24px',
         fontSize: 16,
         cursor: 'pointer',
         backgroundColor: '#4f46e5',
         color: 'white',
         border: 'none',
         borderRadius: 6
       }}
     >
       해커톤 보기
     </button>

     <button 
       onClick={()=>navigate('/camp')}
       style={{
         padding: '12px 24px',
         fontSize: 16,
         cursor: 'pointer',
         backgroundColor: '#4f46e5',
         color: 'white',
         border: 'none',
         borderRadius: 6
       }}
     >
       팀 찾기
     </button>

     <button 
       onClick={()=>navigate('/rankings')}
       style={{
         padding: '12px 24px',
         fontSize: 16,
         cursor: 'pointer',
         backgroundColor: '#4f46e5',
         color: 'white',
         border: 'none',
         borderRadius: 6
       }}
     >
       랭킹 보기
     </button>

     <button 
       onClick={()=>navigate('/analytics')}
       style={{
         padding: '12px 24px',
         fontSize: 16,
         cursor: 'pointer',
         backgroundColor: '#4f46e5',
         color: 'white',
         border: 'none',
         borderRadius: 6
       }}
     >
       분석
     </button>
   </div>

  </div>
 )

}