import { useQuery } from '@tanstack/react-query'
import { getHackathons } from '../api/hackathonApi'

export const useHackathons = () => {
  return useQuery({
    queryKey: ['hackathons'],
    queryFn: getHackathons
  })
}