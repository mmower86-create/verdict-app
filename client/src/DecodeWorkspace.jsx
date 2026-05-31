import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { API } from './App'
import VerdictMarkdown from './VerdictMarkdown'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function useUpgradeReturn(onUpgraded) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
      onUpgraded()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

const LOADER_STEPS = [
  'Reading the document...',
  'Scanning the clauses...',
  'Checking what could cost you...',
  'Formulating the verdict...',
]
const STEP_DELAYS_MS = [6000, 7000, 8000]

function NarratedLoader() {
  const [stepIndex, setStepIndex] = useState(0)
  const timeoutsRef = useRef([])

  useEffect(() => {
    STEP_DELAYS_MS.forEach((_, i) => {
      const total = STEP_DELAYS_MS.slice(0, i + 1).reduce((a, b) => a + b, 0)
      const id = setTimeout(() => setStepIndex(i + 1), total)
      timeoutsRef.current.push(id)
    })
    return () => timeoutsRef.current.forEach(clearTimeout)
  }, [])

  return (
    <div style={s.loader}>
      {LOADER_STEPS.map((step, i) => (
        <div
          key={step}
          style={{
            ...s.loaderStep,
            opacity: i <= stepIndex ? 1 : 0.25,
            color: i < stepIndex ? RED : INK,
          }}
        >
          <span style={s.loaderIcon}>{i < stepIndex ? '✓' : i === stepIndex ? '›' : '·'}</span>
          {step}
        </div>
      ))}
    </div>
  )
}

function VerdictDisplay({ text }) {
  return <VerdictMarkdown text={text} style={s.verdict} />
}

const PLAN_LABEL = { free: 'Free', pro: 'Pro', business: 'Business' }

function UsageBadge({ usage }) {
  if (!usage) return null
  // limit === null means uncapped (owner/comp accounts only).
  if (usage.limit === null) {
    const label = PLAN_LABEL[usage.plan] || 'Pro'
    return <p style={{ ...s.usageBadge, color: RED }}>{label} &middot; unlimited decodes</p>
  }
  const remaining = usage.limit - usage.used
  const color = remaining === 0 ? RED : remaining === 1 ? '#92400E' : MUTED
  const planWord = usage.plan === 'free' ? 'free ' : ''
  return (
    <p style={{ ...s.usageBadge, color }}>
      {usage.used} of {usage.limit} {planWord}decodes used this month
      {remaining === 1 ? '. 1 remaining.' : ''}
    </p>
  )
}

const PLAN_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    period: 'current plan',
    features: ['3 lease decodes per month', 'Full verdict, red flags, and moves', 'No card required'],
    cta: 'Your current plan',
    featured: false,
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$39',
    period: 'per month',
    features: ['15 decodes per month', 'All document types as they launch', 'Saved verdict history', 'Priority processing'],
    cta: 'Upgrade to Pro',
    featured: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$79',
    period: 'per month',
    features: ['100 decodes per month', 'Everything in Pro', 'Commercial-use license', 'Exportable negotiating scripts'],
    cta: 'Get Business',
    featured: false,
  },
]

