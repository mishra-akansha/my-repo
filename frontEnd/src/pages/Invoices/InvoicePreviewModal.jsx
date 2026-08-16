import React, { useState, useEffect } from "react"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import Badge from "../../components/UI/Badge.jsx"
import { api, fileUrl, publicUrl } from "../../api/client.js"
import { formatDate } from "../../lib/format.js"
import { fillTemplate, findMissingTags } from "../../lib/emailTemplate.js"
import TemplateMissingFields from "../../components/UI/TemplateMissingFields.jsx"
import { MdCheckCircle, MdOutlinePrint, MdOutlineMail, MdOutlineDescription } from "react-icons/md"
import styles from "./InvoicePreviewModal.module.css"

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "progress",
  PAID: "won",
  OVERDUE: "lost",
  VOID: "lost",
}

export default function InvoicePreviewModal({ open, onClose, invoice, onStatusUpdated }) {
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [invoiceTemplates, setInvoiceTemplates] = useState([])
  const [pendingMissingTags, setPendingMissingTags] = useState(null)
  const [manualValues, setManualValues] = useState({})
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [invoiceCustomFields, setInvoiceCustomFields] = useState({})

  useEffect(() => {
    if (!open) return
    api.get("/email-templates")
      .then((list) => setInvoiceTemplates(list.filter((t) => t.category === "invoice")))
      .catch(() => setInvoiceTemplates([]))
    api.get("/custom-fields")
      .then((list) => setCustomFieldDefs(list.filter((f) => f.entityType === "INVOICE")))
      .catch(() => setCustomFieldDefs([]))
  }, [open])

  useEffect(() => {
    if (!open || !invoice?.id) return
    api.get(`/invoices/${invoice.id}`)
      .then((full) => setInvoiceCustomFields(full.customFields || {}))
      .catch(() => setInvoiceCustomFields({}))
  }, [open, invoice?.id])

  if (!invoice) return null

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val)
  }

  // Tax is estimated from the total (no per-line tax rate stored on Invoice yet) — labeled as estimated below.
  const totalAmount = invoice.amount || 0
  const subtotal = totalAmount / 1.18
  const gst = totalAmount - subtotal

  function invoiceRecipientName() {
    return invoice.contact
      ? `${invoice.contact.firstName} ${invoice.contact.lastName}`
      : invoice.account?.name || "Client"
  }

  function invoiceTemplateData() {
    return {
      billed_to_name: invoiceRecipientName(),
      billed_to_contact: invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "",
      billed_to_email: invoice.contact?.email || "",
      invoice_number: invoice.invoiceNumber,
      amount: formatCurrency(totalAmount),
      due_date: formatDate(invoice.dueDate),
      issue_date: formatDate(invoice.issueDate || invoice.createdAt),
      status: invoice.status,
      notes: invoice.notes || "",
      company_name: invoice.branding?.companyName || "",
      owner_name: invoice.owner?.name || "",
      owner_email: invoice.owner?.email || "",
    }
  }

  async function handleSendToClient() {
    const recipientEmail = invoice.contact?.email || ""
    if (!recipientEmail) {
      alert("This invoice has no linked contact email — link a contact with an email address first.")
      return
    }

    // Prefer an org-configured "invoice" category template (Settings > Email Templates)
    // over the hardcoded fallback below, so orgs that set one up actually see it used —
    // same placeholder set the custom .docx invoice template merge uses.
    const invoiceTemplate = invoiceTemplates[0]
    if (invoiceTemplate) {
      const merged = { ...invoiceTemplateData(), ...manualValues }
      const missing = findMissingTags(invoiceTemplate, merged)
      if (missing.length > 0) {
        // First click on a template with gaps (e.g. no branding company name set yet)
        // shows the fields to fill instead of silently mailing "{{company_name}}".
        setPendingMissingTags(missing)
        return
      }
    }

    setSending(true)
    setSuccessMsg("")
    try {
      if (invoice.status === "DRAFT") {
        await api.patch(`/invoices/${invoice.id}`, { status: "SENT" })
        if (onStatusUpdated) onStatusUpdated()
      }

      const { subject, body } = invoiceTemplate
        ? fillTemplate(invoiceTemplate, { ...invoiceTemplateData(), ...manualValues })
        : {
            subject: `Invoice ${invoice.invoiceNumber} — ${formatCurrency(totalAmount)} due ${formatDate(invoice.dueDate)}`,
            body: `Hi ${invoiceRecipientName()},\n\nPlease find your invoice details below.\n\nInvoice #: ${invoice.invoiceNumber}\nAmount due: ${formatCurrency(totalAmount)}\nDue date: ${formatDate(invoice.dueDate)}\n\n${invoice.notes ? `Notes: ${invoice.notes}\n\n` : ""}Please cite the invoice number on your remittance.\n\nThanks,\n${invoice.owner?.name || invoice.branding?.companyName || "UniLead"}`,
          }

      await api.post("/activities/send-email", {
        toEmail: recipientEmail,
        subject,
        body,
        contactId: invoice.contactId || null,
      })

      setSuccessMsg(`Invoice emailed to ${recipientEmail}.`)
      setPendingMissingTags(null)
      setManualValues({})
      setTimeout(() => setSuccessMsg(""), 4000)
    } catch (err) {
      alert(err.message || "Failed to send invoice.")
    } finally {
      setSending(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const footer = (
    <div className="preview-actions">
      <div>
        {successMsg && (
          <span className="success-msg">
            <MdCheckCircle size={14} /> {successMsg}
          </span>
        )}
      </div>
      <div className="preview-actions-right">
        <button className="preview-btn btn-secondary" onClick={handlePrint}>
          <MdOutlinePrint size={15} /> Print / Download PDF
        </button>
        {invoice.hasCustomTemplate && (
          <a
            className="preview-btn btn-secondary"
            href={fileUrl(`/invoices/${invoice.id}/generate-docx`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MdOutlineDescription size={15} /> Download Word doc
          </a>
        )}
        <button
          className="preview-btn btn-primary"
          disabled={sending}
          onClick={handleSendToClient}
        >
          {sending ? "Sending..." : pendingMissingTags?.length > 0 ? <><MdOutlineMail size={15} /> Confirm &amp; Send</> : <><MdOutlineMail size={15} /> Share / Send to Client</>}
        </button>
      </div>
    </div>
  )

  return (
    <SliderDialog open={open} onClose={onClose} title={`Preview Invoice: ${invoice.invoiceNumber}`} width="min(48rem, 100vw)" footer={footer}>
      {/* Stylesheet injector to handle print overrides and premium design */}
      <style>{`
        .invoice-container {
          font-family: 'Inter', sans-serif;
          color: var(--text-primary);
          padding: 1.5rem;
          background: var(--bg-surface);
          border-radius: var(--radius-md);
        }

        .invoice-card {
          padding: 2.5rem;
          border: 1px solid var(--border-strong);
          background: #fff;
          color: #1e293b;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
        }

        .dark-mode-override {
          /* Force light background for printable invoice sheets */
          background: #ffffff !important;
          color: #0f172a !important;
        }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .invoice-logo {
          max-height: 2.5rem;
          max-width: 10rem;
          object-fit: contain;
          margin-bottom: 0.5rem;
          display: block;
        }

        .invoice-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
        }

        .invoice-meta {
          text-align: right;
          font-size: 0.8125rem;
          color: #475569;
        }

        .invoice-meta td {
          padding: 0.125rem 0.5rem;
        }

        .invoice-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
          font-size: 0.8125rem;
        }

        .details-block h4 {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .details-block p {
          line-height: 1.5;
          margin: 0;
          font-weight: 500;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2rem;
          font-size: 0.8125rem;
        }

        .invoice-table th {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          color: #475569;
          font-weight: 700;
          text-align: left;
          padding: 0.75rem 1rem;
        }

        .invoice-table td {
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .invoice-totals {
          margin-left: auto;
          width: 250px;
          font-size: 0.8125rem;
          border-top: 2px solid #e2e8f0;
          padding-top: 0.5rem;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 0.375rem 0;
          color: #475569;
        }

        .total-row.grand {
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
          border-top: 1px solid #e2e8f0;
          margin-top: 0.375rem;
          padding-top: 0.5rem;
        }

        .invoice-notes {
          margin-top: 2rem;
          border-top: 1px solid #e2e8f0;
          padding-top: 1rem;
          font-size: 0.75rem;
          color: #64748b;
          line-height: 1.5;
        }

        .preview-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1.5rem;
          padding: 1rem 0 0;
          border-top: 1px solid var(--border-subtle);
        }

        .preview-actions-right {
          display: flex;
          gap: 0.5rem;
        }

        .preview-btn {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
        }

        .btn-secondary {
          background: var(--bg-hover);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: var(--border-subtle);
        }

        .btn-primary {
          background: var(--primary);
          border: 1px solid var(--primary);
          color: #fff;
        }

        .btn-primary:hover {
          background: var(--primary-dark);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .invoice-subtitle {
          margin: 0.25rem 0 0;
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        .branding-hint {
          color: #6366f1;
          text-decoration: underline;
        }

        .meta-label {
          font-weight: 700;
        }

        .detail-name {
          font-weight: 700;
          font-size: 0.875rem;
        }

        .col-center {
          text-align: center;
        }

        .col-right {
          text-align: right;
        }

        .cell-desc {
          font-weight: 600;
        }

        .payment-totals-row {
          display: flex;
          justify-content: space-between;
        }

        .payment-details {
          max-width: 50%;
          font-size: 0.75rem;
          color: #64748b;
        }

        .block-heading {
          font-weight: 700;
          color: #475569;
          margin: 0 0 0.25rem;
        }

        .no-margin {
          margin: 0;
        }

        .notes-text {
          margin: 0;
          white-space: pre-line;
        }

        .success-msg {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        /* PRINT STYLE SHEETS (CRITICAL ENHANCEMENT) */
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      <div className="invoice-container">
        {/* Printable Area */}
        <div id="print-area" className="invoice-card dark-mode-override">
          <div className="invoice-header">
            <div>
              {invoice.branding?.logoStorageKey && (
                <img
                  src={publicUrl(`/public/organizations/${invoice.organizationId}/logo`)}
                  alt=""
                  className="invoice-logo"
                />
              )}
              <div className="invoice-title">{invoice.branding?.companyName || "Your Company"}</div>
              <p className="invoice-subtitle">
                {invoice.branding?.tagline || (
                  <a href="/settings/customization" className="branding-hint">Set your company name & tagline in Settings</a>
                )}
              </p>
              {invoice.branding?.addressLine && <p className="invoice-subtitle">{invoice.branding.addressLine}</p>}
            </div>
            <div>
              <table className="invoice-meta">
                <tbody>
                  <tr>
                    <td className="meta-label">Invoice #:</td>
                    <td>{invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Issued:</td>
                    <td>{formatDate(invoice.issueDate || invoice.createdAt)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Due Date:</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Status:</td>
                    <td>
                      <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-details-grid">
            <div className="details-block">
              <h4>Billed From</h4>
              <p className="detail-name">
                {invoice.branding?.companyName || "Your Company"}
              </p>
              <p>{invoice.owner?.name || "Account Representative"}</p>
              <p>{invoice.owner?.email || ""}</p>
            </div>

            <div className="details-block">
              <h4>Billed To</h4>
              {invoice.account ? (
                <>
                  <p className="detail-name">{invoice.account.name}</p>
                  {invoice.contact && (
                    <p>
                      Attn: {invoice.contact.firstName} {invoice.contact.lastName}
                    </p>
                  )}
                </>
              ) : invoice.contact ? (
                <p className="detail-name">
                  {invoice.contact.firstName} {invoice.contact.lastName}
                </p>
              ) : (
                <p>—</p>
              )}
              {invoice.contact?.email && <p>{invoice.contact.email}</p>}
              {invoice.contact?.phone && <p>{invoice.contact.phone}</p>}
            </div>
          </div>

          <table className="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="col-center">Qty</th>
                <th className="col-right">Unit Price</th>
                <th className="col-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cell-desc">
                  {invoice.deal
                    ? `CRM Sales Deal Closure: "${invoice.deal.name}"`
                    : "CRM Professional Service Engagement"}
                </td>
                <td className="col-center">1</td>
                <td className="col-right">{formatCurrency(subtotal)}</td>
                <td className="col-right">{formatCurrency(subtotal)}</td>
              </tr>
            </tbody>
          </table>

          <div className="payment-totals-row">
            <div className="payment-details">
              <p className="block-heading">Payment Details</p>
              <p className="no-margin">Please cite invoice number <strong>{invoice.invoiceNumber}</strong> on remittances.</p>
            </div>
            
            <div className="invoice-totals">
              <div className="total-row">
                <span>Subtotal (est., excl. tax)</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="total-row">
                <span>GST / VAT (18%, estimated)</span>
                <span>{formatCurrency(gst)}</span>
              </div>
              <div className="total-row grand">
                <span>Total Due</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="invoice-notes">
              <p className="block-heading">Billing Notes</p>
              <p className="notes-text">{invoice.notes}</p>
            </div>
          )}

          {invoice.branding?.footerNote && (
            <div className="invoice-notes">
              <p className="notes-text">{invoice.branding.footerNote}</p>
            </div>
          )}

          {customFieldDefs.length > 0 && (
            <div className="invoice-notes">
              <p className="block-heading">Custom Fields</p>
              {customFieldDefs.map((f) => (
                <p key={f.id} className="notes-text">{f.label}: {invoiceCustomFields[f.id] || "—"}</p>
              ))}
            </div>
          )}
        </div>

        {/* Action Panel */}
        {pendingMissingTags && pendingMissingTags.length > 0 && (
          <div className={styles.missingFieldsPanel}>
            <TemplateMissingFields
              tags={pendingMissingTags}
              values={manualValues}
              onChange={(tag, value) => setManualValues((v) => ({ ...v, [tag]: value }))}
            />
          </div>
        )}
      </div>
    </SliderDialog>
  )
}
