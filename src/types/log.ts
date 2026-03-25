export type EventType =
  | 'hackathon_view'
  | 'hackathon_join'
  | 'team_create'
  | 'team_join'
  | 'submit_project'

export type TargetType = 'hackathon' | 'team'

export interface EventLog {
  id: string
  user_id: string | null
  nickname: string | null
  action_type: EventType
  target_id: string
  page_url: string
  metadata?: Record<string, any>
  created_at: string
}

export const LOG_MODULE = true
