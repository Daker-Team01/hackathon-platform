export type EventType =
  | 'hackathon_view'
  | 'hackathon_join'
  | 'hackathon_filter'
  | 'hackathon_interest_toggle'
  | 'tab_view'
  | 'matcher_profile_select'
  | 'matcher_filter'
  | 'team_create'
  | 'team_join'
  | 'submit_project'

export type TargetType = 'hackathon' | 'team' | 'user'

export interface EventLog {
  id: string
  user_id: string | null
  nickname: string | null
  action_type: EventType
  target_id: string
  page_url: string
  metadata?: Record<string, string | number | boolean | null | Array<string | number | boolean> | Record<string, unknown>>
  created_at: string
}

export const LOG_MODULE = true
