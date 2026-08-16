import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import { api, fileUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"
import dtStyles from "./DocumentTemplates.module.css"

const INVOICE_PLACEHOLDERS = ["company_name", "company_tagline", "company_address", "invoice_number", "issue_date", "due_date", "status", "billed_to_name", "billed_to_contact", "billed_to_email", "amount", "notes", "owner_name", "owner_email"]
const DEAL_PLACEHOLDERS = ["company_name", "company_tagline", "company_address", "deal_name", "deal_value", "stage", "client_name", "client_contact", "client_email", "product_name", "notes", "today", "owner_name", "owner_email"]

export default function DocumentTemplates() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [orgSettings, setOrgSettings] = useState(null)
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)

  const [savingFooter, setSavingFooter] = useState(false)
  const [footerError, setFooterError] = useState("")

  const [uploadingInvoiceTemplate, setUploadingInvoiceTemplate] = useState(false)
  const [invoiceTemplateError, setInvoiceTemplateError] = useState("")
  const [uploadingDealTemplate, setUploadingDealTemplate] = useState(false)
  const [dealTemplateError, setDealTemplateError] = useState("")

  function reload() {
    return api.get("/org-settings").then((settings) => {
      setOrgSettings(settings)
      setBranding(settings.branding)
    })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function saveFooter(e) {
    e.preventDefault()
    if (!canManage) return
    setSavingFooter(true)
    setFooterError("")
    try {
      const updated = await api.patch("/org-settings", { branding: { footerNote: branding.footerNote } })
      setOrgSettings(updated)
      setBranding(updated.branding)
    } catch (err) {
      setFooterError(err.message)
    } finally {
      setSavingFooter(false)
    }
  }

  async function uploadInvoiceTemplate(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !canManage) return
    setUploadingInvoiceTemplate(true)
    setInvoiceTemplateError("")
    try {
      setOrgSettings(await api.upload("/org-settings/invoice-template", file))
    } catch (err) {
      setInvoiceTemplateError(err.message)
    } finally {
      setUploadingInvoiceTemplate(false)
    }
  }

  async function removeInvoiceTemplate() {
    if (!canManage) return
    if (!confirm("Remove the custom invoice template? Invoices will fall back to the built-in layout.")) return
    setUploadingInvoiceTemplate(true)
    try {
      setOrgSettings(await api.delete("/org-settings/invoice-template"))
    } catch (err) {
      setInvoiceTemplateError(err.message)
    } finally {
      setUploadingInvoiceTemplate(false)
    }
  }

  async function uploadDealTemplate(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !canManage) return
    setUploadingDealTemplate(true)
    setDealTemplateError("")
    try {
      setOrgSettings(await api.upload("/org-settings/deal-template", file))
    } catch (err) {
      setDealTemplateError(err.message)
    } finally {
      setUploadingDealTemplate(false)
    }
  }

  async function removeDealTemplate() {
    if (!canManage) return
    if (!confirm("Remove the custom deal document template?")) return
    setUploadingDealTemplate(true)
    try {
      setOrgSettings(await api.delete("/org-settings/deal-template"))
    } catch (err) {
      setDealTemplateError(err.message)
    } finally {
      setUploadingDealTemplate(false)
    }
  }

  if (loading || !orgSettings) {
    return (
      <>
        <Topbar title="Document Templates" subtitle="Loading..." />
        <div className={styles.page} />
      </>
    )
  }

  return (
    <>
      <Topbar title="Document Templates" subtitle="Invoice footer note, and custom .docx mail-merge templates for invoices and deals" />
      <div className={styles.page}>
        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Invoices</p>
            <h3>Invoice footer note</h3>
          </div>
          <p className={styles.thresholdsHint}>Extra text shown only on invoices - company name, logo, tagline, and address come from Company Profile.</p>
          <form className={styles.thresholdsForm} onSubmit={saveFooter}>
            <div className={styles.thresholdField}>
              <label htmlFor="branding-footer">Footer note</label>
              <input id="branding-footer" type="text" placeholder="e.g. Thank you for your business" value={branding?.footerNote || ""} onChange={(e) => setBranding({ ...branding, footerNote: e.target.value })} disabled={!canManage} />
            </div>
            {footerError && <p className={styles.empty}>{footerError}</p>}
            {canManage && (
              <motion.button type="submit" className={styles.primaryLink} whileTap={{ scale: 0.96 }} disabled={savingFooter}>
                {savingFooter ? "Saving..." : "Save footer"}
              </motion.button>
            )}
          </form>
        </div>

        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Invoices</p>
            <h3>Custom invoice template (optional)</h3>
          </div>
          <div className={styles.thresholdsHint}>
            <p>
              Upload a .docx with your own layout. Use placeholders like <code>{"{{company_name}}"}</code>, <code>{"{{invoice_number}}"}</code>,{" "}
              <code>{"{{amount}}"}</code>, <code>{"{{billed_to_name}}"}</code> - full list below. Once uploaded, a "Download Word doc" button
              appears on every invoice preview, generating a .docx with your data merged in.
            </p>
            {canManage && (
              <a
                className={`${styles.primaryLink} ${dtStyles.starterLink}`}
                href={fileUrl("/org-settings/invoice-template/sample")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download starter template
              </a>
            )}
            <details>
              <summary>All supported placeholders</summary>
              <ul className={dtStyles.placeholderList}>
                {INVOICE_PLACEHOLDERS.map((tag) => (
                  <li key={tag}><code>{`{{${tag}}}`}</code></li>
                ))}
              </ul>
            </details>
          </div>

          {orgSettings.invoiceTemplate?.fileName ? (
            <div className={`${styles.moduleRow} ${dtStyles.moduleRowSpaced}`}>
              <span>
                <strong>{orgSettings.invoiceTemplate.fileName}</strong>
                <small>Uploaded {orgSettings.invoiceTemplate.uploadedAt ? new Date(orgSettings.invoiceTemplate.uploadedAt).toLocaleDateString("en-IN") : ""}</small>
              </span>
              {canManage && (
                <button type="button" className={styles.primaryLink} onClick={removeInvoiceTemplate} disabled={uploadingInvoiceTemplate}>
                  Remove
                </button>
              )}
            </div>
          ) : (
            canManage && (
              <label className={`${styles.primaryLink} ${dtStyles.uploadLabel}`}>
                {uploadingInvoiceTemplate ? "Uploading..." : "Upload .docx template"}
                <input type="file" accept=".docx" hidden disabled={uploadingInvoiceTemplate} onChange={uploadInvoiceTemplate} />
              </label>
            )
          )}
          {invoiceTemplateError && <p className={styles.empty}>{invoiceTemplateError}</p>}
        </div>

        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Deals</p>
            <h3>Custom deal document (optional)</h3>
          </div>
          <div className={styles.thresholdsHint}>
            <p>
              Upload a .docx with your own layout - name it whatever fits your process (Quotation, Proposal, Contract).
              Use placeholders like <code>{"{{deal_name}}"}</code>, <code>{"{{deal_value}}"}</code>,{" "}
              <code>{"{{client_name}}"}</code> - full list below. Once uploaded, a "Download document" link appears
              on every deal's detail panel.
            </p>
            {canManage && (
              <a
                className={`${styles.primaryLink} ${dtStyles.starterLink}`}
                href={fileUrl("/org-settings/deal-template/sample")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download starter template
              </a>
            )}
            <details>
              <summary>All supported placeholders</summary>
              <ul className={dtStyles.placeholderList}>
                {DEAL_PLACEHOLDERS.map((tag) => (
                  <li key={tag}><code>{`{{${tag}}}`}</code></li>
                ))}
              </ul>
            </details>
          </div>

          {orgSettings.dealTemplate?.fileName ? (
            <div className={`${styles.moduleRow} ${dtStyles.moduleRowSpaced}`}>
              <span>
                <strong>{orgSettings.dealTemplate.fileName}</strong>
                <small>Uploaded {orgSettings.dealTemplate.uploadedAt ? new Date(orgSettings.dealTemplate.uploadedAt).toLocaleDateString("en-IN") : ""}</small>
              </span>
              {canManage && (
                <button type="button" className={styles.primaryLink} onClick={removeDealTemplate} disabled={uploadingDealTemplate}>
                  Remove
                </button>
              )}
            </div>
          ) : (
            canManage && (
              <label className={`${styles.primaryLink} ${dtStyles.uploadLabel}`}>
                {uploadingDealTemplate ? "Uploading..." : "Upload .docx template"}
                <input type="file" accept=".docx" hidden disabled={uploadingDealTemplate} onChange={uploadDealTemplate} />
              </label>
            )
          )}
          {dealTemplateError && <p className={styles.empty}>{dealTemplateError}</p>}
        </div>
      </div>
    </>
  )
}
