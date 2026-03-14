import type { Team } from "../types/team"

export const mockTeams: Team[] = [
  {
    id: "1",
    hackathonSlug: "kakao-ai-hackathon",
    name: "AI Wizards",
    description: "AI 기반 해커톤 플랫폼 개발 팀입니다.",
    isOpen: true,
    lookingFor: ["Frontend", "Backend"],
    contactUrl: "https://open.kakao.com/o/abc123",
    createdAt: "2026-03-12"
  },
  {
    id: "2",
    hackathonSlug: "kakao-ai-hackathon",
    name: "Data Ninjas",
    description: "데이터 분석 기반 서비스 개발",
    isOpen: true,
    lookingFor: ["Data Engineer"],
    contactUrl: "https://open.kakao.com/o/xyz456",
    createdAt: "2026-03-10"
  }
]