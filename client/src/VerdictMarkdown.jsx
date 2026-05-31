import ReactMarkdown from 'react-markdown'
import './verdict.css'

// The model emits the verdict as plain text with ALL-CAPS section labels
// (THE VERDICT, WHAT COULD COST YOU, ...) on their own lines, plus markdown
// for emphasis (**bold**), ordered/unordered lists, and --- dividers.
// We promote the known section labels to markdown headings so they render as
// styled editorial labels, then let react-markdown handle the rest.
const SECTION_LABELS = [
  'THE VERDICT',
  'WHAT COULD COST YOU',
  'WHAT TO DO BEFORE YOU SIGN',
  "WHAT'S ACTUALLY FINE",
  'ONE THING TO KNOW',
]

function prepareMarkdown(raw) {
  let md = raw || ''
  for (const label of SECTION_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match the label at the start of a line, with an optional trailing colon,
    // whether it stands alone or is followed inline by the section's text.
    const re = new RegExp(`(^|\\n)[ \\t]*${escaped}[ \\t]*:?[ \\t]*`, 'g')
    md = md.replace(re, `$1\n\n## ${label}\n\n`)
  }
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

const components = {
  h2: ({ children }) => {
    const text = (Array.isArray(children) ? children.join('') : String(children ?? '')).trim()
    const isPrimary = text.toUpperCase() === 'THE VERDICT'
    return <h2 className={isPrimary ? 'verdict-primary' : undefined}>{children}</h2>
  },
}

export default function VerdictMarkdown({ text, style }) {
  return (
    <div className="verdict-md" style={style}>
      <ReactMarkdown components={components}>{prepareMarkdown(text)}</ReactMarkdown>
    </div>
  )
}
