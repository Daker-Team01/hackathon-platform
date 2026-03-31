import usersData from '../data/user_dummy_v2.json'

export const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export const buildSearchOptions = (values: string[]) =>
  Array.from(
    new Map(values.map((value) => [value.trim().toLowerCase(), value.trim()])).values()
  ).filter(Boolean)

export const TECH_STACK_OPTIONS = [
  'React',
  'Vue',
  'Angular',
  'TypeScript',
  'Python',
  'Java',
  'Node.js',
  'Django',
  'FastAPI',
  'PyTorch',
  'NLP',
  'PostgreSQL',
  'MongoDB',
  'GraphQL',
  'Docker',
  'AWS',
  'GCP',
  'Kubernetes',
  'UI/UX',
  'Mobile',
  'DevOps'
]

export const ALL_TECH_STACK_OPTIONS = buildSearchOptions([
  ...TECH_STACK_OPTIONS,
  ...usersData.flatMap((user) => normalizeStringArray(user.skills)),
])