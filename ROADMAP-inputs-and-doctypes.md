# Roadmap: file inputs + more document types (do in ONE sitting)

Scoping notes for the "expand what Verdict can read" project. All of this is
deferred — tackle it together since most pieces share infrastructure.

## How decode works today (the pipe everything feeds into)
- Frontend sends `{ docType: 'lease', text }` to `POST /api/decode` (server/index.js).
- Server looks up a prompt file in `promptFiles` (currently only `lease`), injects
  the text, calls Anthropic (claude-sonnet-4-6), returns markdown.
- A junk-classifier (`looksLikeDocType`) rejects non-lease / too-short input
  before counting a decode. MIN length + classifier both live in /api/decode.
- Caps: PLAN_LIMITS = { free: 3, pro: 15, business: 100 }. These assumed
  PASTED TEXT (cheap). PDFs/images are 10-50x the tokens — revisit caps/margins.

## The work, easiest -> hardest

### 1. More document types (job offers, vendor contracts, ToS) — EASIEST
- Write a new prompt file per type (mirror server/prompts/lease-decoder-v1.txt).
- Register each in `promptFiles`. Add a doc-type picker in the UI (DecodeWorkspace
  already hardcodes docType:'lease' in handleSubmit — make it selectable).
- Loosen `looksLikeDocType` to accept the chosen type.
- Landing page + samples already say job offers / vendor contracts "coming soon".
- BOTTLENECK: prompt-writing QUALITY, not code. The lease prompt is sharp; new
  ones must match it or they feel like a downgrade.

### 2. PDFs — MEDIUM
- Anthropic API accepts PDFs natively (base64) — no separate OCR lib needed for
  most. Claude reads them directly.
- Need: file-upload UI, size limits, base64 -> API. Scanned/image-only PDFs may
  degrade. COST: big token jump -> tie to per-tier page limits (landing already
  hints "up to 50 pages").

### 3. Images (photo of a contract) — MEDIUM, shares PDF infra
- Claude vision reads images (base64), same plumbing as PDF. Build upload once,
  get both. Gotcha: phone photos blurry/partial -> manage expectations.

### 4. Links (paste a URL to a ToS page) — MEDIUM, separate
- Server fetches URL, strips HTML to text, feeds in.
- GOTCHAS: JS-rendered pages return nothing on plain fetch; paywalls/bot-blocks;
  **SSRF security** — must block internal IPs, add size/timeout limits before
  letting users make the server fetch arbitrary URLs.

## Suggested sequence
Doc types (#1) first — cheapest, no new infra, unlocks the "Pro = all document
types" selling point already on pricing, validates demand. Then PDF+image+upload
as one project. Links last (security surface).

## Don't forget
- Token cost vs the 3/15/100 caps — heavy PDF users could blow Pro margin.
  Consider per-tier page limits.
- The `decodes` table stores result_text; large inputs are fine there, but
  consider whether to store the source file (probably not — privacy promise on
  landing says docs aren't kept).
