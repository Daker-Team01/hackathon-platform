export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELED';
export type TeamRequestType = 'JOIN' | 'LEAVE';
export type TeamRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface TeamMember {
  userId: string;
  userName: string;
  role: 'LEADER' | 'MEMBER';
  joinedAt: string;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  invitedUserId: string;
  invitedUserName: string;
  status: InviteStatus;
  createdAt: string;
}

export interface TeamRequest {
  id: string
  teamId: string
  teamName: string
  requestType: TeamRequestType
  requesterUserId: string
  requesterUserName: string
  status: TeamRequestStatus
  createdAt: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

export interface Team {
  teamCode: string
  leaderId: string
  hackathonSlug?: string
  name: string
  intro: string
  isOpen: boolean
  memberCount: number
  maxMembers: number
  members: TeamMember[]
  lookingFor: string[]
  tags?: string[]
  contact: {
    type: string
    url: string
  }
  createdAt: string
}
