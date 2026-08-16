import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import CustomFieldsSection from "../../components/UI/CustomFieldsSection.jsx"
import { api } from "../../api/client.js"
import { formatDate, initialsOf } from "../../lib/format.js"
import { TasksSkeleton } from "../../components/UI/Skeleton.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import { MdOutlineDescription } from "react-icons/md"
import FilterDrawer, { FilterButton } from "../../components/UI/FilterDrawer.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import useDebounce from "../../hooks/useDebounce.js"
import styles from "./Invoices.module.css"
import InvoicePreviewModal from "./InvoicePreviewModal.jsx"

async function fetchAccountOptions(term) {
  const res = await api.get(`/accounts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((a) => ({ value: a.id, label: a.name }))
}

async function fetchContactOptions(term) {
  const res = await api.get(`/contacts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.account ? ` — ${c.account.name}` : ""}` }))
}

function formatCurrencyINR(val) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val)
}

async function fetchDealOptions(term) {
  const res = await api.get(`/deals?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((d) => ({ value: d.id, label: `${d.name} (${formatCurrencyINR(d.value)})` }))
}

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "progress",
  PAID: "won",
  OVERDUE: "lost",
  VOID: "lost",
}

const EMPTY_FORM = {
  invoiceNumber: "",
  amount: "",
  status: "DRAFT",
  dueDate: "",
  accountId: "",
  contactId: "",
  dealId: "",
  notes: "",
  ownerId: "",
  customFields: {},
}

