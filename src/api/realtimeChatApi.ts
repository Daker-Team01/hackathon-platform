/* 실시간 채팅 API - Supabase Realtime 기반 */

import { supabase } from "../lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface SupabaseChatRoom {
  id: string
  name: string
  room_type: "general" | "team" | "direct"
  team_id?: string
  created_at: string
  updated_at: string
  created_by?: string
  is_active: boolean
}

export interface SupabaseChatMessage {
  id: string
  room_id: string
  user_id: string
  user_nickname: string
  content: string
  message_type: "text" | "system" | "invite" | "file"
  created_at: string
  updated_at: string
  is_deleted: boolean
  reply_to_id?: string
}

export interface SupabaseChatMember {
  id: string
  room_id: string
  user_id: string
  nickname: string
  joined_at: string
  last_read_at?: string
  is_active: boolean
}

export type TeamRoomLifecycleEvent = Partial<SupabaseChatRoom> & {
  _action: 'DELETE' | 'UPSERT'
}

/* ============ 채팅방 관리 ============ */

/**
 * 모든 채팅방 조회
 */
export const fetchAllChatRooms = async () => {
  try {
    const query = supabase
      .from("chat_rooms")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data
  } catch (error) {
    console.error("Failed to fetch chat rooms:", error)
    return []
  }
}

/**
 * 특정 팀의 채팅방 조회
 */
export const fetchTeamChatRoom = async (teamId: string) => {
  try {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("team_id", teamId)
      .single()

    if (error && error.code !== "PGRST116") throw error // PGRST116: no rows returned
    return data
  } catch (error) {
    console.error("Failed to fetch team chat room:", error)
    return null
  }
}

/**
 * 특정 팀의 채팅방 목록 조회 (복수 레코드 방어용)
 */
export const fetchTeamChatRooms = async (teamId: string) => {
  try {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', teamId)

    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('Failed to fetch team chat rooms:', error)
    return []
  }
}

/**
 * 새 채팅방 생성
 */
export const createChatRoom = async (
  name: string,
  roomType: "general" | "team" | "direct" = "general",
  teamId?: string,
  createdBy?: string
): Promise<SupabaseChatRoom | null> => {
  try {
    const { data, error } = await supabase
      .from("chat_rooms")
      .insert({
        name,
        room_type: roomType,
        team_id: teamId,
        created_by: createdBy,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Failed to create chat room:", error)
    return null
  }
}

/**
 * 활성 일반 채팅방 1개 조회
 */
export const fetchPersonalChannelRoom = async (
  userId: string,
  roomName: '일반' | '공지'
): Promise<SupabaseChatRoom | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('room_type', 'general')
      .eq('created_by', userId)
      .eq('name', roomName)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) throw error
    if (!data || data.length === 0) return null
    return data[0] as SupabaseChatRoom
  } catch (error) {
    console.error(`Failed to fetch personal ${roomName} room:`, error)
    return null
  }
}

/**
 * 유저의 개인 채널 접근 보장 (방 생성 + 멤버 활성화)
 */
export const ensurePersonalChannelRoomForUser = async (
  userId: string,
  nickname: string,
  roomName: '일반' | '공지'
): Promise<SupabaseChatRoom | null> => {
  try {
    let room = await fetchPersonalChannelRoom(userId, roomName)

    if (!room) {
      room = await createChatRoom(roomName, 'general', undefined, userId)
    }

    if (!room) return null

    await addChatMember(room.id, userId, nickname)
    return room
  } catch (error) {
    console.error(`Failed to ensure personal ${roomName} room for user:`, error)
    return null
  }
}

export const ensureGeneralRoomForUser = async (
  userId: string,
  nickname: string
): Promise<SupabaseChatRoom | null> => {
  return ensurePersonalChannelRoomForUser(userId, nickname, '일반')
}

export const ensureNoticeRoomForUser = async (
  userId: string,
  nickname: string
): Promise<SupabaseChatRoom | null> => {
  return ensurePersonalChannelRoomForUser(userId, nickname, '공지')
}

