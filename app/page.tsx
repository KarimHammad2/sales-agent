'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  Loader2,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Stage = 'Discovered' | 'Researching' | 'Analyzed' | 'Qualified' | 'Sequence Ready' | 'Outreach Active' | 'Replied'
type Prospect = {
  id: string
  company: string
  domain: string
  location: string
  industry: string
  size: string
  score: number
  stage: Stage
  icpFit: string
  leakage: string
  opportunity: string
  summary: string
  competitors: string[]
  research?: Research
}
type Research = {
  services: string[]
  markets: string[]
  gaps: string[]
  conversion: string[]
  evidence: string[]
  angle: string
  emails: { day: string; subject: string; body: string; evidence: string[] }[]
  scores?: {
    icpFit: number
    seoOpportunity: number
    competitorLeakage: number
    commercialPotential: number
    conversionLeakage: number
    contactability: number
  }
  decisionMakers?: string[]
  commercialSignals?: string[]
  recommendedAction?: string
  competitiveMetrics?: { metric: string; prospect: string; competitors: string[] }[]
  analyzedAt?: number
}

const steps = ['Researching company', 'Finding competitors', 'Comparing SEO visibility', 'Detecting competitor leakage', 'Detecting conversion leakage', 'Estimating opportunity', 'Scoring prospect', 'Generating outreach']

const QUALIFICATION_PRIORITIES = [
  'SEO opportunity',
  'Competitor leakage',
  'Conversion leakage',
  'Revenue potential',
  'Paid search efficiency',
  'Local SEO coverage',
  'Content depth',
  'Review authority',
  'Brand visibility',
  'Tech stack fit',
] as const

const DEFAULT_PRIORITIES = [
  'SEO opportunity',
  'Competitor leakage',
  'Conversion leakage',
  'Revenue potential',
]

type ParsedIcp = {
  industry: string
  geography: string
  companySize: string
  minScore: string
  targetCompanies: string[]
  idealBuyers: string[]
  priorities: string[]
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, char => char.toUpperCase())
}

