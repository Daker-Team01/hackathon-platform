import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type EventLog, type EventType, type TargetType } from '../types/log'
import { useUser } from './UserContext'
import { supabase } from '../lib/supabase'

type LogContextType = {
  logs: EventLog[]
  recordEvent: (
    action_type: EventType,
    target_type: TargetType,
    target_id: string,
    metadata?: Record<string, any>
  ) => Promise<void>
  refreshLogs: () => Promise<void>
  loading: boolean
}

const LogContext = createContext<LogContextType | undefined>(undefined)

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<EventLog[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useUser()

  const refreshLogs = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      if (data) setLogs(data as EventLog[])
    } catch (error) {
      console.error('Failed to fetch logs from Supabase:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshLogs()
  }, [refreshLogs])

  const recordEvent = useCallback(async (
    action_type: EventType,
    target_type: TargetType,
    target_id: string,
    metadata?: Record<string, any>
  ) => {
    const page_url = typeof window !== 'undefined' ? window.location.href : ''
    
    const newLogData = {
      user_id: user?.id || null,
      nickname: user?.nickname || null,
      action_type,
      target_id,
      page_url,
      metadata: {
        ...(metadata || {}),
        target_type // 요건에 포함된 target_type을 metadata에 추가
      },
    }

    try {
      const { data, error } = await supabase
        .from('user_logs')
        .insert([newLogData])
        .select()

      if (error) throw error
      
      if (data && data[0]) {
        setLogs((prev) => [data[0] as EventLog, ...prev])
      }
    } catch (error) {
      console.error('Failed to record log to Supabase:', error)
    }
  }, [user])

  return (
    <LogContext.Provider value={{ logs, recordEvent, refreshLogs, loading }}>
      {children}
    </LogContext.Provider>
  )
}

export function useLog() {
  const context = useContext(LogContext)
  if (context === undefined) {
    throw new Error('useLog must be used within LogProvider')
  }
  return context
}