/**
 * 팀 채팅방 생성 및 매핑
 */
export const createTeamChatRoom = async (
  teamId: string,
  teamName: string,
  initiatorId: string
): Promise<SupabaseChatRoom | null> => {
  try {
    // 1. 채팅방 생성
    const room = await createChatRoom(
      `${teamName} 팀 채팅방`,
      "team",
      teamId,
      initiatorId
    )

    if (!room) return null

    // 2. 팀-채팅방 매핑 생성
    const { error: mappingError } = await supabase
      .from("team_chat_mapping")
      .insert({
        team_id: teamId,
        room_id: room.id
      })

    if (mappingError) {
      console.error("Failed to create team mapping:", mappingError)
      // 채팅방은 생성되었지만 매핑 실패 - 선택적 처리
    }

    return room
  } catch (error) {
    console.error("Failed to create team chat room:", error)
    return null
  }
}

/**
 * 팀 채팅방 비활성화 (팀 삭제 시 사용)
 */
export const deactivateTeamChatRoom = async (teamId: string): Promise<boolean> => {
  try {
    const rooms = await fetchTeamChatRooms(teamId)
    if (!rooms.length) {
      return true
    }

    const roomIds = rooms.map((room) => room.id)

    const { error: memberError } = await supabase
      .from('chat_members')
      .update({ is_active: false })
      .in('room_id', roomIds)
      .eq('is_active', true)

    if (memberError) throw memberError

    const { error: roomError } = await supabase
      .from('chat_rooms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', roomIds)
      .eq('is_active', true)

    if (roomError) throw roomError

    const { error: mappingError } = await supabase
      .from('team_chat_mapping')
      .delete()
      .eq('team_id', teamId)

    if (mappingError) {
      console.error('Failed to delete team chat mapping:', mappingError)
    }

    return true
  } catch (error) {
    console.error('Failed to deactivate team chat room:', error)
    return false
  }
}

/* ============ 채팅 멤버 관리 ============ */

/**
 * 채팅방에 멤버 추가
 */
