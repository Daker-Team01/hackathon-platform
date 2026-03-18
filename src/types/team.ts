export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

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

export interface Team {
  teamCode: string
  authorId: string
  hackathonSlug?: string
  name: string
  intro: string
  isOpen: boolean
  memberCount: number
  members: TeamMember[]
  lookingFor: string[]
  contact: {
    type: string
    url: string
  }
  createdAt: string
}
