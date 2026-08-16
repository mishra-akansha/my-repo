import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import { api, publicUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"
import localStyles from "./CompanyProfile.module.css"

export default function CompanyProfile() {
  const { user, hasPermission, refreshUser } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [branding, setBranding] = useState(null)
  const [logoInfo, setLogoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState("")

  function reload() {
    return api.get("/org-settings").then((settings) => {
      setBranding(settings.branding)
      setLogoInfo(settings.branding)
    })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function updateBranding(key, value) {
    if (!canManage) return
    setBranding({ ...branding, [key]: value })
  }

  async function saveBranding(e) {
    e.preventDefault()
    if (!canManage) return
    setSaving(true)
    setError("")
    try {
      const updated = await api.patch("/org-settings", { branding })
      setBranding(updated.branding)
      setLogoInfo(updated.branding)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadLogo(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !canManage) return
    setUploadingLogo(true)
    setLogoError("")
    try {
      const updated = await api.upload("/org-settings/logo", file)
      setBranding(updated.branding)
      setLogoInfo(updated.branding)
      await refreshUser()
    } catch (err) {
      setLogoError(err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  async function removeLogo() {
    if (!canManage) return
    if (!confirm("Remove the company logo?")) return
    setUploadingLogo(true)
    try {
      const updated = await api.delete("/org-settings/logo")
      setBranding(updated.branding)
      setLogoInfo(updated.branding)
      await refreshUser()
    } catch (err) {
      setLogoError(err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading || !branding) {
    return (
      <>
        <Topbar title="Company Profile" subtitle="Loading..." />
        <div className={styles.page} />
      </>
    )
  }

  return (
    <>
      <Topbar title="Company Profile" subtitle="Used across the whole platform - sidebar, invoices, deal documents, and outgoing emails" />
      <div className={styles.page}>
        <div className={styles.thresholdsPanel}>
          <div className={`${styles.thresholdsHint} ${localStyles.logoSection}`}>
            <strong>Company logo</strong>
            <p>Shown in the app sidebar, invoice preview/PDF, deal documents, and at the top of outgoing emails.</p>
            {logoInfo?.logoFileName ? (
              <div className={`${styles.moduleRow} ${localStyles.logoRow}`}>
                <span className={localStyles.logoInfo}>
                  <img
                    src={publicUrl(`/public/organizations/${user?.organization?.id || ""}/logo?t=${logoInfo.logoUploadedAt || ""}`)}
                    alt=""
                    className={localStyles.logoThumb}
                  />
                  <span>
                    <strong>{logoInfo.logoFileName}</strong>
                    <small className={localStyles.logoUploadedAt}>Uploaded {logoInfo.logoUploadedAt ? new Date(logoInfo.logoUploadedAt).toLocaleDateString("en-IN") : ""}</small>
                  </span>
                </span>
                {canManage && (
                  <button type="button" className={styles.primaryLink} onClick={removeLogo} disabled={uploadingLogo}>
                    Remove
                  </button>
                )}
              </div>
            ) : (
              canManage && (
                <label className={`${styles.primaryLink} ${localStyles.logoUploadLabel}`}>
                  {uploadingLogo ? "Uploading..." : "Upload logo (PNG, JPEG, or WEBP)"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploadingLogo} onChange={uploadLogo} />
                </label>
              )
            )}
            {logoError && <p className={styles.empty}>{logoError}</p>}
          </div>

          <form className={styles.thresholdsForm} onSubmit={saveBranding}>
            <div className={styles.thresholdField}>
              <label htmlFor="branding-name">Company name</label>
              <input id="branding-name" type="text" placeholder="e.g. myanatomy Learning Solutions" value={branding.companyName || ""} onChange={(e) => updateBranding("companyName", e.target.value)} disabled={!canManage} />
            </div>
            <div className={styles.thresholdField}>
              <label htmlFor="branding-tagline">Tagline</label>
              <input id="branding-tagline" type="text" placeholder="e.g. Medical education technology" value={branding.tagline || ""} onChange={(e) => updateBranding("tagline", e.target.value)} disabled={!canManage} />
            </div>
            <div className={styles.thresholdField}>
              <label htmlFor="branding-address">Address</label>
              <input id="branding-address" type="text" placeholder="e.g. Bangalore, Karnataka" value={branding.addressLine || ""} onChange={(e) => updateBranding("addressLine", e.target.value)} disabled={!canManage} />
            </div>
            {error && <p className={styles.empty}>{error}</p>}
            {canManage && (
              <motion.button type="submit" className={styles.primaryLink} whileTap={{ scale: 0.96 }} disabled={saving}>
                {saving ? "Saving..." : "Save company profile"}
              </motion.button>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