export const addChatMember = async (
  roomId: string,
  userId: string,
  nickname: string
) => {
  try {
    const { data, error } = await supabase
      .from("chat_members")
      .insert({
        room_id: roomId,
        user_id: userId,
        nickname,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      // Unique 제약으로 이미 있는 경우 업데이트
      if (error.code === "23505") {
        const { data: updateData, error: updateError } = await supabase
          .from("chat_members")
          .update({ is_active: true, joined_at: new Date().toISOString() })
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .select()
          .single()

        if (updateError) throw updateError
        return updateData
      }
      throw error
    }
    return data
  } catch (error) {
    console.error("Failed to add chat member:", error)
    return null
  }
}

/**
 * 채팅방에서 멤버 제거
 */
export const removeChatMember = async (roomId: string, userId: string) => {
  try {
    const { error } = await supabase
      .from("chat_members")
      .update({ is_active: false })
      .eq("room_id", roomId)
      .eq("user_id", userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Failed to remove chat member:", error)
    return false
  }
}

/**
 * DM 방이 비어있는지 확인 후 is_active = false로 설정
 */
export const deactivateDirectRoomIfEmpty = async (roomId: string) => {
  try {
    // 현재 활성 멤버 확인
    const { data: members, error: fetchError } = await supabase
      .from("chat_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)

    if (fetchError) throw fetchError

    // DM 방은 1명 이하 남으면 방도 비활성화 (1:1이므로 한 명이 나가면 상대방 목록에서도 제거)
    if (!members || members.length <= 1) {
      const { error: updateError } = await supabase
        .from("chat_rooms")
        .update({ is_active: false })
        .eq("id", roomId)
        .eq("room_type", "direct")

      if (updateError) throw updateError
      return true
    }
    return false
  } catch (error) {
    console.error("Failed to deactivate direct room:", error)
    return false
  }
}

/**
 * 특정 채팅방의 모든 멤버 조회
 */
export const fetchRoomMembers = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from("chat_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)

    if (error) throw error
    return data
  } catch (error) {
    console.error("Failed to fetch room members:", error)
    return []
  }
}

/**
 * 팀으로부터 모든 멤버를 채팅방에 초대
 */
export const addTeamMembersToChatRoom = async (
  roomId: string,
  members: Array<{ userId: string; userName: string }>
) => {
  try {
    const { error } = await supabase
      .from("chat_members")
      .insert(
        members.map((member) => ({
          room_id: roomId,
          user_id: member.userId,
          nickname: member.userName,
          is_active: true
        }))
      )

    if (error) throw error
    return true
  } catch (error) {
    console.error("Failed to add team members to chat room:", error)
    return false
  }
}

/* ============ 메시지 관리 ============ */

/**
 * 채팅방의 메시지 조회
 */
export const fetchRoomMessages = async (
  roomId: string,
  limit: number = 50,
  offset: number = 0
) => {
  try {
    const { data: messages, error, count } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact" })
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { messages: (messages || []).reverse(), count }
  } catch (error) {
    console.error("Failed to fetch messages:", error)
    return { messages: [], count: 0 }
  }
}

/**
 * 메시지 전송
 */
export const sendMessage = async (
  roomId: string,
  userId: string,
  userNickname: string,
  content: string,
  messageType: "text" | "system" | "invite" | "file" = "text"
): Promise<SupabaseChatMessage | null> => {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        user_id: userId,
        user_nickname: userNickname,
        content,
        message_type: messageType,
        is_deleted: false
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Failed to send message:", error)
    return null
  }
}

/**
 * 시스템 메시지 전송 (팀 환영, 멤버 추가 등)
 */
export const sendSystemMessage = async (
  roomId: string,
  content: string
) => {
  return sendMessage(roomId, "system", "시스템", content, "system")
}

/**
 * 메시지 수정
 */
export const updateMessage = async (messageId: string, content: string) => {
  try {
    const { data: message, error } = await supabase
      .from("chat_messages")
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select()
      .single()

    if (error) throw error
    return message
  } catch (error) {
    console.error("Failed to update message:", error)
    return null
  }
}

/**
 * 메시지 삭제
 */
export const deleteMessage = async (messageId: string) => {
  try {
    const { error } = await supabase
      .from("chat_messages")
      .update({ is_deleted: true })
      .eq("id", messageId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Failed to delete message:", error)
    return false
  }
}

/* ============ 실시간 구독 ============ */

const messageChannels = new Map<string, RealtimeChannel>()

/**
 * 채팅방 메시지 리얼타임 구독
 */
export const subscribeToRoomMessages = (
  roomId: string,
  onNewMessage: (message: SupabaseChatMessage) => void,
  onError?: (error: any) => void
) => {
  try {
    // 같은 룸에 대해 기존 구독이 있으면 교체
    const existing = messageChannels.get(roomId)
    if (existing) {
      existing.unsubscribe()
      messageChannels.delete(roomId)
    }

    const channel = supabase
      .channel(`chat:room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onNewMessage(payload.new as SupabaseChatMessage)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onNewMessage(payload.new as SupabaseChatMessage)
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" && onError) {
          onError("채팅 실시간 연결 실패")
        }
        console.log("Chat subscription status:", status)
      })

    messageChannels.set(roomId, channel)

    return () => {
      const subscribed = messageChannels.get(roomId)
      if (subscribed) {
        subscribed.unsubscribe()
        messageChannels.delete(roomId)
      }
    }
  } catch (error) {
    console.error("Failed to subscribe to messages:", error)
    if (onError) onError(error)
    return () => {}
  }
}

/**
 * 특정 룸의 멤버 변경 실시간 구독
 */
export const subscribeToRoomMembers = (
  roomId: string,
  onMemberChange: (type: "INSERT" | "UPDATE" | "DELETE", member: SupabaseChatMember) => void
) => {
  try {
    const channel = supabase
      .channel(`chat:members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_members",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onMemberChange(payload.eventType as "INSERT" | "UPDATE" | "DELETE", payload.new as SupabaseChatMember)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error("Failed to subscribe to members:", error)
    return () => {}
  }
}

/**
 * 특정 유저의 채팅방 멤버십 변경 실시간 구독
 */
export const subscribeToUserMemberships = (
  userId: string,
  onMembershipChange: () => void,
  onError?: (error: any) => void
) => {
  try {
    const channel = supabase
      .channel(`chat:membership:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_members",
          filter: `user_id=eq.${userId}`
        },
        () => {
          onMembershipChange()
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" && onError) {
          onError("멤버십 실시간 연결 실패")
        }
      })

    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error("Failed to subscribe to user memberships:", error)
    if (onError) onError(error)
    return () => {}
  }
}

/**
 * DM 화방의 멤버십 변경(이 방에 속한 누구든지 나감) 실시간 구독
 * → 상대방이 방을 나가면 자신의 채팅방 목록에서도 제거
 */
export const subscribeToDmRoomMembers = (
  roomId: string,
  onMembershipChange: () => void,
  onError?: (error: any) => void
) => {
  try {
    const channel = supabase
      .channel(`chat:dm-members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_members",
          filter: `room_id=eq.${roomId}`
        },
        () => {
          onMembershipChange()
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" && onError) {
          onError("DM 멤버십 실시간 연결 실패")
        }
      })

    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error("Failed to subscribe to DM room members:", error)
    if (onError) onError(error)
    return () => {}
  }
}

/**
 * 팀 채팅방 생성/비활성화 실시간 구독
 */
export const subscribeToTeamRoomLifecycle = (
  onRoomChange: (room: TeamRoomLifecycleEvent) => void,
  onError?: (error: any) => void
) => {
  try {
    const channel = supabase
      .channel('chat:team-room-lifecycle')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
          filter: 'room_type=eq.team'
        },
        (payload) => {
          const eventType = payload.eventType

          if (eventType === 'DELETE') {
            const room = payload.old as Partial<SupabaseChatRoom>
            onRoomChange({ ...room, _action: 'DELETE' })
          } else {
            const room = payload.new as Partial<SupabaseChatRoom>
            onRoomChange({ ...room, _action: 'UPSERT' })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && onError) {
          onError('팀 채팅방 실시간 연결 실패')
        }
      })

    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error('Failed to subscribe to team room lifecycle:', error)
    if (onError) onError(error)
    return () => {}
  }
}

