// 챗봇 RAG (Retrieval Augmented Generation) API
// 구조: Frontend → Backend Proxy (/api/chatbot) → OpenAI API
// 
// ✅ 보안: API 키는 서버에서만 관리되며, 프론트엔드에서는 절대 노출되지 않음
// ✅ Vercel 배포 시 환경 변수는 Vercel 설정에서만 관리

/**
 * 챗봇 응답 생성 (백엔드 프록시 호출)
 * 
 * 프론트엔드에서는 단순히 /api/chatbot 엔드포인트를 호출하고,
 * 실제 OpenAI API 호출은 백엔드(Vercel Serverless Function)에서만 수행됩니다.
 * 
 * @param userMessage 사용자 질문
 * @returns 챗봇 응답
 */
export const generateChatbotResponse = async (userMessage: string): Promise<string> => {
  try {
    // 백엔드 API 호출 (/api/chatbot은 Vercel Serverless Function)
    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: userMessage })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('챗봇 API 오류:', error)
      
      if (response.status === 401) {
        return '❌ 서버 인증 오류. 관리자에게 연락해주세요.'
      }
      if (response.status === 500) {
        return '🚨 서버 오류. 잠시 후 다시 시도해주세요.'
      }
      
      return error.error || '응답을 생성할 수 없습니다.'
    }

    const data = await response.json()
    return data.response || '응답을 생성할 수 없습니다.'
  } catch (error) {
    console.error('챗봇 요청 오류:', error)
    
    const errorMessage = error instanceof Error ? error.message : ''
    
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return '🌐 네트워크 연결을 확인해주세요.'
    }
    
    return '죄송하지만 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요. 😅'
  }
}