function parseIcp(icp: string): ParsedIcp {
  const text = icp.toLowerCase().trim()

  let industry = ''
  const industryRules: [RegExp, string][] = [
    [/\breal estate\b/, 'Real estate companies'],
    [/\bproperty (?:management|developers?|firms?)\b/, 'Property companies'],
    [/\bmarketing agencies?\b/, 'Marketing agencies'],
    [/\bdigital agencies?\b/, 'Digital agencies'],
    [/\badvertising agencies?\b/, 'Advertising agencies'],
    [/\broofing\b/, 'Roofing companies'],
    [/\bhome services?\b/, 'Home services'],
    [/\bplumb(ing|ers?)\b/, 'Plumbing companies'],
    [/\bhvac\b/, 'HVAC companies'],
    [/\blegal\b|\blaw firms?\b/, 'Legal firms'],
    [/\baccounting\b|\baccountants?\b/, 'Accounting firms'],
    [/\bfinancial services?\b|\bfintech\b/, 'Financial services'],
    [/\binsurance\b/, 'Insurance companies'],
    [/\brestaurants?\b|\bfood (?:and|&)? beverage\b/, 'Restaurants'],
    [/\be-?commerce\b|\bonline retail\b/, 'E-commerce'],
    [/\bretail\b/, 'Retail companies'],
    [/\bmanufactur/, 'Manufacturing'],
    [/\bhealthcare\b|\bmedical\b|\bclinics?\b/, 'Healthcare'],
    [/\bdental\b|\bdentists?\b/, 'Dental practices'],
    [/\bconstruction\b|\bbuilders?\b/, 'Construction companies'],
    [/\blogistics\b|\bshipping\b/, 'Logistics companies'],
    [/\bsaas\b|\bsoftware\b/, 'SaaS / software'],
    [/\btech(nology)?\b|\bstartups?\b/, 'Technology companies'],
    [/\bconsulting\b|\bconsultants?\b/, 'Consulting firms'],
    [/\bagencies?\b/, 'Agencies'],
    [/\bcontractors?\b/, 'Contractors'],
    [/\beducation\b|\bschools?\b/, 'Education'],
    [/\bnonprofits?\b/, 'Nonprofits'],
  ]
  for (const [pattern, label] of industryRules) {
    if (pattern.test(text)) {
      industry = label
      break
    }
  }

  if (!industry) {
    const extracted = icp.match(
      /(?:find|search(?:\s+for)?|looking\s+for|target(?:ing)?)?\s*(.+?)\s+(?:companies|businesses|firms|agencies|startups|providers|organizations?|practices|studios|shops|brands)\b/i,
    )
    if (extracted?.[1]) {
      const raw = extracted[1].trim().replace(/^(the|my|ideal)\s+/i, '')
      if (raw.length > 0 && raw.length < 48) {
        const normalized = titleCase(raw)
        industry = /\b(companies|businesses|firms|agencies)\b/i.test(normalized)
          ? normalized
          : `${normalized} companies`
      }
    }
  }

  if (!industry) industry = 'B2B companies'

  let geography = 'Any region'
  const inMatch = icp.match(/\bin\s+([A-Za-z][A-Za-z\s,'-]+?)(?:\s+with|\s+that|\s+and\s+|\s+\d|\s*$|\.)/i)
  const knownGeo = icp.match(/\b(London|Texas|California|New York|San Francisco|Chicago|UK|USA|Europe|Austin|Dallas|Houston|Manchester|Birmingham|Edinburgh)\b/i)
  if (inMatch?.[1]) geography = titleCase(inMatch[1].trim().replace(/[,.]$/, ''))
  else if (knownGeo?.[1]) geography = titleCase(knownGeo[1])

  let companySize = 'Any size'
  const rangeMatch = icp.match(/(\d+)\s*[–-]\s*(\d+)\s*employees?/i)
  const plusMatch = icp.match(/(\d+)\+?\s*employees?/i)
  if (rangeMatch) companySize = `${rangeMatch[1]}–${rangeMatch[2]} employees`
  else if (plusMatch) companySize = `${plusMatch[1]}+ employees`

  const scoreMatch = icp.match(/(?:score|minimum)\s*(?:of\s*)?(\d+)/i)
  const minScore = scoreMatch ? `${scoreMatch[1]} / 100` : '70 / 100'

  const targetCompanies = [
    industry,
    geography !== 'Any region' ? geography : null,
    companySize !== 'Any size' ? companySize : null,
  ].filter(Boolean) as string[]

  if (industry.includes('Roofing')) targetCompanies.push('Residential / commercial roofing')
  if (industry.includes('Marketing') || industry.includes('Agencies')) targetCompanies.push('Digital / full-service')
  if (industry.includes('Real estate') || industry.includes('Property')) targetCompanies.push('Residential / commercial property')

  return {
    industry,
    geography,
    companySize,
    minScore,
    targetCompanies: targetCompanies.length ? targetCompanies : ['Matches your brief'],
    idealBuyers: ['Owner / CEO', 'Head of Marketing', 'Marketing Director'],
    priorities: DEFAULT_PRIORITIES,
  }
}

function toResearch(raw: Record<string, unknown>): Research {
  const scores = raw.scores as Record<string, number> | undefined
  const emails = Array.isArray(raw.emails)
    ? raw.emails.map((e: Record<string, unknown>) => ({
        day: String(e.day ?? 'Day 1'),
        subject: String(e.subject ?? ''),
        body: String(e.body ?? ''),
        evidence: Array.isArray(e.evidence) ? e.evidence.map(String) : [],
      }))
    : []

  const competitiveMetrics = Array.isArray(raw.competitiveMetrics)
    ? raw.competitiveMetrics.map((row: Record<string, unknown>) => ({
        metric: String(row.metric ?? ''),
        prospect: String(row.prospect ?? ''),
        competitors: Array.isArray(row.competitors) ? row.competitors.map(String) : [],
      }))
    : []

  return {
    services: Array.isArray(raw.services) ? raw.services.map(String) : [],
    markets: Array.isArray(raw.markets) ? raw.markets.map(String) : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps.map(String) : [],
    conversion: Array.isArray(raw.conversion) ? raw.conversion.map(String) : [],
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
    angle: String(raw.angle ?? ''),
    emails,
    scores: scores
      ? {
          icpFit: Number(scores.icpFit) || 75,
          seoOpportunity: Number(scores.seoOpportunity) || 75,
          competitorLeakage: Number(scores.competitorLeakage) || 75,
          commercialPotential: Number(scores.commercialPotential) || 75,
          conversionLeakage: Number(scores.conversionLeakage) || 75,
          contactability: Number(scores.contactability) || 75,
        }
      : undefined,
    decisionMakers: Array.isArray(raw.decisionMakers) ? raw.decisionMakers.map(String) : undefined,
    commercialSignals: Array.isArray(raw.commercialSignals) ? raw.commercialSignals.map(String) : undefined,
    recommendedAction: raw.recommendedAction ? String(raw.recommendedAction) : undefined,
    competitiveMetrics: competitiveMetrics.length > 0 ? competitiveMetrics : undefined,
    analyzedAt: Date.now(),
  }
}

function applyAnalysis(prospect: Prospect, raw: Record<string, unknown>): Prospect {
  const research = toResearch(raw)
  const icpFit = String(raw.icpFit ?? prospect.icpFit)
  const leakage = String(raw.leakage ?? prospect.leakage)

  return {
    ...prospect,
    stage: 'Sequence Ready',
    score: Math.min(99, Math.max(60, Number(raw.score) || prospect.score)),
    summary: String(raw.summary ?? prospect.summary),
    icpFit: ['Strong fit', 'Likely fit', 'Possible fit'].includes(icpFit) ? icpFit : prospect.icpFit,
    leakage: ['High', 'Medium', 'Low'].includes(leakage) ? leakage : prospect.leakage,
    opportunity: String(raw.opportunity ?? prospect.opportunity),
    competitors: Array.isArray(raw.competitors) ? raw.competitors.map(String) : prospect.competitors,
    research,
  }
}

function sanitizeProspect(prospect: Prospect): Prospect {
  if (hasLiveResearch(prospect)) return prospect
  const { research, ...rest } = prospect
  return {
    ...rest,
    stage: rest.stage === 'Sequence Ready' || rest.stage === 'Researching' ? 'Discovered' : rest.stage,
  }
}

function stripProspectForStorage(prospect: Prospect): Prospect {
  const { research, ...rest } = prospect
  return {
    ...rest,
    stage: rest.stage === 'Sequence Ready' || rest.stage === 'Researching' ? 'Discovered' : rest.stage,
  }
}

function hasLiveResearch(prospect: Prospect) {
  const research = prospect.research
  return Boolean(
    research?.analyzedAt &&
      research.emails.length >= 4 &&
      research.emails.every(email => email.subject && email.body),
  )
}

function priorityLabel(score: number) {
  if (score >= 85) return 'High priority'
  if (score >= 70) return 'Medium priority'
  return 'Lower priority'
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toProspect(raw: Record<string, unknown>, index: number): Prospect {
  const company = String(raw.company ?? `Prospect ${index + 1}`)
  const baseId = slugify(company) || `prospect-${index}`
  const icpFit = String(raw.icpFit ?? 'Likely fit')
  const leakage = String(raw.leakage ?? 'Medium')
  const validIcpFit = ['Strong fit', 'Likely fit', 'Possible fit'].includes(icpFit) ? icpFit : 'Likely fit'
  const validLeakage = ['High', 'Medium', 'Low'].includes(leakage) ? leakage : 'Medium'

  return {
    id: `${baseId}-${index}`,
    company,
    domain: String(raw.domain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    location: String(raw.location ?? ''),
    industry: String(raw.industry ?? ''),
    size: String(raw.size ?? 'Unknown'),
    score: Math.min(99, Math.max(60, Number(raw.score) || 75)),
    stage: 'Discovered',
    icpFit: validIcpFit,
    leakage: validLeakage,
    opportunity: String(raw.opportunity ?? 'TBD'),
    summary: String(raw.summary ?? ''),
    competitors: Array.isArray(raw.competitors) ? raw.competitors.map(String) : [],
  }
}

export default function Page() {
  const [view, setView] = useState<'search' | 'prospects' | 'campaigns'>('search')
  const [icp, setIcp] = useState('')
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [tab, setTab] = useState<'overview' | 'competitive' | 'leakage' | 'outreach'>('overview')
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(-1)
  const [apiNote, setApiNote] = useState('')
  const [criteria, setCriteria] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [sequence, setSequence] = useState<Record<string, boolean>>({})
  const [searching, setSearching] = useState(false)
  const [priorities, setPriorities] = useState<string[]>(DEFAULT_PRIORITIES)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedPriorities = window.localStorage.getItem('trevor-priorities')
    if (savedPriorities) {
      try {
        const parsed = JSON.parse(savedPriorities) as string[]
        if (parsed.length > 0) setPriorities(parsed)
      } catch {
        window.localStorage.removeItem('trevor-priorities')
      }
    }

    window.localStorage.removeItem('trevor-discovered-prospects')

    const saved = window.localStorage.getItem('trevor-discovered-prospects-v2')
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as Prospect[]
      if (parsed.length > 0) {
        setProspects(parsed.map(p => sanitizeProspect(stripProspectForStorage(p))))
        setHasSearched(true)
        setCriteria(true)
      }
    } catch {
      window.localStorage.removeItem('trevor-discovered-prospects-v2')
    }
  }, [])
  useEffect(() => {
    window.localStorage.setItem('trevor-priorities', JSON.stringify(priorities))
  }, [priorities])
  useEffect(() => {
    if (prospects.length > 0) {
      window.localStorage.setItem(
        'trevor-discovered-prospects-v2',
        JSON.stringify(prospects.map(stripProspectForStorage)),
      )
    }
  }, [prospects])

  const run = async (p: Prospect) => {
    const fresh = { ...p, stage: 'Researching' as Stage, research: undefined }
    setSelected(fresh)
    setTab('overview')
    setRunning(true)
    setStep(0)
    setApiNote('')
    setProspects(all => all.map(x => (x.id === p.id ? fresh : x)))

    const stepTimer = setInterval(() => {
      setStep(current => (current < steps.length - 1 ? current + 1 : current))
    }, 4000)

    try {
      const r = await fetch('/api/analyze-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect: p,
          mission: icp,
          priorities,
        }),
      })
      const d = await r.json()

      if (d.ok && d.result) {
        const complete = applyAnalysis(p, d.result as Record<string, unknown>)
        setProspects(all => all.map(x => (x.id === p.id ? complete : x)))
        setSelected(complete)
        setApiNote('')
      } else {
        setApiNote('')
        const failed = { ...p, stage: 'Analyzed' as Stage, research: undefined }
        setProspects(all => all.map(x => (x.id === p.id ? failed : x)))
        setSelected(failed)
      }
    } catch {
      setApiNote('')
      const failed = { ...p, stage: 'Analyzed' as Stage, research: undefined }
      setProspects(all => all.map(x => (x.id === p.id ? failed : x)))
      setSelected(failed)
    } finally {
      clearInterval(stepTimer)
      setRunning(false)
      setStep(steps.length)
    }
  }

  const findProspects = async () => {
    const query = icp.trim()
    if (query.length < 5) {
      setApiNote('Enter a short description of who you want to find (at least 5 characters).')
      return
    }
    if (priorities.length === 0) {
      setApiNote('Select at least one qualification priority before searching.')
      return
    }

    const parsed = parseIcp(icp)
    setSearching(true)
    setHasSearched(true)
    setCriteria(true)
    setSearchError('')
    setApiNote('')

    try {
      const r = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          industry: parsed.industry,
          geography: parsed.geography,
          companySize: parsed.companySize,
          priorities,
        }),
      })
      const d = await r.json()
      if (d.ok && Array.isArray(d.prospects) && d.prospects.length > 0) {
        const next = d.prospects.map((raw: Record<string, unknown>, index: number) => toProspect(raw, index))
        setProspects(next)
        if (d.partial) {
          setApiNote(d.reason ?? `Found ${d.count} prospects.`)
        } else if (d.provider === 'openai' || d.provider === 'perplexity+openai') {
          setApiNote('Some results generated by AI. Verify company details before outreach.')
        }
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      } else {
        setProspects([])
        const reason = d.reason ?? 'No matching prospects found. Try refining your search.'
        setSearchError(reason)
        setApiNote(reason)
      }
    } catch {
      const reason = 'Prospect discovery failed. Check your connection and try again.'
      setProspects([])
      setSearchError(reason)
      setApiNote(reason)
    } finally {
      setSearching(false)
    }
  }

  const openProspect = (prospect: Prospect) => setSelected(sanitizeProspect(prospect))

  useEffect(() => {
    setProspects(all => all.map(sanitizeProspect))
    setSelected(current => (current ? sanitizeProspect(current) : null))
  }, [])

  const activeProspects = useMemo(() => [...prospects].sort((a, b) => b.score - a.score), [prospects])

  if (selected) {
    const prospect = sanitizeProspect(selected)
    return (
      <Detail
        prospect={prospect}
        tab={tab}
        setTab={setTab}
        running={running}
        step={step}
        run={() => run(prospect)}
        sequence={sequence}
        setSequence={setSequence}
        back={() => setSelected(null)}
        apiNote={apiNote}
      />
    )
  }

  return (
    <div className="mesh-bg flex min-h-screen text-foreground">
      <Shell view={view} setView={setView} prospects={activeProspects} />
      <main className="ml-[260px] min-h-screen flex-1 px-8 py-8 lg:px-12">
        <header className="animate-fade-up mb-10 flex items-end justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Research workspace
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground lg:text-4xl">
              {view === 'search' ? 'Find your next prospects' : view === 'prospects' ? 'Prospects' : 'Campaigns'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {view === 'search'
                ? 'Describe your ideal customer. The agent finds, researches, qualifies, and prepares outreach.'
                : view === 'prospects'
                  ? 'Ranked by AI lead score and commercial opportunity.'
                  : 'Approved sequences and their current execution status.'}
            </p>
          </div>
          {view === 'prospects' && (
            <Button onClick={() => setView('search')} size="lg" className="gap-2 shadow-lg shadow-primary/20">
              <Plus size={16} />
              New Search
            </Button>
          )}
        </header>

        {view === 'search' && (
          <SearchView
            icp={icp}
            setIcp={setIcp}
            criteria={criteria}
            hasSearched={hasSearched}
            searchError={searchError}
            find={findProspects}
            searching={searching}
            apiNote={apiNote}
            prospects={activeProspects}
            run={run}
            resultsRef={resultsRef}
            priorities={priorities}
            setPriorities={setPriorities}
            onOpen={openProspect}
          />
        )}
        {view === 'prospects' && <ProspectsView prospects={activeProspects} onOpen={openProspect} onRun={run} />}
        {view === 'campaigns' && <Campaigns sequence={sequence} prospects={prospects} onOpen={openProspect} />}
      </main>
    </div>
  )
}

