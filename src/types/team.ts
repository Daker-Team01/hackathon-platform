export interface Team {
  id: string
  hackathonSlug?: string
  name: string
  description: string
  isOpen: boolean
  lookingFor: string[]
  contactUrl: string
  createdAt: string
}