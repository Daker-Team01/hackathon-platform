export type Hackathon = {
  slug: string
  title: string
  location?: string
  status: string
  tags: string[]
  thumbnailUrl: string
  period: {
    timezone: string
    submissionDeadlineAt: string
    endAt: string
  }
  links: {
    detail: string
    rules: string
    faq: string
  }
}