function Shell({
  view,
  setView,
  prospects,
}: {
  view: string
  setView: (v: 'search' | 'prospects' | 'campaigns') => void
  prospects: Prospect[]
}) {
  const qualified = prospects.filter(p => p.score >= 80).length

  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl">
      <div className="px-6 pt-7">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-indigo-500 text-sm font-bold text-primary-foreground">
            T
          </span>
          <div>
            <div className="text-[15px] font-bold tracking-wide text-foreground">Trevor</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Autonomous agent</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <Nav icon={Target} label="New Search" active={view === 'search'} onClick={() => setView('search')} />
          <Nav icon={Users} label="Prospects" active={view === 'prospects'} onClick={() => setView('prospects')} badge={prospects.length} />
          <Nav icon={Mail} label="Campaigns" active={view === 'campaigns'} onClick={() => setView('campaigns')} />
        </nav>
      </div>

      <div className="mt-auto border-t border-sidebar-border px-6 py-5">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <div className="text-lg font-semibold text-foreground">{prospects.length}</div>
            <div className="text-[10px] text-muted-foreground">Prospects</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <div className="text-lg font-semibold text-emerald-400">{qualified}</div>
            <div className="text-[10px] text-muted-foreground">Qualified</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          APIs connected
        </div>
      </div>
    </aside>
  )
}