function LimitReached({ onUpgrade, usage }) {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [error, setError] = useState(null)

  async function handleUpgrade(plan) {
    setLoadingPlan(plan)
    setError(null)
    try {
      const { url } = await onUpgrade(plan)
      window.location.href = url
    } catch {
      setError('Could not start checkout. Please try again.')
      setLoadingPlan(null)
    }
  }

  const usedLimit = usage?.limit ?? 3
  return (
    <div style={s.limitWrap}>
      <h2 style={s.limitHeading}>You've used all {usedLimit} free decodes this month.</h2>
      <p style={s.limitBody}>Pick a plan to keep going. Decodes reset on the 1st of each month.</p>

      <div style={s.tierGrid}>
        {PLAN_TIERS.map((tier) => (
          <div key={tier.id} style={tier.featured ? { ...s.tierCard, ...s.tierCardFeatured } : s.tierCard}>
            {tier.featured && <span style={s.tierBadge}>Recommended</span>}
            <p style={s.tierName}>{tier.name}</p>
            <p style={s.tierPrice}>{tier.price}<span style={s.tierPeriod}> / {tier.period === 'per month' ? 'mo' : tier.period}</span></p>
            <ul style={s.tierFeatures}>
              {tier.features.map((f) => <li key={f} style={s.tierFeature}>{f}</li>)}
            </ul>
            {tier.current ? (
              <div style={s.tierCurrentBtn}>{tier.cta}</div>
            ) : (
              <button
                style={{
                  ...(tier.featured ? s.tierBtnFeatured : s.tierBtn),
                  opacity: loadingPlan && loadingPlan !== tier.id ? 0.5 : 1,
                  cursor: loadingPlan ? 'wait' : 'pointer',
                }}
                onClick={() => handleUpgrade(tier.id)}
                disabled={!!loadingPlan}
              >
                {loadingPlan === tier.id ? 'Starting checkout...' : tier.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p style={s.errorMsg}>{error}</p>}
    </div>
  )
}

// Pull a short, human title out of a verdict's text so history rows are
// distinguishable instead of all reading "Lease analysis". Falls back gracefully.
function verdictSnippet(text) {
  if (!text) return 'Lease analysis'
  let t = String(text).replace(/\r/g, '')
  t = t.replace(/^\s*THE VERDICT\s*:?\s*/i, '') // drop the leading section label
  const line = t.split('\n').map((l) => l.trim()).find(Boolean) || ''
  const clean = line.replace(/\*\*/g, '').replace(/[#>`_]/g, '').trim()
  if (!clean) return 'Lease analysis'
  return clean.length > 90 ? clean.slice(0, 90).replace(/\s+\S*$/, '') + '…' : clean
}

// Bucket a timestamp into a coarse group for sectioned history.
function historyGroupOf(iso) {
  const d = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = 86400000
  if (d >= startToday) return 'Today'
  if (d >= new Date(startToday.getTime() - 6 * day)) return 'This week'
  if (d >= new Date(now.getFullYear(), now.getMonth(), 1)) return 'Earlier this month'
  return 'Older'
}

const HISTORY_GROUP_ORDER = ['Today', 'This week', 'Earlier this month', 'Older']

function HistorySection({ items, onSelect }) {
  const [query, setQuery] = useState('')
  if (!items || items.length === 0) return null

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((it) =>
        verdictSnippet(it.result_text).toLowerCase().includes(q) ||
        (it.doc_type || '').toLowerCase().includes(q) ||
        (it.result_text || '').toLowerCase().includes(q)
      )
    : items

  const groups = {}
  for (const it of filtered) {
    const g = historyGroupOf(it.created_at)
    ;(groups[g] = groups[g] || []).push(it)
  }

  return (
    <div style={s.historySection}>
      <div style={s.historyHead}>
        <p style={s.historyLabel}>Past verdicts</p>
        <input
          style={s.historySearch}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search past verdicts..."
        />
      </div>

      {filtered.length === 0 ? (
        <p style={s.historyEmpty}>No verdicts match that search.</p>
      ) : (
        HISTORY_GROUP_ORDER.filter((g) => groups[g]).map((g) => (
          <div key={g} style={s.historyGroup}>
            <p style={s.historyGroupLabel}>{g}</p>
            <ul style={s.historyList}>
              {groups[g].map((item) => (
                <li
                  key={item.id}
                  style={s.historyItem}
                  onClick={() => onSelect(item)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(28,25,23,0.03)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={s.historyItemMain}>
                    <span style={s.historyDocType}>
                      {item.doc_type === 'lease' ? 'Lease' : item.doc_type}
                    </span>
                    <span style={s.historySnippet}>{verdictSnippet(item.result_text)}</span>
                  </span>
                  <span style={s.historyDate}>{formatDate(item.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DecodeWorkspace() {
  const { getToken } = useAuth()
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error | limit_reached | history
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [usage, setUsage] = useState(null)
  const [justUpgraded, setJustUpgraded] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [activeHistoryItem, setActiveHistoryItem] = useState(null)

  async function fetchUsage() {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/usage`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setUsage(await res.json())
    } catch { /* non-critical */ }
  }

  async function fetchHistory() {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/history`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setHistoryItems(await res.json())
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    fetchUsage()
    fetchHistory()
  }, [getToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useUpgradeReturn(() => {
    setJustUpgraded(true)
    setStatus('idle')
    fetchUsage()
  })

  async function startCheckout(plan = 'pro') {
    const token = await getToken()
    const res = await fetch(`${API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    })
    if (!res.ok) throw new Error('checkout failed')
    return res.json()
  }

  async function handleSubmit() {
    if (!text.trim()) return
    setStatus('loading')
    setResult(null)
    setErrorMsg(null)

    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ docType: 'lease', text }),
      })
      const data = await res.json()

      if (res.status === 402 && data.error === 'limit_reached') {
        setUsage({ plan: 'free', used: data.used, limit: data.limit })
        setStatus('limit_reached')
        return
      }
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }

      setUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev)
      setResult(data.result)
      setStatus('done')
      fetchHistory()
    } catch {
      setErrorMsg('Could not reach the server. Please try again.')
      setStatus('error')
    }
  }

  function handleReset() {
    setText('')
    setResult(null)
    setErrorMsg(null)
    setStatus('idle')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'loading') return <NarratedLoader />

  if (status === 'limit_reached') return <LimitReached onUpgrade={startCheckout} usage={usage} />

  if (status === 'history' && activeHistoryItem) {
    return (
      <div>
        <button
          style={s.backBtn}
          onClick={() => { setActiveHistoryItem(null); setStatus('idle') }}
        >
          Back to workspace
        </button>
        <p style={s.historyItemMeta}>
          {activeHistoryItem.doc_type === 'lease' ? 'Lease' : activeHistoryItem.doc_type} analysis &middot; {formatDate(activeHistoryItem.created_at)}
        </p>
        <VerdictDisplay text={activeHistoryItem.result_text} />
      </div>
    )
  }

  if (status === 'done' && result) {
    return (
      <div>
        <UsageBadge usage={usage} />
        <VerdictDisplay text={result} />
        <button onClick={handleReset} style={s.ghostBtn}>Analyze another document</button>
      </div>
    )
  }

  return (
    <div>
      <UsageBadge usage={usage} />
      {justUpgraded && (
        <p style={s.upgradedBanner}>You're upgraded. Your new monthly decode limit is active now.</p>
      )}
      {status === 'error' && <p style={s.errorMsg}>{errorMsg}</p>}
      <label style={s.label} htmlFor="lease-input">Paste your lease below</label>
      <textarea
        id="lease-input"
        style={s.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full text of your lease here..."
        rows={16}
      />
      <button
        style={{
          ...s.primaryBtn,
          opacity: text.trim() ? 1 : 0.45,
          cursor: text.trim() ? 'pointer' : 'not-allowed',
        }}
        onClick={handleSubmit}
        disabled={!text.trim()}
      >
        Get the verdict
      </button>
      <HistorySection
        items={historyItems}
        onSelect={(item) => { setActiveHistoryItem(item); setStatus('history') }}
      />
    </div>
  )
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const INK    = '#1C1917'
const MUTED  = '#6B6459'
const RED    = '#B91C1C'
const CREAM  = '#F7F5F0'
const BORDER = '#E0DDD6'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  usageBadge: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    color: MUTED,
    margin: '0 0 28px',
  },
  label: {
    display: 'block',
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.85rem',
    fontWeight: 500,
    color: MUTED,
    marginBottom: 8,
    letterSpacing: '0.01em',
  },
  textarea: {
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    fontSize: '0.95rem',
    fontFamily: "'Instrument Sans', sans-serif",
    lineHeight: 1.65,
    color: INK,
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    resize: 'vertical',
    marginBottom: 16,
    boxSizing: 'border-box',
  },
  primaryBtn: {
    padding: '13px 28px',
    background: INK,
    color: CREAM,
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.95rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: 'pointer',
  },
  ghostBtn: {
    marginTop: 36,
    padding: '10px 20px',
    background: 'transparent',
    color: INK,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  backBtn: {
    padding: '0 0 24px',
    background: 'transparent',
    border: 'none',
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: MUTED,
    cursor: 'pointer',
    display: 'block',
  },
  loader: {
    padding: '48px 0',
  },
  loaderStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    fontFamily: "'Fraunces', serif",
    fontStyle: 'italic',
    fontSize: '1.1rem',
    padding: '10px 0',
    transition: 'opacity 0.5s ease, color 0.4s ease',
  },
  loaderIcon: {
    fontFamily: "'Geist Mono', monospace",
    fontStyle: 'normal',
    fontSize: '0.85rem',
    color: RED,
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
  },
  verdict: {
    borderTop: `2px solid ${INK}`,
    paddingTop: 36,
    marginTop: 4,
  },
  section: {
    marginBottom: 36,
  },
  sectionHeading: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.7rem',
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: MUTED,
    margin: '0 0 10px',
    borderBottom: `1px solid ${BORDER}`,
    paddingBottom: 8,
  },
  sectionBody: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '1rem',
    lineHeight: 1.8,
    color: INK,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  upgradedBanner: {
    background: '#F0FDF4',
    border: '1px solid #86EFAC',
    borderRadius: 4,
    padding: '10px 16px',
    marginBottom: 24,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.875rem',
    color: '#166534',
    fontWeight: 500,
  },
  errorMsg: {
    fontFamily: "'Instrument Sans', sans-serif",
    color: RED,
    marginBottom: 16,
    fontSize: '0.875rem',
  },
  limitWrap: {
    padding: '40px 0',
  },
  limitHeading: {
    fontFamily: "'Fraunces', serif",
    fontSize: '1.5rem',
    fontWeight: 600,
    color: INK,
    margin: '0 0 10px',
    lineHeight: 1.25,
  },
  limitBody: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '1rem',
    color: MUTED,
    lineHeight: 1.65,
    margin: '0 0 36px',
  },
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    alignItems: 'center',
    maxWidth: 760,
  },
  tierCard: {
    position: 'relative',
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: '28px 22px',
    display: 'flex',
    flexDirection: 'column',
  },
  tierCardFeatured: {
    border: `1px solid ${RED}`,
    background: 'linear-gradient(180deg, #FEF2F2 0%, #fff 55%)',
    boxShadow: `0 0 0 1px ${RED}, 0 12px 32px rgba(185,28,28,0.10)`,
    transform: 'translateY(-10px) scale(1.03)',
    zIndex: 2,
  },
  tierBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: 'translateX(-50%)',
    background: RED,
    color: '#fff',
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.6rem',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '4px 12px',
    borderRadius: 100,
    whiteSpace: 'nowrap',
  },
  tierName: {
    fontFamily: "'Fraunces', serif",
    fontSize: '1.15rem',
    fontWeight: 600,
    color: INK,
    margin: '0 0 6px',
  },
  tierPrice: {
    fontFamily: "'Fraunces', serif",
    fontSize: '2rem',
    fontWeight: 600,
    color: INK,
    lineHeight: 1,
    margin: '0 0 18px',
  },
  tierPeriod: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.8rem',
    fontWeight: 500,
    color: MUTED,
  },
  tierFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 22px',
    flex: 1,
  },
  tierFeature: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.82rem',
    color: INK,
    lineHeight: 1.45,
    padding: '7px 0',
    borderBottom: `1px solid ${BORDER}`,
  },
  tierBtn: {
    padding: '11px 16px',
    background: '#fff',
    color: INK,
    border: `1px solid ${INK}`,
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.85rem',
    fontWeight: 600,
    textAlign: 'center',
  },
  tierBtnFeatured: {
    padding: '11px 16px',
    background: RED,
    color: '#fff',
    border: `1px solid ${RED}`,
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.85rem',
    fontWeight: 600,
    textAlign: 'center',
  },
  tierCurrentBtn: {
    padding: '11px 16px',
    background: 'transparent',
    color: MUTED,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.85rem',
    fontWeight: 500,
    textAlign: 'center',
  },
  historySection: {
    marginTop: 64,
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 32,
  },
  historyLabel: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.7rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: MUTED,
    margin: '0 0 16px',
  },
  historyList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  historyHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  historySearch: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.85rem',
    padding: '8px 12px',
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    background: '#fff',
    color: INK,
    width: 220,
    maxWidth: '100%',
    outline: 'none',
  },
  historyEmpty: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.9rem',
    color: MUTED,
    margin: '8px 0 0',
  },
  historyGroup: {
    marginBottom: 20,
  },
  historyGroupLabel: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.62rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: MUTED,
    margin: '0 0 6px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '14px 4px',
    borderBottom: `1px solid ${BORDER}`,
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'background 0.15s ease',
  },
  historyItemMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
  historyDocType: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.6rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: RED,
    fontWeight: 500,
  },
  historySnippet: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.92rem',
    color: INK,
    fontWeight: 500,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  historyDate: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.72rem',
    color: MUTED,
    letterSpacing: '0.03em',
  },
  historyItemMeta: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: MUTED,
    margin: '0 0 28px',
  },
}
