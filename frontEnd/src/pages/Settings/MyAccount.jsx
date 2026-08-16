import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { MdCheckCircle, MdOutlineMail } from "react-icons/md"
import Topbar from "../../components/Layout/Topbar.jsx"
import { api, fileUrl } from "../../api/client.js"
import styles from "./Settings.module.css"
import accountStyles from "./MyAccount.module.css"

export default function MyAccount() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [banner, setBanner] = useState(null)

  function reload() {
    return api.get("/auth/google/status").then(setStatus).catch(() => setStatus(null))
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const g = searchParams.get("google")
    if (g === "connected") setBanner({ type: "ok", text: "Google account connected — outgoing email now sends from your real inbox." })
    else if (g === "denied") setBanner({ type: "warn", text: "Google connection cancelled — nothing changed." })
    else if (g === "error") setBanner({ type: "error", text: "Couldn't connect Google — please try again." })
    if (g) {
      searchParams.delete("google")
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function disconnect() {
    if (!confirm("Disconnect your Google account? Outgoing email will go back to the shared sender.")) return
    setDisconnecting(true)
    try {
      await api.delete("/auth/google/disconnect")
      await reload()
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar title="My Account" subtitle="Loading..." />
        <div className={styles.page} />
      </>
    )
  }

  return (
    <>
      <Topbar title="My Account" subtitle="Your personal connections — separate from organization-wide settings" />
      <div className={styles.page}>
        {banner && (
          <div className={styles.thresholdsPanel} style={{ borderColor: banner.type === "ok" ? "var(--teal, var(--primary))" : undefined }}>
            <p className={accountStyles.bannerText}>{banner.text}</p>
          </div>
        )}

        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Email</p>
            <h3>Send email as yourself</h3>
          </div>
          <p className={styles.thresholdsHint}>
            Connect your Google account so emails you send from this CRM (Inbox, invoice reminders, follow-ups) come from your
            real Gmail/Workspace inbox — recipients see your actual address, and sent mail shows up in your own Sent folder.
            Without this, mail goes through the organization's shared sender instead.
          </p>

          {status?.connected ? (
            <div className={styles.moduleRow}>
              <span className={accountStyles.connectedStatus}>
                <MdCheckCircle size={20} color="var(--success, #16a34a)" />
                <span>
                  <strong>Connected</strong>
                  <small className={accountStyles.connectedEmail}>{status.email}</small>
                </span>
              </span>
              <button type="button" className={styles.primaryLink} onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : status?.configured ? (
            <a className={`${styles.primaryLink} ${accountStyles.connectLink}`} href={fileUrl("/auth/google/connect")}>
              <MdOutlineMail size={16} /> Connect Google account
            </a>
          ) : (
            <p className={styles.empty}>Google OAuth isn't configured on this server yet — ask an admin to add GOOGLE_OAUTH_CLIENT_ID / SECRET to the backend.</p>
          )}
        </div>
      </div>
    </>
  )
}