function Nav({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: typeof Target
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200',
        active
          ? 'bg-sidebar-accent text-primary shadow-sm'
          : 'text-sidebar-foreground hover:bg-white/[0.04] hover:text-foreground',
      )}
    >
      <Icon size={16} className={active ? 'text-primary' : ''} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span>
      )}
    </button>
  )
}

function SearchView({
  icp,
  setIcp,
  criteria,
  hasSearched,
  searchError,
  find,
  searching,
  apiNote,
  prospects,
  run,
  resultsRef,
  priorities,
  setPriorities,
  onOpen,
}: {
  icp: string
  setIcp: (v: string) => void
  criteria: boolean
  hasSearched: boolean
  searchError: string
  find: () => void
  searching: boolean
  apiNote: string
  prospects: Prospect[]
  run: (p: Prospect) => void
  resultsRef: React.RefObject<HTMLDivElement | null>
  priorities: string[]
  setPriorities: (priorities: string[]) => void
  onOpen: (p: Prospect) => void
}) {
  const parsed = useMemo(() => parseIcp(icp), [icp])
  const canSearch = icp.trim().length >= 5 && priorities.length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSearch && !searching) find()
  }

  return (
    <div className="animate-fade-up mx-auto max-w-5xl space-y-6">
      <section className="glass-card rounded-2xl p-6 lg:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-foreground">Describe your ideal customer</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Natural language is converted into qualification criteria in real time.
            </p>
          </div>
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles size={18} />
          </div>
        </div>

        <textarea
          value={icp}
          onChange={e => setIcp(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-28 w-full resize-none rounded-xl border border-white/8 bg-black/30 p-4 text-sm leading-7 text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          placeholder="e.g. Find marketing agencies in London with 20–50 employees..."
        />

        {canSearch && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Industry', value: parsed.industry },
              { label: 'Geography', value: parsed.geography },
              { label: 'Size', value: parsed.companySize },
              { label: 'Min score', value: parsed.minScore },
            ].map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/6 bg-white/3 px-2.5 py-1 text-[11px]"
              >
                <span className="text-muted-foreground">{chip.label}</span>
                <span className="font-medium text-foreground">{chip.value}</span>
              </span>
            ))}
          </div>
        )}

        <Button
          type="button"
          onClick={() => find()}
          disabled={searching || !canSearch}
          size="lg"
          className="mt-5 h-11 w-full gap-2 text-base shadow-lg shadow-primary/20"
        >
          {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          {searching ? 'Finding prospects...' : 'Find Prospects'}
        </Button>

        {searching && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="animate-spin" size={14} />
              Trevor is searching the web for matching companies...
            </span>
            <p className="mt-1.5 text-primary/70">Finding at least 25 matching companies — this can take 30–60 seconds.</p>
          </div>
        )}

        {!canSearch && icp.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Type a bit more to enable search (at least 5 characters).</p>
        )}

        <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
          Press <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">⌘</kbd>
          {' + '}
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">Enter</kbd> to search
        </p>

        {apiNote && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs leading-relaxed text-amber-300">
            {apiNote}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-base font-medium text-foreground">ICP criteria</h2>
            <span className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              {criteria ? 'Confirmed' : 'Live preview'}
            </span>
          </div>

          {!canSearch ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Start typing your brief above — extracted criteria will appear here automatically.
            </p>
          ) : (
            <>
              <Criteria title="Target companies" items={parsed.targetCompanies} />
              <Criteria title="Ideal buyers" items={parsed.idealBuyers} />
              <PriorityPicker priorities={priorities} setPriorities={setPriorities} />
            </>
          )}
        </section>

        <section ref={resultsRef} className="glass-card flex flex-col rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-base font-medium text-foreground">Discovered prospects</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {searching
                  ? 'Searching for matching companies...'
                  : hasSearched && prospects.length > 0
                    ? `${prospects.length} candidates ranked by fit`
                    : hasSearched
                      ? 'No matches yet'
                      : 'Run a search to discover matches'}
              </p>
            </div>
            {!searching && hasSearched && prospects[0] && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => run(prospects[0])}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                Analyze top
              </Button>
            )}
          </div>

          {searching ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-3 py-2.5">
                  <div className="size-9 animate-pulse rounded-xl bg-white/6" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-white/6" />
                    <div className="h-2 w-20 animate-pulse rounded bg-white/4" />
                  </div>
                  <div className="size-8 animate-pulse rounded-full bg-white/6" />
                </div>
              ))}
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/2 py-12 text-center">
              <div className="mb-3 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Target size={20} />
              </div>
              <p className="text-sm font-medium text-foreground">No prospects yet</p>
              <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                Describe your ICP and click Find Prospects to discover real companies.
              </p>
            </div>
          ) : searchError ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-10 text-center">
              <p className="text-sm font-medium text-red-300">Search failed</p>
              <p className="mt-1 max-w-[260px] text-xs text-red-300/80">{searchError}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => find()}>
                Try again
              </Button>
            </div>
          ) : prospects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/2 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                Try broadening your industry or geography and search again.
              </p>
            </div>
          ) : (
            <ProspectsView prospects={prospects} onOpen={onOpen} onRun={run} compact />
          )}
        </section>
      </div>
    </div>
  )
}

