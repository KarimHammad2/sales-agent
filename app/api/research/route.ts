import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type ResearchRequest = {
  task?: 'company' | 'competitors' | 'seo'
  company?: string
  website?: string
  mission?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ResearchRequest
  const apiKey = process.env.PERPLEXITY_API_KEY

  if (!apiKey) {
    return NextResponse.json({ ok: false, fallback: true, reason: 'PERPLEXITY_API_KEY is not configured' }, { status: 200 })
  }

  const prompt = `Return valid JSON only. Perform ${body.task ?? 'company'} research for ${body.company ?? 'the target company'}${body.website ? ` (${body.website})` : ''}. Mission: ${body.mission ?? 'identify commercial sales opportunities'}. Include summary, sources, competitors, seoGaps, buyingSignals, and opportunity.`

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'sonar-pro', temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!response.ok) return NextResponse.json({ ok: false, fallback: true, reason: 'Perplexity request failed' })
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : { summary: content, sources: data?.citations ?? [] }
    return NextResponse.json({ ok: true, provider: 'perplexity', result })
  } catch {
    return NextResponse.json({ ok: false, fallback: true, reason: 'Malformed Perplexity response' })
  }
}
