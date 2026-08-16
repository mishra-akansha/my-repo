import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Switch from "../../components/UI/Switch.jsx"
import { api, publicUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"
import localStyles from "./OnboardingEmail.module.css"

// Client-side mirror of the backend's {{token}} substitution — purely for
// the live preview here, the actual send always re-renders server-side from
// whatever is saved (this never writes back to the server).
function renderPreview(template, data) {
  if (!template) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in data ? String(data[key]) : match))
}

// Mirrors lib/onboardingEmail.js's buildBrandMark() on the backend — shows
// the org's own uploaded logo if Company Profile has one, otherwise its name
// as a text mark. Never UniLead's own branding; this email is from the org.
function buildBrandMark(companyName, orgLogoUrl) {
  if (orgLogoUrl) {
    return `<img src="${orgLogoUrl}" alt="${companyName}" height="40" style="height:40px;max-width:220px;width:auto;object-fit:contain;margin-bottom:16px;" />`
  }
  return `<div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.4px;margin-bottom:6px;">${companyName}</div>`
}

export function OnboardingEmailPanel() {
  const { user, hasPermission } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [config, setConfig] = useState(null)
  const [branding, setBranding] = useState(null)
  const [placeholders, setPlaceholders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get("/org-settings"),
      api.get("/org-settings/onboarding-email/default"),
    ]).then(([settings, defaults]) => {
      setConfig(settings.onboardingEmail)
      setBranding(settings.branding)
      setPlaceholders(defaults.placeholders || [])
    }).finally(() => setLoading(false))
  }, [])

  function update(key, value) {
    if (!canManage) return
    setConfig({ ...config, [key]: value })
    setSaved(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!canManage) return
    setSaving(true)
    setError("")
    try {
      const updated = await api.patch("/org-settings", { onboardingEmail: config })
      setConfig(updated.onboardingEmail)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefault() {
    if (!canManage) return
    if (!confirm("Replace the current subject and HTML with the shipped default? This won't save until you click Save.")) return
    setResetting(true)
    try {
      const defaults = await api.get("/org-settings/onboarding-email/default")
      setConfig({ ...config, subject: defaults.subject, html: defaults.html })
      setSaved(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setResetting(false)
    }
  }

  if (loading || !config) {
    return <p className={styles.emptyState}>Loading onboarding email configuration…</p>
  }

  const companyName = branding?.companyName || user?.organization?.name || "Your Company"
  const orgLogoUrl = branding?.logoStorageKey
    ? publicUrl(`/public/organizations/${user?.organization?.id || ""}/logo?t=${branding.logoUploadedAt || ""}`)
    : ""
  const sampleData = {
    name: "Priya Sharma",
    email: "priya@yourcompany.com",
    password: "x7k2mQ9p",
    companyName,
    loginUrl: "https://app.unilead.in/login",
    roleName: "Sales Rep",
    orgLogoUrl,
    brandMark: buildBrandMark(companyName, orgLogoUrl),
  }

  return (
    <form className={localStyles.layout} onSubmit={save}>
      <div className={localStyles.editorColumn}>
        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleRow}>
            <div>
              <strong>Send onboarding email</strong>
              <p className={styles.thresholdsHint} style={{ marginBottom: 0 }}>
                When off, new teammates only see their temp password on-screen to the inviting admin (current behavior).
              </p>
            </div>
            <Switch
              id="onboardingEmailEnabled"
              checked={!!config.enabled}
              onChange={(val) => update("enabled", val)}
              disabled={!canManage}
              label={config.enabled ? "On" : "Off"}
            />
          </div>
        </div>

        <div className={styles.thresholdsPanel}>
          <div className={styles.thresholdsForm} style={{ maxWidth: "none" }}>
            <div className={styles.thresholdField}>
              <label htmlFor="fromName">From name</label>
              <input id="fromName" type="text" placeholder="Your Company" value={config.fromName || ""} onChange={(e) => update("fromName", e.target.value)} disabled={!canManage} />
            </div>
            <div className={styles.thresholdField}>
              <label htmlFor="fromEmail">From email</label>
              <input id="fromEmail" type="email" placeholder="no-reply@yourcompany.com" value={config.fromEmail || ""} onChange={(e) => update("fromEmail", e.target.value)} disabled={!canManage} />
              <small className={localStyles.fieldHint}>Leave blank to use the platform default sender. A custom address must be verified in SendGrid or sends will fail.</small>
            </div>
            <div className={styles.thresholdField}>
              <label htmlFor="subject">Subject</label>
              <input id="subject" type="text" value={config.subject || ""} onChange={(e) => update("subject", e.target.value)} disabled={!canManage} />
            </div>
          </div>
        </div>

        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Placeholders</p>
            <p className={styles.thresholdsHint} style={{ marginBottom: 0 }}>Use these anywhere in the subject or HTML — they're swapped for real values when the email sends.</p>
          </div>
          <div className={localStyles.placeholderGrid}>
            {placeholders.map((p) => (
              <div key={p.token} className={localStyles.placeholderChip}>
                <code>{p.token}</code>
                <span>{p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.thresholdsPanel}>
          <div className={styles.thresholdField}>
            <label htmlFor="html">HTML template</label>
            <textarea
              id="html"
              className={localStyles.htmlEditor}
              spellCheck={false}
              value={config.html || ""}
              onChange={(e) => update("html", e.target.value)}
              disabled={!canManage}
              rows={20}
            />
            <small className={localStyles.fieldHint}>
              This is sent exactly as written — nothing is wrapped or restyled. Paste your own complete HTML email if you have one.
            </small>
          </div>
        </div>

        {error && <p className={styles.empty}>{error}</p>}
        {canManage && (
          <div className={localStyles.actionsRow}>
            <button type="button" className={localStyles.secondaryBtn} onClick={resetToDefault} disabled={resetting || saving}>
              {resetting ? "Resetting..." : "Reset to default"}
            </button>
            <motion.button type="submit" className={styles.primaryLink} whileTap={{ scale: 0.96 }} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
            </motion.button>
          </div>
        )}
      </div>

      <div className={localStyles.previewColumn}>
        <div className={localStyles.previewHeader}>
          <p className={styles.eyebrow}>Live preview</p>
          <p className={styles.thresholdsHint} style={{ marginBottom: 0 }}>Rendered with sample data — not sent anywhere.</p>
        </div>
        <div className={localStyles.previewSubject}>
          <strong>Subject:</strong> {renderPreview(config.subject, sampleData)}
        </div>
        <iframe
          title="Onboarding email preview"
          className={localStyles.previewFrame}
          srcDoc={renderPreview(config.html, sampleData)}
          sandbox=""
        />
      </div>
    </form>
  )
}

export default function OnboardingEmail() {
  return (
    <>
      <Topbar title="Onboarding Email" subtitle="Sent to new teammates with their login details when an Org Admin invites them" />
      <div className={styles.page}>
        <OnboardingEmailPanel />
      </div>
    </>
  )
}
