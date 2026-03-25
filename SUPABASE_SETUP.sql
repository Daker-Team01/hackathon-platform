-- 채팅방 테이블
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  room_type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (room_type IN ('general', 'team', 'direct')),
  team_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true
);

-- 채팅방 멤버 테이블
CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  nickname VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(room_id, user_id)
);

-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_nickname VARCHAR(255),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'invite', 'file')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL
);

-- 팀과 채팅방 매핑 테이블
CREATE TABLE IF NOT EXISTS team_chat_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL UNIQUE,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_rooms_room_type ON chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_team_id ON chat_rooms(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_room_id ON chat_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Row Level Security (RLS) 활성화
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_mapping ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 인증 사용자가 접근 가능)
DROP POLICY IF EXISTS "Users can view all chat rooms" ON chat_rooms;
CREATE POLICY "Users can view all chat rooms" 
ON chat_rooms FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can view all chat members" ON chat_members;
CREATE POLICY "Users can view all chat members" 
ON chat_members FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can view all messages" ON chat_messages;
CREATE POLICY "Users can view all messages" 
ON chat_messages FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON chat_messages;
CREATE POLICY "Users can insert messages" 
ON chat_messages FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;
CREATE POLICY "Users can update own messages" 
ON chat_messages FOR UPDATE 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all chat_members operations" ON chat_members;
CREATE POLICY "Allow all chat_members operations"
ON chat_members FOR ALL
USING (true);

DROP POLICY IF EXISTS "Allow all team_chat_mapping operations" ON team_chat_mapping;
CREATE POLICY "Allow all team_chat_mapping operations"
ON team_chat_mapping FOR ALL
USING (true);

DROP POLICY IF EXISTS "Allow all chat_rooms operations" ON chat_rooms;
CREATE POLICY "Allow all chat_rooms operations"
ON chat_rooms FOR ALL
USING (true);
