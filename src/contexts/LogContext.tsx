import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type EventLog, type EventType, type TargetType } from '../types/log'
import { useUser } from './UserContext'

type LogContextType = {
  logs: EventLog[]
  recordEvent: (
    eventType: EventType,
    targetType: TargetType,
    targetId: string,
    metadata?: Record<string, unknown>
  ) => void
  getLogs: () => EventLog[]
}

const LogContext = createContext<LogContextType | undefined>(undefined)

const LOGS_STORAGE_KEY = 'user_activity_logs'

function getInitialLogs(): EventLog[] {
  if (typeof window === 'undefined') return []
  const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY)
  if (storedLogs) {
    try {
      return JSON.parse(storedLogs)
    } catch (error) {
      console.error('Failed to parse logs from localStorage:', error)
    }
  }
  return []
}

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<EventLog[]>(getInitialLogs)
  const { user } = useUser()

  const recordEvent = useCallback((
    eventType: EventType,
    targetType: TargetType,
    targetId: string,
    metadata?: Record<string, unknown>
  ) => {
    const newLog: EventLog = {
      id: crypto.randomUUID(),
      userId: user?.id || null,
      eventType,
      targetType,
      targetId,
      timestamp: new Date().toISOString(),
      metadata,
    }

    setLogs((prev) => {
      const updatedLogs = [...prev, newLog]
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs))
      return updatedLogs
    })
  }, [user?.id])

  const getLogs = useCallback(() => {
    return logs
  }, [logs])

  return (
    <LogContext.Provider value={{ logs, recordEvent, getLogs }}>
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
