import { useState, useEffect } from "react"
import { api } from "../../api/client.js"
import { formatDate } from "../../lib/format.js"
import EmptyState from "./EmptyState.jsx"
import styles from "./EmailThread.module.css"

// Real Gmail conversation history for one lead/contact — pulled from the
// synced EmailMessage table (see backend/src/lib/emailSync.js). Shows every
// message, oldest first, both sent-through-CRM and anything the connected
// user's Gmail actually received. No collapsing: this is already the
// full-detail surface, same rule as the rest of this dialog.
export default function EmailThread({ leadId, contactId }) {
  const [messages, setMessages] = useState(null)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    const params = leadId ? `leadId=${leadId}` : `contactId=${contactId}`
    const res = await api.get(`/email-messages?${params}`).catch(() => [])
    setMessages(Array.isArray(res) ? res : [])
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setSyncing(true)
      await api.post("/email-messages/sync", {}).catch(() => {})
      if (cancelled) return
      await load()
      setSyncing(false)
    }
    run()
    return () => { cancelled = true }
  }, [leadId, contactId])

  if (messages === null) {
    return <div className={styles.loading}>Loading conversation…</div>
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        type="mail"
        title="No emails yet"
        hint={syncing ? "Checking connected Gmail account for messages…" : "Connect your Google account in Settings > My Account, then send or receive an email with this address."}
      />
    )
  }

  return (
    <div className={styles.thread}>
      {messages.map((m) => (
        <div key={m.id} className={`${styles.bubble} ${m.direction === "outbound" ? styles.outbound : styles.inbound}`}>
          <div className={styles.bubbleHead}>
            <span className={styles.bubbleFrom}>{m.direction === "outbound" ? `${m.user?.name || "You"}` : (m.fromName || m.fromEmail)}</span>
            <span className={styles.bubbleDate}>{formatDate(m.sentAt)}</span>
          </div>
          {m.subject && <div className={styles.bubbleSubject}>{m.subject}</div>}
          <div className={styles.bubbleBody}>{m.bodyText || m.snippet || "(no preview available)"}</div>
        </div>
      ))}
    </div>
  )
}
