# InsighThon

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)
![Vite](https://img.shields.io/badge/Vite-Build-purple)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

> 해커톤 탐색, 팀 빌딩, 실시간 채팅, 분석/추천, AI 매칭 기능을 제공하는 웹 플랫폼

---

## 📌 프로젝트 개요

해커톤 참여 과정에서 발생하는 정보(조회, 참가, 팀 활동 등)를 기반으로  
참가자에게 **의사결정에 필요한 인사이트**를 제공하는 플랫폼입니다.

단순 정보 제공을 넘어  
**팀 구성, 참여 전략, 프로젝트 방향**을 데이터 기반으로 지원합니다.

---

## 🚀 핵심 기능

- 🔍 **해커톤 탐색 / 상세 조회**
  - 다양한 해커톤 정보 검색 및 상세 확인

- 👥 **팀 빌딩 (Camp)**
  - 팀 생성 / 모집 / 참여
  - 관심사 기반 팀 탐색

- 💬 **실시간 팀 채팅**
  - Supabase Realtime 기반 채팅

- 📊 **랭킹 및 활동 분석**
  - 참여/제출/조회 기반 지표 제공

- 🤖 **AI 매칭 / 추천**
  - 사용자 활동 기반 해커톤 및 팀 추천

---

## 🧰 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| 상태관리 | React Query |
| Backend | Supabase |
| Realtime | Supabase Realtime |
| 기타 | OpenAI API (추천/매칭) |

---

## 📁 폴더 구조

```text
src/
├── components/        # 공통 UI 컴포넌트
├── pages/             # 주요 페이지 (Home, Hackathons 등)
├── features/          # 도메인 기능 (team, chat, analytics 등)
├── hooks/             # 커스텀 훅
├── api/               # 서버 통신 로직
├── utils/             # 유틸 함수
├── types/             # 타입 정의
└── assets/            # 정적 리소스
