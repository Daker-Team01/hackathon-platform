// @ts-nocheck

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatRequest = {
  model?: string
  messages?: ChatMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' | 'text' }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is required' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await request.json()) as ChatRequest
    const model = typeof body.model === 'string' && body.model.trim() ? body.model : 'gpt-4o-mini'
    const messages = Array.isArray(body.messages)
      ? body.messages.filter((m): m is ChatMessage => {
          return (
            !!m &&
            (m.role === 'system' || m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim().length > 0
          )
        })
      : []

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiPayload: Record<string, unknown> = {
      model,
      messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 700,
    }

    if (body.response_format && (body.response_format.type === 'json_object' || body.response_format.type === 'text')) {
      openaiPayload.response_format = body.response_format
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiPayload),
    })

    const payload = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({ error: payload?.error ?? payload ?? 'OpenAI request failed' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content = payload?.choices?.[0]?.message?.content
    return new Response(JSON.stringify({ content: typeof content === 'string' ? content : '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
