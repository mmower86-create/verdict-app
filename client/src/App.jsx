import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import DecodeWorkspace from './DecodeWorkspace'

export const API = import.meta.env.VITE_API_URL || ''

function LogoMark() {
  return <div style={s.logoMark}>V</div>
}

function HeaderPlanStatus() {
  const { getToken } = useAuth()
  const [usage, setUsage] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const token = await getToken()
        const res = await fetch(`${API}/api/usage`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setUsage(await res.json())
      } catch { /* non-critical */ }
    }
    fetchUsage()
  }, [getToken])

  async function handleUpgrade() {
    setCheckoutLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setCheckoutLoading(false)
    }
  }

  if (!usage) return null

  // Any paid plan (pro/business) or a comped uncapped account shows a plain badge,
  // never the upgrade prompt.
  if (usage.plan === 'pro' || usage.plan === 'business' || usage.limit === null) {
    const label = usage.plan === 'business' ? 'Business' : 'Pro'
    return <span style={s.proBadge}>{label}</span>
  }

  return (
    <div style={s.freeStatus}>
      <span style={s.freeUsage}>{usage.used} of {usage.limit} free this month</span>
      <button
        style={{ ...s.upgradeBtn, opacity: checkoutLoading ? 0.6 : 1 }}
        onClick={handleUpgrade}
        disabled={checkoutLoading}
      >
        {checkoutLoading ? 'Loading...' : 'Upgrade'}
      </button>
    </div>
  )
}

export default function App() {
  return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="https://getverdict.net" style={s.wordmark}>
          <LogoMark />
          <span style={s.logoText}>
            Verdict<span style={s.logoPeriod}>.</span>
          </span>
        </a>
        <SignedIn>
          <div style={s.headerRight}>
            <HeaderPlanStatus />
            <UserButton />
          </div>
        </SignedIn>
      </header>

      <main style={s.main}>
        <SignedOut>
          <h1 style={s.headline}>
            Read your lease.<br />Know where you stand.
          </h1>
          <p style={s.subhead}>
            Paste any residential lease and get a sharp, tenant-side analysis in under a minute.
          </p>
          <SignInButton mode="modal">
            <button style={s.ctaBtn}>Sign in to get started</button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <DecodeWorkspace />
        </SignedIn>
      </main>
    </div>
  )
}

const INK    = '#1C1917'
const MUTED  = '#6B6459'
const RED    = '#B91C1C'
const CREAM  = '#F7F5F0'
const BORDER = '#E0DDD6'

const s = {
  page: {
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
    minHeight: '100vh',
    background: CREAM,
    color: INK,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 40px',
    borderBottom: `1px solid ${BORDER}`,
    background: CREAM,
  },
  wordmark: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  logoMark: {
    width: 28,
    height: 28,
    background: RED,
    color: '#fff',
    fontFamily: "'Fraunces', serif",
    fontWeight: 700,
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    lineHeight: 1,
    userSelect: 'none',
  },
  logoText: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 700,
    fontSize: '1.25rem',
    color: INK,
    letterSpacing: '-0.02em',
  },
  logoPeriod: {
    color: RED,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  proBadge: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.7rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: RED,
    fontWeight: 500,
  },
  manageBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: INK,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  freeStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  freeUsage: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.72rem',
    color: MUTED,
    letterSpacing: '0.03em',
  },
  upgradeBtn: {
    padding: '6px 14px',
    background: INK,
    color: CREAM,
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  main: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '56px 32px',
  },
  headline: {
    fontFamily: "'Fraunces', serif",
    fontSize: '2.75rem',
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    color: INK,
    margin: '0 0 20px',
  },
  subhead: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '1.1rem',
    color: MUTED,
    lineHeight: 1.65,
    margin: '0 0 36px',
    maxWidth: 520,
  },
  ctaBtn: {
    padding: '14px 32px',
    background: INK,
    color: CREAM,
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
}
