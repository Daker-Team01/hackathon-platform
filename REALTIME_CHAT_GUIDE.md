# 실시간 채팅 시스템 구현 가이드

## 📋 개요
Supabase를 활용한 실시간 다중 채팅방 시스템을 구현했습니다. 팀 생성 시 자동으로 채팅방이 생성되고, 팀원 초대 수락 시 자동으로 채팅방에 참여합니다.

## ✅ 완료된 작업

### 1. Supabase 데이터베이스 스키마 생성 ✅
**파일:** `SUPABASE_SETUP.sql`, `supabase/migrations/001_create_chat_tables.sql`

필요한 테이블:
- `chat_rooms` - 채팅방 정보 (일반, 팀, DM)
- `chat_messages` - 메시지 저장
- `chat_members` - 채팅방 멤버 관리
- `team_chat_mapping` - 팀과 채팅방 연결

**Supabase 마이그레이션 실행 방법:**
1. https://app.supabase.com 접속
2. 프로젝트 선택 → SQL Editor
3. "New Query" → `SUPABASE_SETUP.sql` 내용 복사 후 실행
4. RLS 정책이 자동으로 설정됨

### 2. 실시간 채팅 API 구현 ✅
**파일:** `src/api/realtimeChatApi.ts`

**주요 기능:**
- `createTeamChatRoom()` - 팀 채팅방 생성
- `sendMessage()` - 메시지 전송
- `subscribeToRoomMessages()` - 실시간 메시지 구독
- `addChatMember()` - 채팅방 멤버 추가
- `fetchUserChatRooms()` - 사용자의 모든 채팅방 조회

### 3. ChatContext Supabase 연결 ✅
**파일:** `src/contexts/ChatContext.tsx`

**변경사항:**
- Supabase Realtime 메시지 실시간 구독
- 로그인 시 사용자의 모든 채팅방 자동 로드
- Supabase 메시지를 로컬 상태로 동기화
- `addSupabaseMessage()` - 메시지 전송 함수 추가

### 4. 팀 생성 시 자동 채팅방 생성 ✅
**파일:** `src/api/teamApi.ts` - `createTeam()` 함수

**동작 흐름:**
```
팀 생성 요청
  ↓
localStorage에 팀 저장
  ↓
Supabase에 채팅방 생성 (팀 이름으로)
  ↓
팀 멤버들을 Supabase 채팅방에 추가
  ↓
환영 메시지 전송
```

### 5. 팀원 초대 수락 시 자동 채팅방 초대 ✅
**파일:** `src/api/teamApi.ts` - `respondToInvite()` 함수

**동작 흐름:**
```
초대 수락
  ↓
localStorage에 팀 멤버 추가
  ↓
Supabase 채팅방에 멤버 추가
  ↓
"XXX님이 참여했습니다" 시스템 메시지 전송
```

### 6. UserContext 수정 ✅
**파일:** `src/contexts/UserContext.tsx`

**변경사항:**
- 로그인 시 `initializeChatData(email, nickname)` 호출
- 자동 복원 시에도 ChatContext 초기화

## 🔧 설정 확인

### 환경 변수 확인 ✅
```
VITE_SUPABASE_URL=https://sqypwwvgrnawwkxqmvwa.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
```

`.env.local` 파일에 이미 설정되어 있습니다.

## 📌 다음 단계

### 1. Supabase SQL 실행 (필수) ⚠️
Supabase 대시보드에서 `SUPABASE_SETUP.sql` 파일의 내용을 실행해야 합니다.

```sql
-- SQL Editor에 복사하여 실행
CREATE TABLE chat_rooms (...)
CREATE TABLE chat_messages (...)
...
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 테스트 시나리오

#### 시나리오 A: 팀 생성 및 채팅
1. 로그인
2. "팀 생성" 클릭
3. 팀 이름 입력 및 생성
4. Supabase에서 자동으로 팀 채팅방 생성 확인
5. 팀 채팅방에서 메시지 전송 테스트

#### 시나리오 B: 팀원 초대 및 참여
1. 팀 리더로 로그인
2. 팀원 초대
3. 초대받은 사용자로 로그인
4. 초대 수락
5. 자동으로 팀 채팅방에 추가됨 확인

## 🏗️ 아키텍처

### 데이터 흐름
```
User Login
    ↓
initializeChatData(email, nickname)
    ↓
loadSupabaseRooms(email) - 사용자의 모든 채팅방 조회
    ↓
subscribeToRoomMessages(roomId) - 각 채팅방 메시지 실시간 구독
    ↓
실시간 메시지 수신 → 로컬 상태 업데이트
```

### 팀 생성 흐름
```
createTeam()
    ↓
localStorage 저장
    ↓
createTeamChatRoom() - Supabase에 팀 채팅방 생성
    ↓
addTeamMembersToChatRoom() - 팀 멤버 추가
    ↓
sendSystemMessage() - 환영 메시지
```

## 📊 API 함수 목록

### Chat Room 관리
- `createTeamChatRoom(teamId, teamName, initiatorId)` - 팀 채팅방 생성
- `fetchTeamChatRoom(teamId)` - 팀 채팅방 조회
- `fetchAllChatRooms()` - 모든 채팅방 조회
- `fetchUserChatRooms(userId)` - 사용자 채팅방 조회

### Message 관리
- `sendMessage(roomId, userId, nickname, content)` - 메시지 전송
- `sendSystemMessage(roomId, content)` - 시스템 메시지
- `fetchRoomMessages(roomId, limit, offset)` - 메시지 조회
- `updateMessage(messageId, content)` - 메시지 수정
- `deleteMessage(messageId)` - 메시지 삭제

### Member 관리
- `addChatMember(roomId, userId, nickname)` - 멤버 추가
- `removeChatMember(roomId, userId)` - 멤버 제거
- `addTeamMembersToChatRoom(roomId, members)` - 팀 멤버 일괄 추가
- `fetchRoomMembers(roomId)` - 채팅방 멤버 조회

### Real-time
- `subscribeToRoomMessages(roomId, callback)` - 메시지 실시간 구독
- `subscribeToRoomMembers(roomId, callback)` - 멤버 변경 실시간 구독

## 🐛 주의사항

1. **Supabase SQL 실행 필수** - 테이블이 없으면 채팅 기능 작동 안 함
2. **RLS 정책** - INSERT/UPDATE/SELECT 권한 필요
3. **Realtime 설정** - Supabase 프로젝트에서 Realtime 활성화 확인
4. **환경 변수** - `.env.local`에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` 확인

## 📝 파일 수정 목록

```
src/
├── api/
│   ├── realtimeChatApi.ts ✅ (생성)
│   └── teamApi.ts ✅ (수정)
├── contexts/
│   ├── ChatContext.tsx ✅ (수정)
│   └── UserContext.tsx ✅ (수정)
└── lib/
    └── supabase.ts (이미 설정됨)

supabase/
└── migrations/
    └── 001_create_chat_tables.sql ✅ (생성)

SUPABASE_SETUP.sql ✅ (생성)
```

## 💡 향후 개선사항

- [ ] 메시지 검색 기능
- [ ] 파일 업로드 지원
- [ ] 메시지 반응(이모지)
- [ ] 스레드 댓글
- [ ] DM(1:1 채팅)
- [ ] 채팅방 권한 설정
- [ ] 메시지 읽음 표시
- [ ] 음성/비디오 통화

---

**작성일:** 2026년 3월 25일
**상태:** 구현 완료 (Supabase SQL 실행 필요)
