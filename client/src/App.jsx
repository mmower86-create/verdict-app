import { useEffect, useState } from 'react'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react'

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
    <span style={{ color, fontSize: '0.875rem' }}>
      {label}
    </span>
  )
}

export default function App() {
  const { user } = useUser()

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Verdict</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Read your lease. Know where you stand.
      </p>

      <div style={{ marginBottom: 24 }}>
        <HealthStatus />
      </div>

      <SignedOut>
        <p style={{ marginBottom: 16 }}>Sign in to get started.</p>
        <SignInButton mode="modal">
          <button style={btnStyle}>Sign in</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserButton />
          <span style={{ color: '#333' }}>
            Logged in as {user?.primaryEmailAddress?.emailAddress}
          </span>
        </div>
        <p style={{ marginTop: 24, color: '#555' }}>
          Analysis coming in Phase B.
        </p>
      </SignedIn>
    </div>
  )
}

const btnStyle = {
  padding: '10px 20px',
  background: '#1a1a1a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '1rem',
}
