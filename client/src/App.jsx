import { useEffect, useState } from 'react'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/clerk-react'
import DecodeWorkspace from './DecodeWorkspace'

function HealthStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.ok ? 'connected' : 'error'))
      .catch(() => setStatus('error'))
  }, [])

  const color = status === 'connected' ? 'green' : status === 'error' ? 'red' : 'gray'
  const label =
    status === 'connected'
      ? 'Backend connected'
      : status === 'error'
      ? 'Backend not reachable'
      : 'Checking backend...'

  return (
    <span style={{ color, fontSize: '0.8rem' }}>{label}</span>
  )
}

export default function App() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>Verdict</span>
          <HealthStatus />
        </div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <main style={styles.main}>
        <SignedOut>
          <h1 style={styles.headline}>Read your lease.<br />Know where you stand.</h1>
          <p style={styles.subhead}>
            Paste any residential lease and get a sharp, tenant-side analysis in under a minute.
          </p>
          <SignInButton mode="modal">
            <button style={styles.ctaBtn}>Sign in to get started</button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <DecodeWorkspace />
        </SignedIn>
      </main>
    </div>
  )
}

const styles = {
  page: {
    fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
    minHeight: '100vh',
    background: '#fafafa',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    borderBottom: '1px solid #e5e5e5',
    background: '#fff',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#1a1a1a',
  },
  main: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 24px',
  },
  headline: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
    color: '#1a1a1a',
    margin: '0 0 16px',
  },
  subhead: {
    fontSize: '1.1rem',
    color: '#555',
    lineHeight: 1.6,
    margin: '0 0 32px',
  },
  ctaBtn: {
    padding: '14px 28px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