export default function Invoices() {
  const { user, hasPermission } = useAuth()
  const [filter, setFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [previewInvoice, setPreviewInvoice] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Options list for dropdown inputs
  const [users, setUsers] = useState([])
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [accountLabel, setAccountLabel] = useState("")
  const [contactLabel, setContactLabel] = useState("")
  const [dealLabel, setDealLabel] = useState("")

  const debouncedSearch = useDebounce(searchQuery, 300)

  const extraParams = useMemo(() => {
    const params = {}
    if (filter !== "All") params.status = filter
    if (debouncedSearch) params.search = debouncedSearch
    return params
  }, [filter, debouncedSearch])

  const {
    data: invoices,
    loading,
    hasMore,
    reload,
    lastElementRef,
    setData: setInvoices,
  } = useInfiniteScroll("/invoices", 15, extraParams)

  useEffect(() => {
    // Load relations options for form dropdowns
    Promise.all([
      api.get("/users"),
      api.get("/custom-fields"),
    ]).then(([u, cf]) => {
      setUsers(u)
      setCustomFieldDefs(cf.filter((f) => f.entityType === "INVOICE"))
    }).catch(console.error)
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, ownerId: user.id })
    setAccountLabel("")
    setContactLabel("")
    setDealLabel("")
    setError("")
    setModalOpen(true)
  }

  function openEdit(invoice) {
    setEditingId(invoice.id)
    setForm({
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
      dueDate: invoice.dueDate.slice(0, 10),
      accountId: invoice.accountId || "",
      contactId: invoice.contactId || "",
      dealId: invoice.dealId || "",
      notes: invoice.notes || "",
      ownerId: invoice.ownerId || invoice.owner?.id || user.id,
      customFields: {},
    })
    setAccountLabel(invoice.account?.name || "")
    setContactLabel(invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "")
    setDealLabel(invoice.deal?.name || "")
    setError("")
    setModalOpen(true)
    api.get(`/invoices/${invoice.id}`).then((full) => {
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    }).catch((err) => console.error("Failed to load invoice custom fields", err))
  }

  async function handleDelete(invoice) {
    if (!confirm(`Delete invoice "${invoice.invoiceNumber}"? This action is permanent.`)) return
    try {
      await api.delete(`/invoices/${invoice.id}`)
      await reload()
    } catch (err) {
      alert(err.message || "Failed to delete invoice")
    }
  }

  async function handleMarkPaid(invoice) {
    try {
      await api.patch(`/invoices/${invoice.id}`, { status: "PAID" })
      await reload()
    } catch (err) {
      alert(err.message || "Failed to mark as paid")
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    const payload = {
      invoiceNumber: form.invoiceNumber,
      amount: parseFloat(form.amount),
      status: form.status,
      dueDate: form.dueDate,
      accountId: form.accountId || null,
      contactId: form.contactId || null,
      dealId: form.dealId || null,
      notes: form.notes || null,
      ownerId: form.ownerId || user.id,
      customFields: form.customFields || {},
    }

    try {
      if (editingId) {
        await api.patch(`/invoices/${editingId}`, payload)
      } else {
        await api.post("/invoices", payload)
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      setError(err.message || "Failed to save invoice")
    } finally {
      setSubmitting(false)
    }
  }

  // Header stats are org-wide (ownership-scoped), fetched independently of the table's
  // current filter/pagination — computing them from the filtered invoices array would
  // make them silently wrong whenever a status filter is active.
  const [stats, setStats] = useState({ paidTotal: 0, unpaidTotal: 0, draftTotal: 0 })
  useEffect(() => {
    api.get("/invoices/stats").then(setStats).catch(console.error)
  }, [invoices])

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val)
  }

  return (
    <>
      <Topbar
        title="Invoices & Billing"
        subtitle="Manage client invoicing, payments, and collections"
        action={
          hasPermission("invoices.create") ? (
            <motion.button
              className={styles.addBtn}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={openCreate}
            >
              + Create Invoice
            </motion.button>
          ) : null
        }
      />

      <div className={styles.page}>
        {/* Dashboard Grid */}
        <div className={styles.dashboardGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Paid Invoices</span>
            <span className={`${styles.statValue} ${styles.statValuePrimary}`}>
              {formatCurrency(stats.paidTotal)}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Outstanding (Sent/Overdue)</span>
            <span className={`${styles.statValue} ${styles.statValueWarning}`}>
              {formatCurrency(stats.unpaidTotal)}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Draft Value</span>
            <span className={`${styles.statValue} ${styles.statValueSecondary}`}>
              {formatCurrency(stats.draftTotal)}
            </span>
          </div>
        </div>

        <FilterButton open={showFilters} onClick={() => setShowFilters(true)} activeCount={filter !== "All" ? 1 : 0} />

        <div className={styles.bodyRow}>
          <div className={styles.leftColumn}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client / Account</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span
                      className={`${styles.invoiceNum} ${styles.invoiceNumPreview}`}
                      onClick={() => setPreviewInvoice(inv)}
                      title="Click to preview & print invoice"
                    >
                      <MdOutlineDescription size={14} /> {inv.invoiceNumber}
                    </span>
                  </td>
                  <td>
                    <div>
                      {inv.account?.name || (inv.contact ? `${inv.contact.firstName} ${inv.contact.lastName}` : "—")}
                    </div>
                  </td>
                  <td>
                    <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                  </td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td>
                    {inv.owner && (
                      <div className={styles.ownerCell}>
                        <Avatar name={inv.owner.name} initials={initialsOf(inv.owner.name)} color={inv.owner.color} size={24} />
                        <span>{inv.owner.name}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {inv.status !== "PAID" && inv.status !== "VOID" && hasPermission("invoices.edit") && (
                        <button className={styles.rowActionBtn} onClick={() => handleMarkPaid(inv)}>Mark Paid</button>
                      )}
                      {hasPermission("invoices.edit") && (
                        <button className={styles.rowActionBtn} onClick={() => openEdit(inv)}>Edit</button>
                      )}
                      {hasPermission("invoices.delete") && (
                        <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(inv)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    <EmptyState type="invoices" title="No invoices found" hint="Try widening your filters, or create a new invoice to get started." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && invoices.length > 0 && (
            <div ref={lastElementRef} className={styles.loadMoreRow}>
              {loading ? "Loading more invoices..." : "Scroll down to load more..."}
            </div>
          )}
        </div>
      </div>
        <FilterDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filter invoices"
          activeCount={filter !== "All" ? 1 : 0}
          onClear={() => setFilter("All")}
        >
          <div className={styles.drawerField}>
            <label>Search</label>
            <input
              type="text"
              className={styles.search}
              placeholder="Search by invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.drawerField}>
            <label>Status</label>
            <SearchableSelect
              options={[
                { id: "All", name: "All Invoices" },
                { id: "DRAFT", name: "Draft" },
                { id: "SENT", name: "Sent" },
                { id: "PAID", name: "Paid" },
                { id: "OVERDUE", name: "Overdue" },
                { id: "VOID", name: "Void" },
              ]}
              value={filter}
              onChange={(v) => setFilter(v)}
              labelKey="name"
              valueKey="id"
              placeholder="All Invoices"
            />
          </div>
        </FilterDrawer>
        </div>
      </div>

      {/* Invoice Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Invoice" : "Create Invoice"}>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.formBody}`}>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Invoice Number</label>
              <input required placeholder="INV-2026-001" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Amount (INR)</label>
              <input type="number" required placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>

          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Due Date</label>
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Status</label>
              <SearchableSelect
                options={[
                  { id: "DRAFT", name: "Draft" },
                  { id: "SENT", name: "Sent" },
                  { id: "PAID", name: "Paid" },
                  { id: "OVERDUE", name: "Overdue" },
                  { id: "VOID", name: "Void" },
                ]}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>

          <div className={modalStyles.field}>
            <label>Link to Account</label>
            <AsyncSelect
              fetchOptions={fetchAccountOptions}
              value={form.accountId}
              selectedLabel={accountLabel}
              onChange={(opt) => { setForm({ ...form, accountId: opt.value }); setAccountLabel(opt.label) }}
              placeholder="Select account..."
            />
          </div>

          <div className={modalStyles.field}>
            <label>Link to Contact</label>
            <AsyncSelect
              fetchOptions={fetchContactOptions}
              value={form.contactId}
              selectedLabel={contactLabel}
              onChange={(opt) => { setForm({ ...form, contactId: opt.value }); setContactLabel(opt.label) }}
              placeholder="Select contact..."
            />
          </div>

          <div className={modalStyles.field}>
            <label>Link to Deal</label>
            <AsyncSelect
              fetchOptions={fetchDealOptions}
              value={form.dealId}
              selectedLabel={dealLabel}
              onChange={(opt) => { setForm({ ...form, dealId: opt.value }); setDealLabel(opt.label) }}
              placeholder="Select deal..."
            />
          </div>

          {users.length > 1 && (user.roleName === "Org Admin" || user.roleName === "Manager" || user.subordinates?.length > 0) && (
            <div className={modalStyles.field}>
              <label>Owner / Manager Assignee</label>
              <SearchableSelect
                options={[
                  { label: `Me (${user.name})`, value: user.id },
                  ...users.filter(u => u.id !== user.id && u.active).map(u => ({
                    label: `${u.name} (${u.role.name})`,
                    value: u.id
                  }))
                ]}
                value={form.ownerId || user.id}
                onChange={(val) => setForm({ ...form, ownerId: val })}
                placeholder="Select Owner..."
              />
            </div>
          )}

          <div className={modalStyles.field}>
            <label>Billing Notes</label>
            <textarea
              placeholder="Payment terms, Bank account details..."
              className={styles.notesTextarea}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <CustomFieldsSection
            fields={customFieldDefs}
            values={form.customFields}
            onChange={(fieldId, value) => setForm({ ...form, customFields: { ...form.customFields, [fieldId]: value } })}
          />

          {error && <p className={modalStyles.error}>{error}</p>}

          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      <InvoicePreviewModal
        open={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        invoice={previewInvoice}
        onStatusUpdated={reload}
      />
    </>
  )
}