/**
 * 팀-채팅방 매핑 변경 실시간 구독
 */
export const subscribeToTeamChatMappingChanges = (
  onMappingChange: (payload: { team_id?: string; room_id?: string }) => void,
  onError?: (error: any) => void
) => {
  try {
    const channel = supabase
      .channel('chat:team-chat-mapping')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_chat_mapping'
        },
        (payload) => {
          const row = (payload.new || payload.old) as { team_id?: string; room_id?: string }
          onMappingChange(row)
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && onError) {
          onError('팀 채팅 매핑 실시간 연결 실패')
        }
      })

    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error('Failed to subscribe to team chat mapping changes:', error)
    if (onError) onError(error)
    return () => {}
  }
}

/* ============ 사용자 채팅 목록 ============ */

/**
 * 사용자가 속한 모든 채팅방 조회
 */
export const fetchUserChatRooms = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("chat_members")
      .select(`
        room_id,
        chat_rooms!inner(*)
      `)
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq('chat_rooms.is_active', true)

    if (error) throw error

    if (!data || data.length === 0) return []

    const rooms = data
      .map((row) => (row as { chat_rooms?: SupabaseChatRoom | SupabaseChatRoom[] }).chat_rooms)
      .flatMap((room) => (Array.isArray(room) ? room : room ? [room] : []))
      .filter((room): room is SupabaseChatRoom => Boolean(room))
      .filter((room) => {
        if (room.room_type !== 'general') return true
        if (room.name === '일반' || room.name === '공지') {
          return room.created_by === userId
        }
        return true
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    return rooms
  } catch (error) {
    console.error("Failed to fetch user chat rooms:", error)
    return []
  }
}
