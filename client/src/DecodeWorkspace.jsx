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

function UsageBadge({ usage }) {
  if (!usage) return null
  if (usage.plan === 'pro') {
    return <p style={{ ...s.usageBadge, color: RED }}>Pro &middot; unlimited decodes</p>
  }
  const remaining = usage.limit - usage.used
  const color = remaining === 0 ? RED : remaining === 1 ? '#92400E' : MUTED
  return (
    <p style={{ ...s.usageBadge, color }}>
      {usage.used} of {usage.limit} free decodes used this month
      {remaining === 1 ? '. 1 remaining.' : ''}
    </p>
  )
}

function LimitReached({ onUpgrade }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const { url } = await onUpgrade()
      window.location.href = url
    } catch {
      setError('Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={s.limitBox}>
      <h2 style={s.limitHeading}>You have used all 3 free decodes this month.</h2>
      <p style={s.limitBody}>
        Upgrade to Pro for unlimited decodes. Pro users get full access every month, no cap.
      </p>
      <button
        style={{ ...s.upgradeBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? 'Starting checkout...' : 'Upgrade to Pro'}
      </button>
      {error && <p style={s.errorMsg}>{error}</p>}
      <p style={s.limitNote}>Decodes reset on the 1st of each month.</p>
    </div>
  )
}

function HistorySection({ items, onSelect }) {
  if (!items || items.length === 0) return null
  return (
    <div style={s.historySection}>
      <p style={s.historyLabel}>Past verdicts</p>
      <ul style={s.historyList}>
        {items.map((item) => (
          <li
            key={item.id}
            style={s.historyItem}
            onClick={() => onSelect(item)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(28,25,23,0.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={s.historyDocType}>
              {item.doc_type === 'lease' ? 'Lease analysis' : item.doc_type}
            </span>
            <span style={s.historyDate}>{formatDate(item.created_at)}</span>
          </li>
        ))}
      </ul>
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

  async function startCheckout() {
    const token = await getToken()
    const res = await fetch(`${API}/api/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
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

  if (status === 'limit_reached') return <LimitReached onUpgrade={startCheckout} />

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
        <p style={s.upgradedBanner}>You are now on Pro. Unlimited decodes, starting now.</p>
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
  limitBox: {
    padding: '48px 0',
    maxWidth: 500,
  },
  limitHeading: {
    fontFamily: "'Fraunces', serif",
    fontSize: '1.5rem',
    fontWeight: 600,
    color: INK,
    margin: '0 0 12px',
    lineHeight: 1.25,
  },
  limitBody: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '1rem',
    color: MUTED,
    lineHeight: 1.65,
    margin: '0 0 28px',
  },
  upgradeBtn: {
    padding: '13px 28px',
    background: RED,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.95rem',
    fontWeight: 600,
    display: 'block',
    marginBottom: 16,
  },
  limitNote: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.8rem',
    color: MUTED,
    margin: 0,
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
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 4px',
    borderBottom: `1px solid ${BORDER}`,
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'background 0.15s ease',
  },
  historyDocType: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.95rem',
    color: INK,
    fontWeight: 500,
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
