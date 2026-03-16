export default function Leaderboard(){

 const data = [
  {rank:1,team:'A',score:95},
  {rank:2,team:'B',score:90}
 ]

 return (
  <table>

   <thead>
    <tr>
     <th>Rank</th>
     <th>Team</th>
     <th>Score</th>
    </tr>
   </thead>

   <tbody>

    {data.map((r)=> (
     <tr key={r.rank}>
      <td>{r.rank}</td>
      <td>{r.team}</td>
      <td>{r.score}</td>
     </tr>
    ))}

   </tbody>

  </table>
 )

}