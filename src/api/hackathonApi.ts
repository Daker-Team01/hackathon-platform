import axios from 'axios'

export const getHackathons = async () => {
  const res = await axios.get('/api/hackathons')
  return res.data
}

export const getHackathon = async (slug: string) => {
  const res = await axios.get(`/api/hackathons/${slug}`)
  return res.data
}