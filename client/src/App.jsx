import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import DecodeWorkspace from './DecodeWorkspace'

export const API = import.meta.env.VITE_API_URL || ''

function LogoMark() {
  return (
    <div style={s.logoMark}>V</div>
  )
}

export default function App() {
  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.wordmark}>
          <LogoMark />
          <span style={s.logoText}>
            Verdict<span style={s.logoPeriod}>.</span>
          </span>
        </div>
        <SignedIn>
          <UserButton />
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
