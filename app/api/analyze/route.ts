import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type AnalyzeRequest = { task?: string; prompt?: string; context?: unknown }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, fallback: true, reason: 'OPENAI_API_KEY is not configured' }, { status: 200 })
  const instruction = body.prompt ?? `Complete ${body.task ?? 'structured analysis'} for an autonomous B2B prospecting workflow.`
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a precise B2B sales research analyst. Return valid JSON only. Clearly label estimates and inferences.' }, { role: 'user', content: `${instruction}\nContext: ${JSON.stringify(body.context ?? {})}` }] }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ ok: false, fallback: true, reason: data?.error?.message ?? 'OpenAI request failed' })
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    return NextResponse.json({ ok: true, provider: 'openai', result: JSON.parse(content) })
  } catch { return NextResponse.json({ ok: false, fallback: true, reason: 'OpenAI returned malformed JSON' }) }
}
