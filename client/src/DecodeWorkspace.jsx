import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'

const LOADER_STEPS = [
  'Reading the document...',
  'Scanning the clauses...',
  'Checking what could cost you...',
  'Formulating the verdict...',
]

const STEP_DELAYS_MS = [6000, 7000, 8000] // time between steps 0->1, 1->2, 2->3

function NarratedLoader() {
  const [stepIndex, setStepIndex] = useState(0)
  const timeoutsRef = useRef([])

  useEffect(() => {
    let current = 0
    STEP_DELAYS_MS.forEach((delay, i) => {
      const total = STEP_DELAYS_MS.slice(0, i + 1).reduce((a, b) => a + b, 0)
      const id = setTimeout(() => {
        current += 1
        setStepIndex(current)
      }, total)
      timeoutsRef.current.push(id)
    })
    return () => timeoutsRef.current.forEach(clearTimeout)
  }, [])

  return (
    <div style={styles.loader}>
      {LOADER_STEPS.map((step, i) => (
        <div
          key={step}
          style={{
            ...styles.loaderStep,
            opacity: i <= stepIndex ? 1 : 0.2,
            fontWeight: i === stepIndex ? 600 : 400,
          }}
        >
          {i < stepIndex ? '✓ ' : i === stepIndex ? '> ' : '  '}
          {step}
        </div>
      ))}
    </div>
  )
}

function VerdictDisplay({ text }) {
  // Split on section headers (all-caps lines) and render each cleanly
  const sections = text.split(/\n(?=[A-Z][A-Z ]+\n)/)

  return (
    <div style={styles.verdict}>
      {sections.map((section, i) => {
        const lines = section.trim().split('\n')
        const heading = lines[0]
        const body = lines.slice(1).join('\n').trim()

        return (
          <div key={i} style={styles.section}>
            <h2 style={styles.sectionHeading}>{heading}</h2>
            <p style={styles.sectionBody}>{body}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function DecodeWorkspace() {
  const { getToken } = useAuth()
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  async function handleSubmit() {
    if (!text.trim()) return
    setStatus('loading')
    setResult(null)
    setErrorMsg(null)

    try {
      const token = await getToken()
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ docType: 'lease', text }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }

      setResult(data.result)
      setStatus('done')
    } catch (err) {
      setErrorMsg('Could not reach the server. Is it running?')
      setStatus('error')
    }
  }

  function handleReset() {
    setText('')
    setResult(null)
    setErrorMsg(null)
    setStatus('idle')
  }

  if (status === 'loading') {
    return <NarratedLoader />
  }

  if (status === 'done' && result) {
    return (
      <div>
        <VerdictDisplay text={result} />
        <button onClick={handleReset} style={styles.resetBtn}>
          Analyze another document
        </button>
      </div>
    )
  }

  return (
    <div>
      {status === 'error' && (
        <p style={styles.error}>{errorMsg}</p>
      )}
      <label style={styles.label} htmlFor="lease-input">
        Paste your lease below
      </label>
      <textarea
        id="lease-input"
        style={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full text of your lease here..."
        rows={16}
      />
      <button
        style={{
          ...styles.submitBtn,
          opacity: text.trim() ? 1 : 0.5,
          cursor: text.trim() ? 'pointer' : 'not-allowed',
        }}
        onClick={handleSubmit}
        disabled={!text.trim()}
      >
        Get the verdict
      </button>
    </div>
  )
}

const styles = {
  label: {
    display: 'block',
    marginBottom: 8,
    fontSize: '0.9rem',
    color: '#555',
    fontWeight: 500,
  },
  textarea: {
    display: 'block',
    width: '100%',
    padding: '12px',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    border: '1px solid #ddd',
    borderRadius: 6,
    resize: 'vertical',
    fontFamily: 'inherit',
    marginBottom: 16,
    boxSizing: 'border-box',
  },
  submitBtn: {
    padding: '12px 28px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loader: {
    padding: '32px 0',
  },
  loaderStep: {
    fontSize: '1.05rem',
    padding: '8px 0',
    fontFamily: 'monospace',
    transition: 'opacity 0.4s ease, font-weight 0.2s ease',
    color: '#1a1a1a',
  },
  verdict: {
    borderTop: '2px solid #1a1a1a',
    paddingTop: 32,
    marginTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 10,
    marginTop: 0,
  },
  sectionBody: {
    fontSize: '1rem',
    lineHeight: 1.75,
    color: '#1a1a1a',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  error: {
    color: '#c00',
    marginBottom: 16,
    fontSize: '0.9rem',
  },
  resetBtn: {
    marginTop: 32,
    padding: '10px 20px',
    background: 'transparent',
    color: '#1a1a1a',
    border: '1px solid #1a1a1a',
    borderRadius: 6,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
}
