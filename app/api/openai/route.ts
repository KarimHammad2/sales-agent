import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type OpenAIRequest = {
  task?: 'icp' | 'synthesis' | 'score' | 'outreach' | 'reply' | 'brief'
  prompt?: string
  context?: unknown
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as OpenAIRequest
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ ok: false, fallback: true, reason: 'OPENAI_API_KEY is not configured' }, { status: 200 })
  }

  const prompt = `${body.prompt ?? `Complete the ${body.task ?? 'synthesis'} task.`}\nContext: ${JSON.stringify(body.context ?? {})}\nReturn concise, actionable JSON when possible.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are the reasoning layer for a B2B autonomous sales engine.' }, { role: 'user', content: prompt }] }),
    })
    if (!response.ok) return NextResponse.json({ ok: false, fallback: true, reason: 'OpenAI request failed' })
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    let result: unknown
    try { result = JSON.parse(content) } catch { result = { text: content } }
    return NextResponse.json({ ok: true, provider: 'openai', result })
  } catch {
    return NextResponse.json({ ok: false, fallback: true, reason: 'Malformed OpenAI response' })
  }
}
