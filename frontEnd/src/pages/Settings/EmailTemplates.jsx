import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { fillTemplatePlaceholders } from "../../lib/emailTemplate.js"
import styles from "./Settings.module.css"
import localStyles from "./OnboardingEmail.module.css"

const EMPTY_FORM = { name: "", subject: "", body: "", category: "", fromEmail: "", fromName: "" }

const PRESET_CATEGORIES = [
  { value: "", label: "General / Default", hint: "Reusable across Inbox, Deals, and CRM contacts" },
  { value: "onboarding", label: "Team Onboarding & Welcome", hint: "Sent to newly invited teammates with temporary login credentials" },
  { value: "invoice", label: "Invoice Reminder", hint: "Used for automated invoice notifications & payment reminders" },
  { value: "event", label: "Event & Attendee Follow-up", hint: "Used in Event Workspaces to follow up with expo & trade show attendees" },
  { value: "follow-up", label: "Lead & Deal Follow-up", hint: "Follow-up templates for active sales pipeline" },
  { value: "intro", label: "Cold Outreach / Introduction", hint: "Introduction templates for newly captured prospects" },
]

const CATEGORY_PLACEHOLDERS = {
  onboarding: [
    { token: "{{name}}", desc: "New teammate's full name" },
    { token: "{{email}}", desc: "Their login email" },
    { token: "{{password}}", desc: "Their one-time temporary password" },
    { token: "{{companyName}}", desc: "Your organization name" },
    { token: "{{loginUrl}}", desc: "Link to the CRM login page" },
    { token: "{{roleName}}", desc: "The role they were invited as" },
    { token: "{{orgLogoUrl}}", desc: "Your company's uploaded logo, if set" },
    { token: "{{brandMark}}", desc: "Company logo or header text mark" },
  ],
  invoice: [
    { token: "{{company_name}}", desc: "Your company name" },
    { token: "{{company_tagline}}", desc: "Your company tagline" },
    { token: "{{company_address}}", desc: "Your company address" },
    { token: "{{invoice_number}}", desc: "Invoice number" },
    { token: "{{issue_date}}", desc: "Invoice issue date" },
    { token: "{{due_date}}", desc: "Invoice due date" },
    { token: "{{status}}", desc: "Invoice status" },
    { token: "{{billed_to_name}}", desc: "Account/contact being billed" },
    { token: "{{billed_to_contact}}", desc: "Billed-to contact name" },
    { token: "{{billed_to_email}}", desc: "Billed-to contact email" },
    { token: "{{amount}}", desc: "Invoice amount (formatted)" },
    { token: "{{notes}}", desc: "Invoice notes" },
    { token: "{{owner_name}}", desc: "Deal/invoice owner's name" },
    { token: "{{owner_email}}", desc: "Deal/invoice owner's email" },
  ],
  event: [
    { token: "{{first_name}}", desc: "Attendee's first name" },
    { token: "{{last_name}}", desc: "Attendee's last name" },
    { token: "{{company_name}}", desc: "Attendee's company" },
    { token: "{{event_name}}", desc: "Event/expo name" },
    { token: "{{event_date}}", desc: "Event date" },
    { token: "{{event_location}}", desc: "Event venue/location" },
    { token: "{{owner_name}}", desc: "Your name (the sender)" },
    { token: "{{owner_email}}", desc: "Your email (the sender)" },
  ],
  "follow-up": [
    { token: "{{first_name}}", desc: "Recipient's first name" },
    { token: "{{company_name}}", desc: "Your company name" },
    { token: "{{owner_name}}", desc: "Your name (the sender)" },
    { token: "{{owner_email}}", desc: "Your email (the sender)" },
  ],
  intro: [
    { token: "{{first_name}}", desc: "Recipient's first name" },
    { token: "{{company_name}}", desc: "Your company name" },
    { token: "{{owner_name}}", desc: "Your name (the sender)" },
    { token: "{{owner_email}}", desc: "Your email (the sender)" },
  ],
  default: [
    { token: "{{first_name}}", desc: "Recipient's first name" },
    { token: "{{company_name}}", desc: "Your company name" },
    { token: "{{owner_name}}", desc: "Your name (the sender)" },
    { token: "{{owner_email}}", desc: "Your email (the sender)" },
  ],
}

