import { useState, useRef, useEffect } from "react"
import styles from "./EmailBody.module.css"

// Plain-text quote markers left behind by most mail clients when replying
// ("> quoted line", "On Tue, Aug 5 ... wrote:") — collapsed by default like
// Gmail/Apple Mail do, since the full history is already the earlier bubble.
function splitQuotedText(text) {
  const lines = text.split("\n")
  const quoteLineStart = lines.findIndex((l) => /^>/.test(l.trim()))
  if (quoteLineStart > 0) {
    return { main: lines.slice(0, quoteLineStart).join("\n").trimEnd(), quoted: lines.slice(quoteLineStart).join("\n") }
  }
  // Gmail's plain-text export hard-wraps around ~78 chars, so "On <date>
  // <name> <email> wrote:" often splits across two or three lines - a
  // per-line regex misses it. Search the whole text instead, letting "."
  // span newlines, so the wrapped header is still found as one phrase.
  const match = text.match(/\n\s*(On .{0,200}?wrote:)\s*\n/s)
  if (!match || match.index <= 0) return { main: text, quoted: null }
  return { main: text.slice(0, match.index).trimEnd(), quoted: text.slice(match.index).trimStart() }
}

// Real HTML emails are rendered in a sandboxed, scriptless iframe (srcdoc) so
// a sender's inline styles/markup can never touch the app's own DOM/CSS or
// run script — the only safe way to show arbitrary third-party HTML.
function HtmlBody({ html }) {
  const iframeRef = useRef(null)
  const [height, setHeight] = useState(80)
  const [hasQuote, setHasQuote] = useState(false)
  const [showQuoted, setShowQuoted] = useState(false)

  // Gmail wraps older quoted history in a .gmail_quote div (or a plain
  // blockquote for other clients) - collapse it by default, same as a real
  // mail client does, instead of dumping the whole nested thread at once.
  function findQuoteEl(doc) {
    return doc.querySelector(".gmail_quote, blockquote")
  }

  function resize() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 80
    setHeight(Math.min(Math.max(h + 8, 60), 900))
  }

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument
    const quoteEl = doc && findQuoteEl(doc)
    if (quoteEl) {
      quoteEl.style.display = "none"
      setHasQuote(true)
    }
    resize()
    setTimeout(resize, 350) // re-measure once images finish loading
  }

  function toggleQuoted() {
    const doc = iframeRef.current?.contentDocument
    const quoteEl = doc && findQuoteEl(doc)
    if (quoteEl) quoteEl.style.display = showQuoted ? "none" : ""
    setShowQuoted((v) => !v)
    setTimeout(resize, 50)
  }

  return (
    <div className={styles.htmlWrap}>
      <iframe
        ref={iframeRef}
        title="Email content"
        className={styles.htmlFrame}
        style={{ height }}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={`<base target="_blank"><style>body{margin:0;padding:10px 12px;background:#fdfbf6;font-family:system-ui,sans-serif;font-size:13px;color:#2b2f36;word-wrap:break-word;overflow-wrap:break-word;} img{max-width:100%;height:auto;} a{color:#6366f1;}</style>${html}`}
        onLoad={handleLoad}
      />
      {hasQuote && (
        <button type="button" className={styles.htmlQuoteToggle} onClick={toggleQuoted}>
          {showQuoted ? "Hide quoted text" : "⋯ Show quoted text"}
        </button>
      )}
    </div>
  )
}

export default function EmailBody({ bodyHtml, bodyText }) {
  const [showQuoted, setShowQuoted] = useState(false)

  if (bodyHtml) {
    return <HtmlBody html={bodyHtml} />
  }

  const { main, quoted } = splitQuotedText(bodyText || "")

  return (
    <div className={styles.textBody}>
      <div className={styles.textMain}>{main}</div>
      {quoted && (
        <div className={styles.quotedWrap}>
          <button type="button" className={styles.quotedToggle} onClick={() => setShowQuoted((v) => !v)}>
            {showQuoted ? "Hide quoted text" : "⋯ Show quoted text"}
          </button>
          {showQuoted && <div className={styles.quotedText}>{quoted}</div>}
        </div>
      )}
    </div>
  )
}
