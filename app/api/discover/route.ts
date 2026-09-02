import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const TARGET_COUNT = 25
const BATCH_SIZE = 10
const MAX_BATCHES = 4

type DiscoverRequest = {
  prompt?: string
  industry?: string
  geography?: string
  companySize?: string
  priorities?: string[]
}

type RawProspect = {
  company?: string
  domain?: string
  location?: string
  industry?: string
  size?: string
  score?: number
  icpFit?: string
  leakage?: string
  opportunity?: string
  summary?: string
  competitors?: string[]
}

const systemPrompt = `You are a B2B prospecting researcher. Find REAL companies matching the ideal customer profile.
Return valid JSON only with this exact shape:
{
  "prospects": [
    {
      "company": "string",
      "domain": "string (website domain only, no https)",
      "location": "string",
      "industry": "string",
      "size": "string (employee range)",
      "score": number,
      "icpFit": "Strong fit" | "Likely fit" | "Possible fit",
      "leakage": "High" | "Medium" | "Low",
      "opportunity": "string (e.g. $60k–$140k)",
      "summary": "string (1 sentence on why they fit)",
      "competitors": ["string", "string", "string"]
    }
  ]
}
Rules:
- Return ONLY companies that actually exist with real domains
- Match the requested industry and geography
- Score each prospect 65–95 based on ICP fit and qualification priorities
- Vary company sizes and sub-segments within the ICP
- Do not repeat companies from the exclusion list`

function extractProspects(content: string): RawProspect[] {
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const raw = fenced?.[1]?.trim() ?? content.trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return []
    const data = JSON.parse(match[0]) as { prospects?: RawProspect[] }
    return Array.isArray(data.prospects) ? data.prospects : []
  } catch {
    return []
  }
}

function normalizeKey(prospect: RawProspect) {
  const domain = String(prospect.domain ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
  const company = String(prospect.company ?? '').toLowerCase().trim()
  return domain || company
}

function dedupeProspects(prospects: RawProspect[]) {
  const seen = new Set<string>()
  const unique: RawProspect[] = []
  for (const prospect of prospects) {
    const key = normalizeKey(prospect)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(prospect)
  }
  return unique
}

function buildUserPrompt(body: DiscoverRequest, batchSize: number, exclude: string[]) {
  const parts = [body.prompt?.trim()]
  if (body.industry) parts.push(`Industry: ${body.industry}`)
  if (body.geography && body.geography !== 'Any region') parts.push(`Geography: ${body.geography}`)
  if (body.companySize && body.companySize !== 'Any size') parts.push(`Company size: ${body.companySize}`)
  if (body.priorities?.length) parts.push(`Qualification priorities: ${body.priorities.join(', ')}`)
  parts.push(`Return exactly ${batchSize} distinct companies in the prospects array.`)
  if (exclude.length > 0) {
    parts.push(`Do NOT include these companies (already found): ${exclude.join(', ')}`)
  }
  parts.push(`Find a diverse mix — different neighborhoods, niches, and company sizes within the ICP.`)
  return parts.filter(Boolean).join('\n')
}

async function discoverWithPerplexity(prompt: string, apiKey: string) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      temperature: 0.15,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message ?? 'Perplexity request failed')
  const content = data?.choices?.[0]?.message?.content ?? ''
  return extractProspects(content)
}

async function discoverWithOpenAI(prompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.25,
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
  return extractProspects(content)
}

async function discoverBatched(
  body: DiscoverRequest,
  discover: (prompt: string) => Promise<RawProspect[]>,
) {
  let prospects: RawProspect[] = []

  for (let batch = 0; batch < MAX_BATCHES && prospects.length < TARGET_COUNT; batch++) {
    const remaining = TARGET_COUNT - prospects.length
    const batchSize = Math.min(BATCH_SIZE, remaining)
    const exclude = prospects.map(p => p.company).filter(Boolean) as string[]
    const prompt = buildUserPrompt(body, batchSize, exclude)
    const found = await discover(prompt)
    prospects = dedupeProspects([...prospects, ...found])
    if (found.length === 0) break
  }

  return prospects.slice(0, TARGET_COUNT)
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DiscoverRequest
  if (!body.prompt?.trim()) {
    return NextResponse.json({ ok: false, reason: 'Search prompt is required' }, { status: 400 })
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  try {
    let prospects: RawProspect[] = []
    let provider = 'perplexity'

    if (perplexityKey) {
      try {
        prospects = await discoverBatched(body, prompt => discoverWithPerplexity(prompt, perplexityKey))
      } catch {
        prospects = []
      }
    }

    if (prospects.length < TARGET_COUNT && openaiKey) {
      const needed = TARGET_COUNT - prospects.length
      if (needed > 0) {
        const exclude = prospects.map(p => p.company).filter(Boolean) as string[]
        const prompt = buildUserPrompt(body, Math.min(BATCH_SIZE * 2, needed + 5), exclude)
        const extra = dedupeProspects(await discoverWithOpenAI(prompt, openaiKey))
        prospects = dedupeProspects([...prospects, ...extra]).slice(0, TARGET_COUNT)
        if (prospects.length > 0) provider = prospects.length > 0 && perplexityKey ? 'perplexity+openai' : 'openai'
      }
    }

    if (prospects.length >= TARGET_COUNT) {
      return NextResponse.json({ ok: true, provider, prospects, count: prospects.length })
    }

    if (prospects.length > 0) {
      return NextResponse.json({
        ok: true,
        provider,
        prospects,
        count: prospects.length,
        partial: true,
        reason: `Found ${prospects.length} prospects. Try broadening your search to reach ${TARGET_COUNT}.`,
      })
    }

    if (!perplexityKey && !openaiKey) {
      return NextResponse.json({ ok: false, reason: 'No API keys configured for prospect discovery' })
    }

    return NextResponse.json({ ok: false, reason: 'No matching prospects found. Try refining your search.' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Prospect discovery failed'
    return NextResponse.json({ ok: false, reason })
  }
}