// Category-specific example starter templates
const EXAMPLE_TEMPLATES = {
  onboarding: {
    subject: "Welcome to {{companyName}} — your account is ready",
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 20px 40px -12px rgba(17,24,39,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:44px 32px 38px;text-align:center;">
                {{brandMark}}
                <h1 style="color:#ffffff;margin:6px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.3px;">Welcome aboard, {{name}}!</h1>
                <p style="color:rgba(255,255,255,0.82);margin:8px 0 0;font-size:14px;">You've been added as {{roleName}} at {{companyName}}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;color:#374151;font-size:15px;line-height:1.65;">
                <p style="margin:0 0 20px;">Your CRM account is ready. Here's what you need to sign in:</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin:0 0 20px;">
                  <tr>
                    <td style="padding:18px 22px;font-size:13px;color:#6b7280;width:38%;border-bottom:1px solid #eef2f7;">Email</td>
                    <td style="padding:18px 22px;font-size:14px;font-weight:700;color:#111827;border-bottom:1px solid #eef2f7;">{{email}}</td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px;font-size:13px;color:#6b7280;">Temporary password</td>
                    <td style="padding:18px 22px;font-size:14px;font-weight:700;color:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;">{{password}}</td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 28px;">
                  <tr>
                    <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:13px 16px;font-size:13px;color:#92400e;">
                      🔒 For your security, please change this password right after you sign in.
                    </td>
                  </tr>
                </table>

                <div style="text-align:center;">
                  <a href="{{loginUrl}}" style="display:inline-block;padding:15px 36px;background:#4f46e5;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 8px 16px -4px rgba(79,70,229,0.4);">Sign in to your account →</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;border-top:1px solid #f3f4f6;background:#fafafa;text-align:center;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because {{companyName}} added you as a teammate.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  },
  invoice: {
    subject: "Invoice {{invoice_number}} from {{company_name}} — {{amount}}",
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 20px 40px -12px rgba(17,24,39,0.12);">
            <tr>
              <td style="padding:36px 32px 28px;border-bottom:1px solid #f3f4f6;">
                <div style="color:#2563eb;font-size:20px;font-weight:800;">{{company_name}}</div>
                <div style="color:#6b7280;font-size:13px;margin-top:4px;">Invoice {{invoice_number}}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;font-size:15px;line-height:1.65;">
                <p style="margin:0 0 16px;">Dear {{billed_to_name}},</p>
                <p style="margin:0 0 20px;">Please find attached invoice <strong>{{invoice_number}}</strong> for the amount of <strong>{{amount}}</strong>, due on <strong>{{due_date}}</strong>.</p>
                <div style="background:#f8fafc;padding:16px 20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
                  <p style="margin:0;font-size:14px;color:#4b5563;">Status: <strong style="color:#059669;">{{status}}</strong></p>
                  <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Notes: {{notes}}</p>
                </div>
                <p style="margin:0 0 24px;">If you have any questions, feel free to reply directly to this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;border-top:1px solid #f3f4f6;background:#fafafa;">
                <p style="color:#374151;font-size:13px;margin:0 0 2px;font-weight:700;">{{owner_name}}</p>
                <p style="color:#9ca3af;font-size:12px;margin:0;">{{owner_email}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  },
  event: {
    subject: "Great connecting at {{event_name}} — {{company_name}}",
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Event Follow-up</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 20px 40px -12px rgba(17,24,39,0.12);">
            <tr>
              <td style="padding:36px 32px 28px;border-bottom:1px solid #f3f4f6;">
                <div style="color:#059669;font-size:20px;font-weight:800;">{{company_name}}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;font-size:15px;line-height:1.65;">
                <p style="margin:0 0 16px;">Hi {{first_name}},</p>
                <p style="margin:0 0 16px;">It was great meeting you at <strong>{{event_name}}</strong>!</p>
                <p style="margin:0 0 24px;">I'd love to continue our discussion regarding how we can help {{company_name}}. Are you available for a quick 10-minute call later this week?</p>
                <div>
                  <a href="#" style="display:inline-block;padding:13px 28px;background:#059669;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Schedule a Call →</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;border-top:1px solid #f3f4f6;background:#fafafa;">
                <p style="color:#374151;font-size:13px;margin:0 0 2px;font-weight:700;">{{owner_name}}</p>
                <p style="color:#9ca3af;font-size:12px;margin:0;">{{owner_email}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  },
  default: {
    subject: "Following up — {{company_name}}",
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Follow up</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 20px 40px -12px rgba(17,24,39,0.12);">
            <tr>
              <td style="padding:36px 32px 28px;border-bottom:1px solid #f3f4f6;">
                <div style="color:#4f46e5;font-size:20px;font-weight:800;letter-spacing:-0.3px;">{{company_name}}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;font-size:15px;line-height:1.65;">
                <p style="margin:0 0 16px;">Hi {{first_name}},</p>
                <p style="margin:0 0 16px;">Just checking in — wanted to see if you had any questions or if there's anything I can help with.</p>
                <p style="margin:0 0 28px;">Happy to jump on a quick call whenever works for you.</p>
                <div>
                  <a href="#" style="display:inline-block;padding:13px 28px;background:#4f46e5;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Reply to this email</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;border-top:1px solid #f3f4f6;background:#fafafa;">
                <p style="color:#374151;font-size:13px;margin:0 0 2px;font-weight:700;">{{owner_name}}</p>
                <p style="color:#9ca3af;font-size:12px;margin:0;">{{owner_email}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  },
}

function getSampleDataForCategory(category, user) {
  const companyName = user?.organization?.name || "Your Company"
  if (category === "onboarding") {
    return {
      name: "Priya Sharma",
      email: "priya@yourcompany.com",
      password: "x7k2mQ9p",
      companyName,
      company_name: companyName,
      loginUrl: "https://app.unilead.in/login",
      roleName: "Sales Rep",
      orgLogoUrl: "",
      brandMark: `<div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.4px;margin-bottom:6px;">${companyName}</div>`,
    }
  }
  if (category === "invoice") {
    return {
      company_name: companyName,
      company_tagline: "Modern sales, simplified",
      company_address: "123 Business Park, Bangalore",
      invoice_number: "INV-1042",
      issue_date: "1 Aug 2026",
      due_date: "15 Aug 2026",
      status: "Due Soon",
      billed_to_name: "Acme Industries",
      billed_to_contact: "Rahul Verma",
      billed_to_email: "rahul@acme.com",
      amount: "₹45,000",
      notes: "Net 15 payment terms",
      owner_name: user?.name || "Ananya Rao",
      owner_email: user?.email || "ananya@yourcompany.com",
    }
  }
  if (category === "event") {
    return {
      first_name: "Vikram",
      last_name: "Chopra",
      company_name: "HealthKart",
      event_name: "TechSparks Bengaluru 2026",
      event_date: "20 Sept 2026",
      event_location: "Taj Yashwantpur, Bangalore",
      owner_name: user?.name || "Sameer Ahmed",
      owner_email: user?.email || "sameer@myanatomy.in",
    }
  }
  return {
    first_name: "Priya",
    company_name: companyName,
    owner_name: user?.name || "Ananya Rao",
    owner_email: user?.email || "ananya@yourcompany.com",
  }
}

export default function EmailTemplates() {
  const { user, hasPermission } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [categoryMode, setCategoryMode] = useState("")
  const [customCatInput, setCustomCatInput] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("ALL")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function reload() {
    try {
      setTemplates(await api.get("/email-templates"))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing("new")
    setForm(EMPTY_FORM)
    setCategoryMode("")
    setCustomCatInput("")
    setError("")
  }

  function openEdit(t) {
    setEditing(t)
    const cat = t.category || ""
    const isPreset = PRESET_CATEGORIES.some((p) => p.value === cat)
    if (isPreset) {
      setCategoryMode(cat)
      setCustomCatInput("")
    } else {
      setCategoryMode("__other__")
      setCustomCatInput(cat)
    }
    setForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      category: cat,
      fromEmail: t.fromEmail || "",
      fromName: t.fromName || "",
    })
    setError("")
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleCategoryModeChange(mode) {
    setCategoryMode(mode)
    if (mode === "__other__") {
      update("category", customCatInput || "")
    } else {
      update("category", mode)
    }
  }

  function handleCustomCatChange(text) {
    setCustomCatInput(text)
    update("category", text.trim())
  }

  function useExampleTemplate() {
    const categoryKey = form.category || "default"
    const example = EXAMPLE_TEMPLATES[categoryKey] || EXAMPLE_TEMPLATES.default
    if (form.body && !confirm(`Replace the current subject and body with the example starter template for ${form.category || "General"}?`)) {
      return
    }
    setForm((f) => ({ ...f, subject: example.subject, body: example.html }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const finalCategory = (form.category || "").trim() || null
      const payload = { ...form, category: finalCategory }
      if (editing === "new") {
        await api.post("/email-templates", payload)
      } else {
        await api.patch(`/email-templates/${editing.id}`, payload)
      }

      // If saving an onboarding template, also keep org-settings synced
      if (finalCategory === "onboarding") {
        await api.patch("/org-settings", {
          onboardingEmail: {
            subject: form.subject,
            html: form.body,
            fromName: form.fromName || undefined,
            fromEmail: form.fromEmail || undefined,
          },
        }).catch(console.error)
      }

      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(t) {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try {
      await api.delete(`/email-templates/${t.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  const categoryPlaceholders = CATEGORY_PLACEHOLDERS[form.category] || CATEGORY_PLACEHOLDERS.default
  const sampleData = getSampleDataForCategory(form.category, user)

  // Filter templates by category
  const filteredTemplates = templates.filter((t) => {
    if (selectedFilter === "ALL") return true
    if (selectedFilter === "OTHER") {
      const isPreset = PRESET_CATEGORIES.some((p) => p.value === (t.category || ""))
      return !isPreset && Boolean(t.category)
    }
    return (t.category || "") === selectedFilter
  })

  // Category counts
  const categoryCounts = {
    ALL: templates.length,
    onboarding: templates.filter((t) => t.category === "onboarding").length,
    invoice: templates.filter((t) => t.category === "invoice").length,
    event: templates.filter((t) => t.category === "event").length,
    "follow-up": templates.filter((t) => t.category === "follow-up").length,
    intro: templates.filter((t) => t.category === "intro").length,
    OTHER: templates.filter((t) => {
      const isPreset = PRESET_CATEGORIES.some((p) => p.value === (t.category || ""))
      return !isPreset && Boolean(t.category)
    }).length,
  }

  return (
    <>
      <Topbar
        title="Email Templates"
        subtitle={loading ? "Loading…" : `${templates.length} template${templates.length !== 1 ? "s" : ""} across Onboarding, Invoices, Events & Sales follow-ups`}
        action={
          canManage && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + Add Template
            </motion.button>
          )
        }
      />
      <div className={styles.page}>
        
        {/* Category Filters */}
        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "ALL" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("ALL")}
          >
            All ({categoryCounts.ALL})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "onboarding" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("onboarding")}
          >
            👋 Onboarding ({categoryCounts.onboarding})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "invoice" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("invoice")}
          >
            📄 Invoices ({categoryCounts.invoice})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "event" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("event")}
          >
            🎪 Events ({categoryCounts.event})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "follow-up" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("follow-up")}
          >
            💬 Follow-ups ({categoryCounts["follow-up"]})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedFilter === "intro" ? styles.active : ""}`}
            onClick={() => setSelectedFilter("intro")}
          >
            ✨ Intro ({categoryCounts.intro})
          </button>
          {categoryCounts.OTHER > 0 && (
            <button
              type="button"
              className={`${styles.tabBtn} ${selectedFilter === "OTHER" ? styles.active : ""}`}
              onClick={() => setSelectedFilter("OTHER")}
            >
              🏷️ Custom ({categoryCounts.OTHER})
            </button>
          )}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Category</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className={styles.emptyState}>Loading templates…</td></tr>
              ) : filteredTemplates.length === 0 ? (
                <tr><td colSpan={4} className={styles.emptyState}><EmptyState type="mail" title="No templates found" hint="Add a new template to speed up your emails." compact /></td></tr>
              ) : (
                filteredTemplates.map((t) => {
                  const catKey = t.category ? t.category.replace("-", "_") : ""
                  return (
                    <tr key={t.id}>
                      <td className={styles.tdStrong}>{t.name}</td>
                      <td>{t.subject}</td>
                      <td>
                        {t.category ? (
                          <span className={`${styles.catBadge} ${styles[`cat_${catKey}`] || styles.cat_other}`}>
                            ● {t.category === "onboarding" ? "Team Onboarding" : t.category === "invoice" ? "Invoice" : t.category === "event" ? "Event" : t.category}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>General</span>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          <div className={styles.actionsRow}>
                            <button className={styles.rowActionBtn} onClick={() => openEdit(t)}>Edit</button>
                            <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(t)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW & EDIT TEMPLATE SLIDER DIALOG */}
      <SliderDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New Template" : "Edit Template"}
        subtitle="Sent exactly as written — no shared styling layered on top"
        width="min(72rem, 100vw)"
        footer={
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="email-template-form" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <form id="email-template-form" onSubmit={handleSave} className={localStyles.layout}>
          <div className={localStyles.editorColumn}>
            
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Template Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Welcome to the team, Invoice reminder"
                />
              </div>

              {/* SPECIFIC CATEGORY SELECTOR + OTHER CUSTOM INPUT */}
              <div className={modalStyles.field}>
                <label>Category (optional)</label>
                <select
                  className={styles.categorySelectBox}
                  value={categoryMode}
                  onChange={(e) => handleCategoryModeChange(e.target.value)}
                >
                  {PRESET_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                  <option value="__other__">✏️ Other (Custom Category)…</option>
                </select>

                {categoryMode === "__other__" && (
                  <input
                    style={{ marginTop: "0.45rem" }}
                    placeholder="Enter custom category name (e.g. renewal, quotation)…"
                    value={customCatInput}
                    onChange={(e) => handleCustomCatChange(e.target.value)}
                    required
                  />
                )}

                <small className={localStyles.fieldHint}>
                  {form.category === "onboarding"
                    ? "👋 Automatically used when inviting new teammates to deliver their temporary password & login link."
                    : form.category === "invoice"
                    ? "📄 Picked up automatically for automated invoice-reminder and payment notifications."
                    : form.category === "event"
                    ? "🎪 Used when following up with expo & trade show attendees."
                    : "Used for organizing and quick-selecting templates in Inbox and sales workflows."}
                </small>
              </div>
            </div>

            <div className={modalStyles.field}>
              <label>Subject Line *</label>
              <input
                required
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                placeholder="e.g. Welcome to {{companyName}} — your account is ready"
              />
            </div>

            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>From name (optional)</label>
                <input
                  value={form.fromName}
                  onChange={(e) => update("fromName", e.target.value)}
                  placeholder="e.g. Your Company Team"
                />
              </div>
              <div className={modalStyles.field}>
                <label>From email (optional)</label>
                <input
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => update("fromEmail", e.target.value)}
                  placeholder="e.g. no-reply@yourcompany.com"
                />
              </div>
            </div>
            <small className={localStyles.fieldHint}>
              Leave both blank to send as whoever/whatever is sending — the admin/sender's own address when inviting or composing.
            </small>

            {/* CATEGORY-AWARE PLACEHOLDERS GRID */}
            <div className={localStyles.placeholderGrid}>
              {categoryPlaceholders.map((p) => (
                <div key={p.token} className={localStyles.placeholderChip}>
                  <code>{p.token}</code>
                  <span>{p.desc}</span>
                </div>
              ))}
            </div>

            <div className={modalStyles.field}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                <label>Body (full HTML) *</label>
                <button type="button" className={styles.rowActionBtn} onClick={useExampleTemplate}>
                  Use {form.category ? form.category : "example"} starter template
                </button>
              </div>
              <textarea
                required
                className={localStyles.htmlEditor}
                spellCheck={false}
                rows={20}
                value={form.body}
                onChange={(e) => update("body", e.target.value)}
                placeholder="Paste your own complete HTML email, or click &quot;Use starter template&quot; above."
              />
              <small className={localStyles.fieldHint}>
                Sent exactly as written — nothing is wrapped or modified.
              </small>
            </div>
            {error && <p className={modalStyles.error}>{error}</p>}
          </div>

          {/* LIVE PREVIEW COLUMN */}
          <div className={localStyles.previewColumn}>
            <div className={localStyles.previewHeader}>
              <p className={styles.eyebrow}>Live preview</p>
              <p className={styles.thresholdsHint} style={{ marginBottom: 0 }}>Rendered with sample data — not sent anywhere.</p>
            </div>
            <div className={localStyles.previewSubject}>
              <strong>Subject:</strong> {fillTemplatePlaceholders(form.subject, sampleData)}
            </div>
            <iframe
              title="Email template preview"
              className={localStyles.previewFrame}
              srcDoc={fillTemplatePlaceholders(form.body, sampleData)}
              sandbox=""
            />
          </div>
        </form>
      </SliderDialog>
    </>
  )
}
