export interface Team {
  teamCode: string
  hackathonSlug?: string
  authorId?: string
  name: string
  intro: string
  isOpen: boolean
  memberCount: number
  lookingFor: string[]
  contact: {
    type: string
    url: string
  }
  createdAt: string
}
