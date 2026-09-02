import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

type AnalyzeProspectRequest = {
  prospect?: {
    company?: string
    domain?: string
    location?: string
    industry?: string
    size?: string
    score?: number
    summary?: string
    competitors?: string[]
  }
  mission?: string
  priorities?: string[]
}

const systemPrompt = `You are a B2B sales intelligence analyst. Research the target company using real web data and return valid JSON only.

Return this exact shape:
{
  "summary": "string (2-3 sentences about the company and sales opportunity)",
  "score": number (65-98, overall lead score),
  "icpFit": "Strong fit" | "Likely fit" | "Possible fit",
  "leakage": "High" | "Medium" | "Low",
  "opportunity": "string (e.g. $60k–$140k)",
  "competitors": ["string", "string", "string"],
  "services": ["string"],
  "markets": ["string"],
  "gaps": ["string (SEO/competitor gaps)"],
  "conversion": ["string (conversion weaknesses)"],
  "evidence": ["string"],
  "angle": "string (outreach pitch angle)",
  "decisionMakers": ["string"],
  "commercialSignals": ["string"],
  "recommendedAction": "string",
  "scores": {
    "icpFit": number,
    "seoOpportunity": number,
    "competitorLeakage": number,
    "commercialPotential": number,
    "conversionLeakage": number,
    "contactability": number
  },
  "competitiveMetrics": [
    {
      "metric": "string",
      "prospect": "string (e.g. Moderate, Limited, Strong)",
      "competitors": ["string", "string", "string"]
    }
  ],
  "emails": [
    {
      "day": "Day 1" | "Day 3" | "Day 7" | "Day 12",
      "subject": "string",
      "body": "string",
      "evidence": ["string"]
    }
  ]
}

Rules:
- Use REAL information about the company and its actual market
- Match the user's mission and qualification priorities
- Label estimates clearly in evidence
- Provide exactly 4 emails for Day 1, Day 3, Day 7, Day 12
- Provide 5-7 competitiveMetrics rows
- competitors array must have exactly 3 real competitor names`

function extractJson(content: string) {
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const raw = fenced?.[1]?.trim() ?? content.trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function buildPrompt(body: AnalyzeProspectRequest) {
  const p = body.prospect ?? {}
  return [
    `Analyze this prospect for outbound sales:`,
    `Company: ${p.company ?? 'Unknown'}`,
    `Website: ${p.domain ?? 'Unknown'}`,
    `Location: ${p.location ?? 'Unknown'}`,
    `Industry: ${p.industry ?? 'Unknown'}`,
    `Size: ${p.size ?? 'Unknown'}`,
    p.summary ? `Context: ${p.summary}` : '',
    body.mission ? `Mission: ${body.mission}` : '',
    body.priorities?.length ? `Qualification priorities: ${body.priorities.join(', ')}` : '',
    p.competitors?.length ? `Known competitors: ${p.competitors.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function analyzeWithPerplexity(prompt: string, apiKey: string) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message ?? 'Perplexity request failed')
  const content = data?.choices?.[0]?.message?.content ?? ''
  return extractJson(content)
}

async function analyzeWithOpenAI(prompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message ?? 'OpenAI request failed')
  const content = data?.choices?.[0]?.message?.content ?? '{}'
  return extractJson(content)
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeProspectRequest
  const prompt = buildPrompt(body)
  if (!body.prospect?.company) {
    return NextResponse.json({ ok: false, reason: 'Prospect company is required' }, { status: 400 })
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  try {
    let result = null
    let provider = 'perplexity'

    if (perplexityKey) {
      try {
        result = await analyzeWithPerplexity(prompt, perplexityKey)
      } catch {
        result = null
      }
    }

    if (!result && openaiKey) {
      result = await analyzeWithOpenAI(prompt, openaiKey)
      provider = 'openai'
    }

    if (!result) {
      if (!perplexityKey && !openaiKey) {
        return NextResponse.json({ ok: false, reason: 'No API keys configured for analysis' })
      }
      return NextResponse.json({ ok: false, reason: 'Analysis returned no usable data' })
    }

    return NextResponse.json({ ok: true, provider, result })
  } catch {
    return NextResponse.json({ ok: false, reason: 'Analysis failed' })
  }
}
