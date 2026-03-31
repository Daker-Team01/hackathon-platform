export type EventType =
  | 'page_view'
  | 'card_click'
  | 'recommendation_impression'
  | 'recommendation_click'
  | 'chatbot_query'
  | 'chatbot_response'
  | 'hackathon_view'
  | 'hackathon_join'
  | 'hackathon_filter'
  | 'hackathon_interest_toggle'
  | 'tab_view'
  | 'matcher_profile_select'
  | 'matcher_filter'
  | 'team_filter'
  | 'team_detail_open'
  | 'team_detail_close'
  | 'team_detail_dwell'
  | 'team_create'
  | 'team_create_attempt'
  | 'team_join'
  | 'team_request_create'
  | 'team_request_cancel'
  | 'team_request_review'
  | 'team_request_result'
  | 'invite_response'
  | 'invite_send'
  | 'invite_cancel'
  | 'team_member_kick'
  | 'team_member_role_update'
  | 'team_notice_send'
  | 'team_recruit_toggle'
  | 'api_error'
  | 'submit_project'

export type TargetType = 'hackathon' | 'team' | 'user' | 'page' | 'chatbot'

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