function Criteria({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map(x => (
          <span key={x} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-foreground/90">
            {x}
          </span>
        ))}
      </div>
    </div>
  )
}

function PriorityPicker({
  priorities,
  setPriorities,
}: {
  priorities: string[]
  setPriorities: (priorities: string[]) => void
}) {
  const toggle = (priority: string) => {
    if (priorities.includes(priority)) {
      setPriorities(priorities.filter(p => p !== priority))
    } else {
      setPriorities([...priorities, priority])
    }
  }

  return (
    <div className="mb-2">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Qualification priorities</h3>
        <span className="text-[10px] text-muted-foreground">{priorities.length} selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUALIFICATION_PRIORITIES.map(priority => {
          const active = priorities.includes(priority)
          return (
            <button
              key={priority}
              type="button"
              onClick={() => toggle(priority)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs transition-all',
                active
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-white/6 bg-white/3 text-muted-foreground hover:border-white/12 hover:text-foreground',
              )}
            >
              {active && <Check size={11} className="mr-1 inline -mt-px" />}
              {priority}
            </button>
          )
        })}
      </div>
      {priorities.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-400">Select at least one priority to run a search.</p>
      )}
    </div>
  )
}

function ProspectsView({
  prospects,
  onOpen,
  onRun,
  compact = false,
}: {
  prospects: Prospect[]
  onOpen: (p: Prospect) => void
  onRun: (p: Prospect) => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {prospects.map(p => (
          <div
            key={p.id}
            className="group flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/4"
          >
            <button onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <CompanyAvatar name={p.company} />
              <span className="min-w-0">
                <b className="block truncate text-xs font-medium text-foreground">{p.company}</b>
                <span className="text-[10px] text-muted-foreground">{p.location}</span>
              </span>
            </button>
            <ScoreBadge score={p.score} />
            <Button variant="outline" size="xs" onClick={() => onRun(p)} className="shrink-0">
              Run
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter size={14} />
          All prospects
          <ChevronDown size={13} />
        </div>
        <span className="text-xs text-muted-foreground/70">Sorted by score</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {prospects.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'group grid items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]',
              compact
                ? 'grid-cols-[1.5fr_0.5fr_0.7fr_0.8fr_0.9fr_1fr_auto]'
                : 'grid-cols-[1.5fr_0.5fr_0.7fr_0.8fr_0.9fr_1fr_auto]',
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <button onClick={() => onOpen(p)} className="flex min-w-0 items-center gap-3 text-left">
              <CompanyAvatar name={p.company} />
              <span className="min-w-0">
                <b className="block truncate text-sm font-medium text-foreground">{p.company}</b>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Globe2 size={10} />
                  {p.domain}
                </span>
              </span>
            </button>
            <ScoreBadge score={p.score} />
            <span className="text-xs text-muted-foreground">{p.icpFit}</span>
            <Tag tone={p.leakage === 'High' ? 'red' : 'yellow'}>{p.leakage}</Tag>
            <span className="text-xs font-medium text-foreground/90">{p.opportunity}</span>
            <Tag tone={p.stage === 'Qualified' || p.stage === 'Sequence Ready' ? 'green' : 'blue'}>{p.stage}</Tag>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onRun(p)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              Run
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2)
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 text-[11px] font-bold text-primary ring-1 ring-white/[0.08]">
      {initials}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score > 85 ? 'text-primary' : score > 70 ? 'text-foreground' : 'text-muted-foreground'
  return (
    <div className="relative size-8">
      <div className="score-ring absolute inset-0 rounded-full" style={{ '--score': score } as React.CSSProperties} />
      <div className={cn('absolute inset-0.75 grid place-items-center rounded-full bg-card text-[10px] font-bold', color)}>
        {score}
      </div>
    </div>
  )
}

function Tag({ children, tone }: { children: React.ReactNode; tone: string }) {
  const styles = {
    red: 'bg-red-500/10 text-red-400 ring-red-500/20',
    yellow: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  }[tone] ?? 'bg-blue-500/10 text-blue-400 ring-blue-500/20'

  return (
    <span className={cn('w-fit rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset', styles)}>{children}</span>
  )
}

function Detail({
  prospect,
  tab,
  setTab,
  running,
  step,
  run,
  sequence,
  setSequence,
  back,
  apiNote,
}: {
  prospect: Prospect
  tab: 'overview' | 'competitive' | 'leakage' | 'outreach'
  setTab: (t: 'overview' | 'competitive' | 'leakage' | 'outreach') => void
  running: boolean
  step: number
  run: () => void
  sequence: Record<string, boolean>
  setSequence: (s: Record<string, boolean>) => void
  back: () => void
  apiNote: string
}) {
  const [expanded, setExpanded] = useState(0)
  const data = prospect.research
  const hasResearch = hasLiveResearch(prospect)

  return (
    <div className="mesh-bg min-h-screen text-foreground">
      <main className="mx-auto max-w-6xl px-8 py-8 lg:px-12">
        <button
          onClick={back}
          className="animate-fade-up mb-8 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to prospects
        </button>

        <div className="animate-fade-up mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <CompanyAvatar name={prospect.company} />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-2xl font-medium text-foreground lg:text-3xl">{prospect.company}</h1>
                <Tag tone="green">{prospect.stage}</Tag>
              </div>
              <p className="text-sm text-muted-foreground">
                {prospect.domain} · {prospect.location} · {prospect.size} employees
              </p>
            </div>
          </div>
          <Button onClick={run} disabled={running} size="lg" className="gap-2 shadow-lg shadow-primary/20">
            {running ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {running ? 'Running analysis...' : 'Run Full Analysis'}
          </Button>
        </div>

        {running && <RunProgress step={step} />}

        {apiNote && !running && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 text-xs leading-relaxed text-amber-300">
            {apiNote}
          </div>
        )}

        {!hasResearch && !running && (
          <div className="mb-6 rounded-xl border border-white/8 bg-white/3 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No analysis yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run full analysis to research this company, score the opportunity, and generate outreach.
            </p>
          </div>
        )}

        {(hasResearch || running) && data && (
          <>
            <div className="mb-8 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              {(['overview', 'competitive', 'leakage', 'outreach'] as const).map(x => (
                <button
                  onClick={() => setTab(x)}
                  key={x}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-2.5 text-xs font-medium capitalize transition-all',
                    tab === x ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {x === 'competitive' ? 'Competitive Analysis' : x}
                </button>
              ))}
            </div>

            {tab === 'overview' && <Overview prospect={prospect} data={data} setTab={setTab} />}
            {tab === 'competitive' && <Competitive prospect={prospect} data={data} />}
            {tab === 'leakage' && <Leakage data={data} prospect={prospect} />}
            {tab === 'outreach' && data && (
              <Outreach
                prospect={prospect}
                data={data}
                expanded={expanded}
                setExpanded={setExpanded}
                active={sequence[prospect.id]}
                launch={() => setSequence({ ...sequence, [prospect.id]: true })}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function RunProgress({ step }: { step: number }) {
  const pct = Math.min(100, Math.round(((step + 1) / steps.length) * 100))

  return (
    <div className="animate-fade-up mb-8 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles size={15} className="animate-pulse" />
          Running autonomous analysis
        </span>
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{pct}%</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((x, i) => (
          <div
            key={x}
            className={cn(
              'flex items-center gap-1.5 text-[10px]',
              i < step ? 'text-emerald-400' : i === step ? 'text-primary' : 'text-muted-foreground/50',
            )}
          >
            {i < step ? <Check size={12} /> : i === step ? <Loader2 className="animate-spin" size={12} /> : <CircleDashed size={12} />}
            {x}
          </div>
        ))}
      </div>
    </div>
  )
}

function Overview({
  prospect,
  data,
  setTab,
}: {
  prospect: Prospect
  data: Research
  setTab: (t: 'overview' | 'competitive' | 'leakage' | 'outreach') => void
}) {
  const metrics = data.scores
    ? [
        ['ICP Fit', data.scores.icpFit],
        ['SEO opportunity', data.scores.seoOpportunity],
        ['Competitor leakage', data.scores.competitorLeakage],
        ['Commercial potential', data.scores.commercialPotential],
        ['Conversion leakage', data.scores.conversionLeakage],
        ['Contactability', data.scores.contactability],
      ]
    : []

  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-lg font-medium text-foreground">AI qualification</h2>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary">
              {prospect.score}
              <small className="text-sm font-normal text-muted-foreground"> / 100</small>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">{priorityLabel(prospect.score)}</div>
          </div>
        </div>
        <p className="mb-6 text-sm leading-7 text-muted-foreground">{prospect.summary}</p>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map(([label, n]) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="mb-2.5 flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <b className="font-semibold text-foreground">{n}</b>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all"
                  style={{ width: `${n}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="mb-5 font-serif text-lg font-medium text-foreground">Company research</h2>
        <Info title="Services" value={data.services.join(' · ') || '—'} />
        <Info title="Service areas" value={data.markets.join(' · ') || '—'} />
        <Info title="Decision makers" value={data.decisionMakers?.join(' · ') || '—'} />
        <Info title="Commercial signals" value={data.commercialSignals?.join(' · ') || '—'} />
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-primary">Recommended action</span>
          <p className="text-xs leading-5 text-muted-foreground">
            {data.recommendedAction || data.angle || 'Launch personalized outreach based on the research findings.'}
          </p>
        </div>
        <button
          onClick={() => setTab('competitive')}
          className="mt-5 flex items-center gap-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          View competitive analysis
          <ArrowRight size={14} />
        </button>
      </section>
    </div>
  )
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="text-xs leading-6 text-foreground/90">{value}</div>
    </div>
  )
}

function Competitive({ prospect, data }: { prospect: Prospect; data: Research }) {
  const rows = data.competitiveMetrics ?? []
  const competitors = prospect.competitors.slice(0, 3)

  return (
    <div className="animate-fade-up space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-medium text-foreground">{prospect.company} vs competitors</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">Observed and estimated web intelligence — not third-party SEO tool metrics.</p>
          </div>
          <ExternalLink size={16} className="text-muted-foreground" />
        </div>
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div
              className="grid bg-white/[0.03] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: `1.2fr 1fr repeat(${competitors.length}, 1fr)` }}
            >
              <span>Metric</span>
              <span>Prospect</span>
              {competitors.map(x => (
                <span key={x}>{x}</span>
              ))}
            </div>
            {rows.map(row => (
              <div
                key={row.metric}
                className="grid border-t border-white/[0.04] px-4 py-3 text-xs transition-colors hover:bg-white/[0.02]"
                style={{ gridTemplateColumns: `1.2fr 1fr repeat(${competitors.length}, 1fr)` }}
              >
                <span className="text-muted-foreground">{row.metric}</span>
                <span className="font-medium text-amber-400">{row.prospect}</span>
                {competitors.map((name, j) => (
                  <span key={name} className={j === 0 ? 'font-medium text-emerald-400' : 'text-foreground/80'}>
                    {row.competitors[j] ?? '—'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No competitive metrics available yet.</p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {data.gaps.slice(0, 3).map((x, i) => (
          <div key={x} className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <TrendingUp size={12} />
              {['Missing service coverage', 'Competitor advantage', 'Local SEO weakness'][i] ?? 'Gap identified'}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{x}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Leakage({ data, prospect }: { data: Research; prospect: Prospect }) {
  const rows = [
    ['Search leakage', data.gaps[0], prospect.competitors[0], 'High'],
    ['Local SEO leakage', data.gaps[1], prospect.competitors[1], 'High'],
    ['Conversion leakage', data.conversion[0], '—', 'High'],
    ['Trust / review leakage', data.conversion[1], prospect.competitors[2], 'Medium'],
  ].filter(([, evidence]) => evidence)

  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="glass-card rounded-2xl p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">Competitor leakage</h2>
        <p className="mb-6 mt-1 text-xs text-muted-foreground">Where potential demand appears to be going instead.</p>
        <div className="space-y-3">
          {rows.map(([type, evidence, winner, priority]) => (
            <div key={type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.1]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{type}</span>
                <Tag tone={priority === 'High' ? 'red' : 'yellow'}>{priority} priority</Tag>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">{evidence}</p>
              <div className="mt-3 flex items-center gap-5 text-[10px] text-muted-foreground">
                <span>
                  Winning: <b className="text-foreground/80">{winner}</b>
                </span>
                <span>
                  Impact: <b className="text-red-400">Commercial</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">AI-estimated opportunity</h2>
        <p className="mb-6 mt-1 text-xs text-muted-foreground">Directional model, not a guaranteed forecast.</p>
        <div className="mb-6 text-4xl font-bold text-primary">
          {prospect.opportunity}
          <span className="ml-2 text-xs font-normal text-muted-foreground">/ year</span>
        </div>
        {[
          ['Traffic opportunity', 'High-intent service/location gaps'],
          ['Lead opportunity', 'Conversion and CTA improvements'],
          ['Revenue opportunity', 'Estimated service value × likely lift'],
        ].map(([x, y]) => (
          <div className="mb-4 border-b border-white/[0.06] pb-4" key={x}>
            <div className="text-sm text-foreground">{x}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{y}</div>
          </div>
        ))}
        <div className="mt-5 text-[10px] leading-5 text-muted-foreground/70">
          Assumptions: observed competitor coverage, inferred commercial intent, estimated conversion improvement and typical service value.
        </div>
      </section>
    </div>
  )
}

function Outreach({
  prospect,
  data,
  expanded,
  setExpanded,
  active,
  launch,
}: {
  prospect: Prospect
  data: Research
  expanded: number
  setExpanded: (i: number) => void
  active: boolean
  launch: () => void
}) {
  const ready = hasLiveResearch({ ...prospect, research: data })

  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-lg font-medium text-foreground">Recommended strategy</h2>
          <Sparkles size={16} className="text-primary" />
        </div>
        <Info title="Primary pain point" value={data.gaps[0] || data.conversion[0] || 'Competitive gaps identified during research.'} />
        <Info title="Pitch angle" value={data.angle} />
        <Info title="Buyer persona" value={data.decisionMakers?.slice(0, 2).join(' or ') || 'Decision maker'} />
        <Info title="Tone" value="Specific, evidence-led, concise" />
        <Info title="CTA" value={data.recommendedAction || '15-minute competitor leakage walkthrough'} />
        {ready ? (
          active ? (
            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-400">
              <Check size={14} className="mb-1.5" />
              Sequence active
              <br />
              <span className="text-emerald-400/60">Day 1 sent · Day 3 scheduled · Day 7 scheduled · Day 12 scheduled</span>
            </div>
          ) : (
            <Button onClick={launch} size="lg" className="mt-6 w-full gap-2 shadow-lg shadow-primary/20">
              <Send size={14} />
              Launch Sequence
            </Button>
          )
        ) : (
          <p className="mt-6 text-xs text-muted-foreground">Run full analysis to generate a personalized outreach sequence.</p>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-medium text-foreground">Four-touch sequence</h2>
            <p className="mt-1 text-xs text-muted-foreground">Every message uses actual research evidence.</p>
          </div>
          <Tag tone="blue">{active ? 'Active' : 'Draft'}</Tag>
        </div>
        <div className="space-y-3">
          {ready ? (
            data.emails.map((email, i) => (
            <div key={email.day} className="overflow-hidden rounded-xl border border-white/[0.06] transition-colors hover:border-white/[0.1]">
              <button
                onClick={() => setExpanded(expanded === i ? -1 : i)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                    {email.day}
                  </span>
                  <span className="text-sm text-foreground">{email.subject}</span>
                </span>
                <ChevronDown size={15} className={cn('text-muted-foreground transition-transform', expanded === i && 'rotate-180')} />
              </button>
              {expanded === i && (
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                  <p className="text-xs leading-7 text-muted-foreground">{email.body}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-[10px] text-muted-foreground">Personalized using:</span>
                    {email.evidence.map(e => (
                      <span key={e} className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground">
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="xs">
                      Edit
                    </Button>
                    <Button variant="outline" size="xs">
                      Regenerate
                    </Button>
                    <Button variant="outline" size="xs">
                      Skip
                    </Button>
                  </div>
                </div>
              )}
            </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/8 bg-white/2 px-4 py-8 text-center text-xs text-muted-foreground">
              Outreach emails will appear here after you run full analysis for {prospect.company}.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Campaigns({
  prospects,
  sequence,
  onOpen,
}: {
  prospects: Prospect[]
  sequence: Record<string, boolean>
  onOpen: (p: Prospect) => void
}) {
  const active = prospects.filter(p => sequence[p.id])

  return (
    <section className="animate-fade-up glass-card max-w-5xl overflow-hidden rounded-2xl">
      <div className="grid grid-cols-5 border-b border-white/[0.06] bg-white/[0.02] px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span>Campaign</span>
        <span>Prospects</span>
        <span>Active</span>
        <span>Sent</span>
        <span>Replies</span>
      </div>
      <div className="grid grid-cols-5 items-center px-6 py-6 text-sm">
        <span className="flex items-center gap-2.5 font-medium text-foreground">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          Texas roofing leakage
        </span>
        <span className="text-muted-foreground">{prospects.length}</span>
        <span className="font-semibold text-emerald-400">{active.length || 0}</span>
        <span className="text-muted-foreground">{active.length || 0}</span>
        <span className="text-muted-foreground">0</span>
      </div>
      {active.length > 0 && (
        <div className="border-t border-white/[0.06] px-6 py-4 text-xs text-muted-foreground">
          Active prospects
          <span className="ml-3">
            {active.map(p => (
              <button onClick={() => onOpen(p)} className="mr-2 font-medium text-primary hover:underline" key={p.id}>
                {p.company}
              </button>
            ))}
          </span>
        </div>
      )}
    </section>
  )
}
