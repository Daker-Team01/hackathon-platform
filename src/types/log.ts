export type EventType =
  | 'hackathon_view'
  | 'hackathon_join'
  | 'team_create'
  | 'team_join'
  | 'submit_project'

export type TargetType = 'hackathon' | 'team'

export interface EventLog {
  id: string
  userId: string | null
  eventType: EventType
  targetType: TargetType
  targetId: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export const LOG_MODULE = true
