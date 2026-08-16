import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdOutlineFileUpload } from "react-icons/md"
import PageShell from "../../components/Layout/PageShell.jsx"
import Badge from "../../components/UI/Badge.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import MultiSelect from "../../components/UI/MultiSelect.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate, initialsOf } from "../../lib/format.js"
import { LeadsSkeleton } from "../../components/UI/Skeleton.jsx"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import FilterDrawer, { FilterButton } from "../../components/UI/FilterDrawer.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import EmailThread from "../../components/UI/EmailThread.jsx"
import styles from "./Leads.module.css"
import ImportWizard from "./ImportWizard.jsx"

async function fetchContactOptions(term) {
  const res = await api.get(`/contacts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.email ? ` (${c.email})` : ""}` }))
}

async function fetchAccountOptions(term) {
  const res = await api.get(`/accounts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((a) => ({ value: a.id, label: a.name }))
}

const STATUS_TONE = { NEW: "new", CONTACTED: "progress", QUALIFYING: "progress", CONVERTED: "won", DISQUALIFIED: "lost" }
const FILTERS = ["All", "NEW", "CONTACTED", "QUALIFYING", "CONVERTED", "DISQUALIFIED"]
const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "progress", HIGH: "lost", URGENT: "lost" }
const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", company: "", source: "Web Form", status: "NEW", priority: "MEDIUM", clientTypeId: "", productId: "", productIds: [], eventId: "", customFields: {} }

export default function Leads() {
  const { hasPermission } = useAuth()
  const [filter, setFilter] = useState("All")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [leadFormTab, setLeadFormTab] = useState("details")
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  // Contacts staged on the create/edit form — { tempId, contactId?, name, email, phone, title, isNew }.
  // On create: flushed (linked/created) after the lead is saved. On edit: pre-filled from the
  // lead's real contactLinks, diffed against originalContactLinkIds on save so removals unlink.
  const [pendingContacts, setPendingContacts] = useState([])
  const [originalContactLinkIds, setOriginalContactLinkIds] = useState([])
  const [linkContactId, setLinkContactId] = useState("")
  const [linkContactLabel, setLinkContactLabel] = useState("")
  const [newContactForm, setNewContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", newAccountName: "" })
  const [newContactAccountLabel, setNewContactAccountLabel] = useState("")
  const [showNewContactForm, setShowNewContactForm] = useState(false)

  function addExistingContactToForm() {
    if (!linkContactId) return
    if (pendingContacts.some((p) => p.contactId === linkContactId)) return
    setPendingContacts((prev) => [...prev, { tempId: `existing-${linkContactId}`, contactId: linkContactId, name: linkContactLabel, email: "" }])
    setLinkContactId("")
    setLinkContactLabel("")
  }

  function addNewContactToForm(e) {
    e.preventDefault()
    if (!newContactForm.firstName.trim()) return
    setPendingContacts((prev) => [...prev, { tempId: `new-${Date.now()}`, isNew: true, ...newContactForm }])
    setNewContactForm({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", newAccountName: "" })
    setNewContactAccountLabel("")
    setShowNewContactForm(false)
  }

  function removePendingContact(tempId) {
    setPendingContacts((prev) => prev.filter((p) => p.tempId !== tempId))
  }

  // Creates any new contacts (POST /contacts) then links everything to the lead, and unlinks
  // any contact that was originally linked but got removed from the form.
  async function flushLeadContacts(leadId) {
    for (const p of pendingContacts) {
      let contactId = p.contactId
      if (p.isNew) {
        let accountId = p.accountId || null
        if (!accountId && p.newAccountName?.trim()) {
          const account = await api.post("/accounts", { name: p.newAccountName.trim() })
          accountId = account.id
        }
        const created = await api.post("/contacts", { firstName: p.firstName, lastName: p.lastName || "", email: p.email || null, phone: p.phone || null, title: p.title || null, accountId })
        contactId = created.id
      }
      if (contactId && !originalContactLinkIds.includes(contactId)) {
        await api.post(`/leads/${leadId}/link-contact`, { contactId }).catch(() => {})
      }
    }
    const keptIds = pendingContacts.map((p) => p.contactId).filter(Boolean)
    for (const oldId of originalContactLinkIds) {
      if (!keptIds.includes(oldId)) {
        await api.delete(`/leads/${leadId}/link-contact/${oldId}`).catch(() => {})
      }
    }
  }

  const [convertLead, setConvertLead] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [convertForm, setConvertForm] = useState({ dealName: "", dealValue: "", stageId: "" })

  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Details Modal
  const [detailLeadId, setDetailLeadId] = useState(null)

  const extraParams = useMemo(() => {
    const params = {}
    if (filter !== "All") params.status = filter
    if (query) params.search = query
    if (sort) params.sort = sort
    return params
  }, [filter, query, sort])

  const {
    data: leads,
    loading,
    hasMore,
    reload,
    lastElementRef,
    setData: setLeads,
    totalCount,
  } = useInfiniteScroll("/leads", 15, extraParams)

  const [clientTypes, setClientTypes] = useState([])
  const [products, setProducts] = useState([])
  const [events, setEvents] = useState([])
  const [customFields, setCustomFields] = useState([])

  useEffect(() => {
    Promise.all([
      api.get("/client-types").catch(() => []),
      api.get("/products").catch(() => []),
      api.get("/events").catch(() => []),
      api.get("/custom-fields").catch(() => []),
    ]).then(([ctList, pList, eList, cfList]) => {
      setClientTypes(ctList)
      setProducts(pList)
      setEvents(eList)
      setCustomFields(cfList.filter(f => f.entityType === "LEAD"))
    }).catch(err => console.error("Error loading dropdown details", err))
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, customFields: {} })
    setError("")
    setLeadFormTab("details")
    setPendingContacts([])
    setOriginalContactLinkIds([])
    setShowNewContactForm(false)
    setModalOpen(true)
  }

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openEdit(lead) {
    setEditingId(lead.id)
    setLeadFormTab("details")
    setForm({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      source: lead.source || "Web Form",
      status: lead.status,
      priority: lead.priority || "MEDIUM",
      clientTypeId: lead.clientTypeId || "",
      productId: lead.productId || "",
      productIds: (lead.products || []).map((lp) => lp.productId).length
        ? (lead.products || []).map((lp) => lp.productId)
        : (lead.productId ? [lead.productId] : []),
      eventId: lead.eventId || "",
      customFields: {},
    })
    setError("")
    setShowNewContactForm(false)
    const links = (lead.contactLinks || []).map((l) => ({ tempId: `existing-${l.contactId}`, contactId: l.contactId, name: `${l.contact.firstName} ${l.contact.lastName}`, email: l.contact.email }))
    setPendingContacts(links)
    setOriginalContactLinkIds(links.map((l) => l.contactId))
    setModalOpen(true)
    try {
      const full = await api.get(`/leads/${lead.id}`)
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    } catch (err) {
      console.error("Failed to load lead custom fields", err)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        clientTypeId: form.clientTypeId || null,
        productId: form.productId || null,
        productIds: form.productIds || [],
        eventId: form.eventId || null,
      }
      let leadId = editingId
      if (editingId) {
        await api.patch(`/leads/${editingId}`, payload)
      } else {
        const created = await api.post("/leads", payload)
        leadId = created.id
      }
      await flushLeadContacts(leadId)
      setModalOpen(false)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(lead) {
    if (!confirm(`Delete lead "${lead.firstName} ${lead.lastName}"? This can't be undone.`)) return
    await api.delete(`/leads/${lead.id}`)
    await reload()
  }

  async function openConvert(lead) {
    setConvertLead(lead)
    setError("")
    const pipelines = await api.get("/deals/pipelines")
    const p = pipelines[0]
    setPipeline(p)
    setConvertForm({ dealName: `${lead.company || `${lead.firstName} ${lead.lastName}`} — New Deal`, dealValue: "", stageId: p?.stages[0]?.id || "" })
  }

  async function handleConvert(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await api.post(`/leads/${convertLead.id}/convert`, {
        pipelineId: pipeline.id,
        stageId: convertForm.stageId,
        dealName: convertForm.dealName,
        dealValue: Number(convertForm.dealValue) || 0,
      })
      setConvertLead(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell
      title="Leads"
      subtitle={loading ? "Loading…" : `${totalCount} total · ${leads.filter((l) => l.status === "NEW").length} awaiting first contact`}
      action={
        <div className={styles.actionRow}>
          {hasPermission("leads.create") && (
            <>
              <motion.button
                className={styles.importBtn}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setImportOpen(true)}
              >
                <MdOutlineFileUpload size={15} /> Import CSV
              </motion.button>
              <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openCreate}>
                + New Lead
              </motion.button>
            </>
          )}
        </div>
      }
    >
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <input
            className={styles.quickSearch}
            placeholder="Filter by name or company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <FilterButton open={showFilters} onClick={() => setShowFilters(true)} activeCount={(filter !== "All" ? 1 : 0) + (sort ? 1 : 0)} />
        </div>

        <div className={styles.bodyRow}>
          <div className={styles.leftColumn}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Company</th>
                <th>Event</th>
                <th>Client Type</th>
                <th>Product</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Score</th>
                <th>Owner</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className={styles.loadingCell}>
                    <LeadsSkeleton />
                  </td>
                </tr>
              ) : (
                <>
                  <AnimatePresence>
                    {leads.map((lead) => (
                      <motion.tr
                        key={lead.id}
                        className={styles.row}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td>
                          <div className={styles.leadCell} onClick={() => setDetailLeadId(lead.id)}>
                            <span className={styles.leadName}>{lead.firstName} {lead.lastName}</span>
                            <span className={styles.leadEmail}>{lead.email}</span>
                          </div>
                        </td>
                        <td>{lead.company}</td>
                        <td>{lead.event ? <Badge tone="progress">{lead.event.name}</Badge> : <span className={styles.uMuted}>—</span>}</td>
                        <td>{lead.clientType ? <Badge tone="neutral">{lead.clientType.name}</Badge> : <span className={styles.uMuted}>—</span>}</td>
                        <td>{(lead.products || []).length > 0 ? <span className={styles.badgesWrap}>{lead.products.map((lp) => <Badge key={lp.id} tone="progress">{lp.product?.name}</Badge>)}</span> : lead.product ? <Badge tone="progress">{lead.product.name}</Badge> : <span className={styles.uMuted}>—</span>}</td>
                        <td>
                          <span className={styles.sourceTag}>{lead.source}</span>
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[lead.status] || "neutral"}>{lead.status}</Badge>
                        </td>
                        <td>
                          <Badge tone={PRIORITY_TONE[lead.priority] || "neutral"}>{lead.priority || "MEDIUM"}</Badge>
                        </td>
                        <td className={styles.uMuted}>{lead.score ?? 0}</td>
                        <td>
                          {lead.owner && (
                            <div className={styles.ownerCell}>
                              <Avatar name={lead.owner.name} initials={initialsOf(lead.owner.name)} color={lead.owner.color} size={24} />
                              <span>{lead.owner.name}</span>
                            </div>
                          )}
                        </td>
                        <td className={styles.dateCell}>{formatDate(lead.createdAt)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            {lead.status !== "CONVERTED" && hasPermission("leads.edit") && hasPermission("deals.create") && (
                              <button className={styles.rowActionBtn} onClick={() => openConvert(lead)}>Convert</button>
                            )}
                            {hasPermission("leads.edit") && (
                              <button className={styles.rowActionBtn} onClick={() => openEdit(lead)}>Edit</button>
                            )}
                            {hasPermission("leads.delete") && (
                              <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(lead)}>Delete</button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={11} className={styles.empty}>
                        <EmptyState type="leads" title="No leads match this filter" hint="Try widening your filters, or add a new lead to get started." />
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
          {hasMore && leads.length > 0 && (
            <div ref={lastElementRef} className={styles.loadMoreRow}>
              {loading ? "Loading more leads..." : "Scroll down to load more..."}
            </div>
          )}
        </div>
      </div>

        <FilterDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filter leads"
          activeCount={(filter !== "All" ? 1 : 0) + (sort ? 1 : 0)}
          onClear={() => { setFilter("All"); setSort("") }}
        >
          <div className={styles.drawerField}>
            <label>Status</label>
            <SearchableSelect
              options={[
                { id: "All", name: "All statuses" },
                { id: "NEW", name: "New" },
                { id: "CONTACTED", name: "Contacted" },
                { id: "QUALIFYING", name: "Qualifying" },
                { id: "CONVERTED", name: "Converted" },
                { id: "DISQUALIFIED", name: "Disqualified" },
              ]}
              value={filter}
              onChange={setFilter}
              labelKey="name"
              valueKey="id"
              placeholder="All statuses"
            />
          </div>
          <div className={styles.drawerField}>
            <label>Sort</label>
            <SearchableSelect
              options={[
                { id: "", name: "Newest first" },
                { id: "created_asc", name: "Oldest first" },
                { id: "score_desc", name: "Highest score" },
                { id: "score_asc", name: "Lowest score" },
                { id: "priority_desc", name: "Priority" },
              ]}
              value={sort}
              onChange={setSort}
              labelKey="name"
              valueKey="id"
              placeholder="Newest first"
            />
          </div>
        </FilterDrawer>
        </div>
      </div>

      <SliderDialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit lead" : "New lead"} width="min(32rem, 100vw)">
        <div className={styles.modalTabs}>
          <button type="button" className={`${styles.modalTabBtn} ${leadFormTab === "details" ? styles.modalTabActive : ""}`} onClick={() => setLeadFormTab("details")}>Details</button>
          <button type="button" className={`${styles.modalTabBtn} ${leadFormTab === "classify" ? styles.modalTabActive : ""}`} onClick={() => setLeadFormTab("classify")}>Classification{customFields.length > 0 ? ` & Fields` : ""}</button>
          <button type="button" className={`${styles.modalTabBtn} ${leadFormTab === "contacts" ? styles.modalTabActive : ""}`} onClick={() => setLeadFormTab("contacts")}>Contacts{pendingContacts.length > 0 ? ` (${pendingContacts.length})` : ""}</button>
        </div>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          {leadFormTab === "details" && (
            <>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>First name</label>
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Last name</label>
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Company</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Source</label>
                  <SearchableSelect
                    options={["Web Form", "Referral", "Cold Outreach", "Event"].map((s) => ({ id: s, name: s }))}
                    value={form.source}
                    onChange={(v) => setForm({ ...form, source: v })}
                    labelKey="name"
                    valueKey="id"
                  />
                </div>
              </div>
              <div className={modalStyles.row}>
                {editingId && (
                  <div className={modalStyles.field}>
                    <label>Status</label>
                    <SearchableSelect
                      options={[
                        { id: "NEW", name: "New" },
                        { id: "CONTACTED", name: "Contacted" },
                        { id: "QUALIFYING", name: "Qualifying" },
                        { id: "DISQUALIFIED", name: "Disqualified" },
                      ]}
                      value={form.status}
                      onChange={(v) => setForm({ ...form, status: v })}
                      labelKey="name"
                      valueKey="id"
                    />
                  </div>
                )}
                <div className={modalStyles.field}>
                  <label>Priority</label>
                  <SearchableSelect
                    options={[
                      { id: "LOW", name: "Low" },
                      { id: "MEDIUM", name: "Medium" },
                      { id: "HIGH", name: "High" },
                      { id: "URGENT", name: "Urgent" },
                    ]}
                    value={form.priority}
                    onChange={(v) => setForm({ ...form, priority: v })}
                    labelKey="name"
                    valueKey="id"
                  />
                </div>
              </div>
            </>
          )}

          {leadFormTab === "classify" && (
            <>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Client Type</label>
                  <SearchableSelect
                    options={clientTypes}
                    value={form.clientTypeId || ""}
                    onChange={(v) => setForm({ ...form, clientTypeId: v })}
                    labelKey="name"
                    valueKey="id"
                    placeholder="Select Client Type"
                  />
                </div>
                <div className={modalStyles.field}>
                  <label>Product Interest</label>
                  <MultiSelect
                    options={products.map((p) => ({ label: p.name, value: p.id }))}
                    values={form.productIds || []}
                    onChange={(vals) => setForm({ ...form, productIds: vals, productId: vals[0] || "" })}
                    placeholder="Select products…"
                  />
                </div>
              </div>
              <div className={modalStyles.field}>
                <label>Marketing Event</label>
                <SearchableSelect
                  options={events.map((ev) => ({ id: ev.id, name: `${ev.name} (${formatDate(ev.date)})` }))}
                  value={form.eventId || ""}
                  onChange={(v) => setForm({ ...form, eventId: v })}
                  labelKey="name"
                  valueKey="id"
                  placeholder="Select Event"
                />
              </div>

              {customFields.length > 0 && (
                <div className={styles.uColGap1}>
                  <h4 className={styles.uSectionTitleSm2}>Custom Attributes</h4>
                  {customFields.map((f) => {
                    let parsedOptions = []
                    try {
                      if (f.options) parsedOptions = JSON.parse(f.options)
                    } catch (e) {}

                    return (
                      <div key={f.id} className={modalStyles.field}>
                        <label>{f.label} {f.required && <span className={styles.uDanger}>*</span>}</label>
                        {f.type === "SELECT" ? (
                          <SearchableSelect
                            options={parsedOptions.map((opt) => ({ id: opt, name: opt }))}
                            value={form.customFields?.[f.id] || ""}
                            onChange={(v) => setForm({
                              ...form,
                              customFields: { ...form.customFields, [f.id]: v }
                            })}
                            labelKey="name"
                            valueKey="id"
                            placeholder="Select Option"
                          />
                        ) : (
                          <input
                            required={f.required}
                            type={f.type === "NUMBER" ? "number" : "text"}
                            value={form.customFields?.[f.id] || ""}
                            onChange={(e) => setForm({
                              ...form,
                              customFields: { ...form.customFields, [f.id]: e.target.value }
                            })}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {leadFormTab === "contacts" && (
            <div className={styles.uColGap1}>
              <div className={modalStyles.field}>
                <label>Link an existing contact</label>
                <div className={styles.linkRow}>
                  <div className={styles.flex1}>
                    <AsyncSelect
                      fetchOptions={fetchContactOptions}
                      value={linkContactId}
                      selectedLabel={linkContactLabel}
                      onChange={(opt) => { setLinkContactId(opt.value); setLinkContactLabel(opt.label) }}
                      placeholder="Search contacts…"
                    />
                  </div>
                  <button type="button" onClick={addExistingContactToForm} disabled={!linkContactId} className={styles.btnAccentSm}>
                    Add
                  </button>
                </div>
              </div>

              <div className={styles.rowBetweenBorderTop}>
                <h5 className={styles.headingSm}>Or create a new contact</h5>
                {!showNewContactForm && (
                  <button type="button" onClick={() => setShowNewContactForm(true)} className={styles.linkBtn}>+ New Contact</button>
                )}
              </div>

              {showNewContactForm && (
                <div className={styles.formPanel}>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input required placeholder="First name" value={newContactForm.firstName} onChange={(e) => setNewContactForm({ ...newContactForm, firstName: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input required placeholder="Last name" value={newContactForm.lastName} onChange={(e) => setNewContactForm({ ...newContactForm, lastName: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input type="email" placeholder="Email" value={newContactForm.email} onChange={(e) => setNewContactForm({ ...newContactForm, email: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Phone" value={newContactForm.phone} onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Title (e.g. CTO)" value={newContactForm.title} onChange={(e) => setNewContactForm({ ...newContactForm, title: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <AsyncSelect
                        fetchOptions={fetchAccountOptions}
                        value={newContactForm.accountId}
                        selectedLabel={newContactAccountLabel}
                        onChange={(opt) => { setNewContactForm({ ...newContactForm, accountId: opt.value, newAccountName: "" }); setNewContactAccountLabel(opt.label) }}
                        placeholder="No company / standalone"
                      />
                    </div>
                  </div>
                  {!newContactForm.accountId && (
                    <div className={modalStyles.field}>
                      <input
                        placeholder="…or type a new company name to create it"
                        value={newContactForm.newAccountName}
                        onChange={(e) => setNewContactForm({ ...newContactForm, newAccountName: e.target.value })}
                        className={styles.uInputSm}
                      />
                    </div>
                  )}
                  <div className={styles.actionsEndSm}>
                    <button type="button" onClick={() => setShowNewContactForm(false)} className={styles.btnGhostSm}>Cancel</button>
                    <button type="button" onClick={addNewContactToForm} className={styles.btnAccentXs}>Add contact</button>
                  </div>
                </div>
              )}

              <div className={styles.colGapSm}>
                {pendingContacts.length === 0 ? (
                  <p className={styles.emptyTextSm}>No contacts linked yet.</p>
                ) : (
                  pendingContacts.map((p) => (
                    <div key={p.tempId} className={styles.contactRow}>
                      <div>
                        <div className={styles.uTitleSm}>{p.isNew ? `${p.firstName} ${p.lastName}` : p.name} {p.isNew && <span className={styles.primaryTag}>(new)</span>}</div>
                        <div className={styles.uMutedSm}>{p.email || p.title || ""}</div>
                      </div>
                      <button type="button" onClick={() => removePendingContact(p.tempId)} className={styles.uDangerLink}>Remove</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Save changes" : "Create lead"}
            </button>
          </div>
        </form>
      </SliderDialog>

      <Modal open={!!convertLead} onClose={() => setConvertLead(null)} title={`Convert ${convertLead ? `${convertLead.firstName} ${convertLead.lastName}` : ""}`}>
        {pipeline && (
          <form onSubmit={handleConvert} className={`${modalStyles.body} ${styles.uP0}`}>
            <p className={styles.convertNote}>
              Creates an Account (if a company is set), a Contact, and a Deal — then marks this lead as converted.
            </p>
            <div className={modalStyles.field}>
              <label>Deal name</label>
              <input required value={convertForm.dealName} onChange={(e) => setConvertForm({ ...convertForm, dealName: e.target.value })} />
            </div>
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Deal value (₹)</label>
                <input type="number" min="0" value={convertForm.dealValue} onChange={(e) => setConvertForm({ ...convertForm, dealValue: e.target.value })} />
              </div>
              <div className={modalStyles.field}>
                <label>Starting stage</label>
                <SearchableSelect
                  options={pipeline.stages}
                  value={convertForm.stageId}
                  onChange={(v) => setConvertForm({ ...convertForm, stageId: v })}
                  labelKey="name"
                  valueKey="id"
                />
              </div>
            </div>
            {error && <p className={modalStyles.error}>{error}</p>}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.cancelBtn} onClick={() => setConvertLead(null)}>Cancel</button>
              <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
                {submitting ? "Converting…" : "Convert lead"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={reload}
      />

      <LeadDetail
        leadId={detailLeadId}
        clientTypes={clientTypes}
        products={products}
        events={events}
        customFields={customFields}
        onClose={() => setDetailLeadId(null)}
        onChanged={reload}
      />
    </PageShell>
  )
}

function LeadDetail({ leadId, clientTypes, products, events, customFields, onClose, onChanged }) {
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("details") // details | contacts
  
  // New-contact quick-create form state (creates a real Contact, optionally a new Account too)
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", newAccountName: "" })
  const [contactError, setContactError] = useState("")
  const [linkContactId, setLinkContactId] = useState("")
  const [linkContactLabel, setLinkContactLabel] = useState("")
  const [contactAccountLabel, setContactAccountLabel] = useState("")

  async function handleLinkContact() {
    if (!linkContactId) return
    try {
      await api.post(`/leads/${leadId}/link-contact`, { contactId: linkContactId })
      setLinkContactId("")
      setLinkContactLabel("")
      loadLead()
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleUnlinkContact(contactId) {
    if (!confirm("Unlink this contact from the lead?")) return
    try {
      await api.delete(`/leads/${leadId}/link-contact/${contactId}`)
      loadLead()
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  function loadLead() {
    setLoading(true)
    api.get(`/leads/${leadId}`)
      .then((data) => setLead(data))
      .catch((err) => console.error("Error loading lead", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (leadId) {
      loadLead()
      setActiveTab("details")
      setShowContactForm(false)
    } else {
      setLead(null)
    }
  }, [leadId])

  async function handleAddContact(e) {
    e.preventDefault()
    setContactError("")
    try {
      let accountId = contactForm.accountId || null
      if (!accountId && contactForm.newAccountName?.trim()) {
        const account = await api.post("/accounts", { name: contactForm.newAccountName.trim() })
        accountId = account.id
      }
      const created = await api.post("/contacts", {
        firstName: contactForm.firstName,
        lastName: contactForm.lastName,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        title: contactForm.title || null,
        accountId,
      })
      await api.post(`/leads/${leadId}/link-contact`, { contactId: created.id })
      setContactForm({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", newAccountName: "" })
      setContactAccountLabel("")
      setShowContactForm(false)
      loadLead()
      onChanged()
    } catch (err) {
      setContactError(err.message)
    }
  }

  if (!leadId) return null

  const leadCFValues = lead?.customFields || {}

  return (
    <SliderDialog open={!!leadId} onClose={onClose} title={lead ? `Lead: ${lead.firstName} ${lead.lastName}` : "Lead Details"} width="min(34rem, 100vw)">
      {loading || !lead ? (
        <p className={styles.loadingP2}>Loading details…</p>
      ) : (
        <div className={`${modalStyles.body} ${styles.uP0} ${styles.uColGap1}`}>

          {/* HEADER BADGES */}
          <div className={styles.detailBadgesRow}>
            <Badge tone={STATUS_TONE[lead.status] || "neutral"}>{lead.status}</Badge>
            <Badge tone={PRIORITY_TONE[lead.priority] || "neutral"}>{lead.priority || "MEDIUM"}</Badge>
            {lead.clientType && <Badge tone="neutral">{lead.clientType.name}</Badge>}
            {(lead.products || []).length > 0
              ? lead.products.map((lp) => <Badge key={lp.id} tone="neutral">{lp.product?.name}</Badge>)
              : lead.product && <Badge tone="neutral">{lead.product.name}</Badge>}
            {lead.event && <Badge tone="new">Event: {lead.event.name}</Badge>}
          </div>

          {/* TABS */}
          <div className={styles.tabRow}>
            <button
              onClick={() => setActiveTab("details")}
              className={`${styles.tabBtn} ${activeTab === "details" ? styles.tabBtnActive : ""}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`${styles.tabBtn} ${activeTab === "contacts" ? styles.tabBtnActive : ""}`}
            >
              Contacts ({lead.contactLinks?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("emails")}
              className={`${styles.tabBtn} ${activeTab === "emails" ? styles.tabBtnActive : ""}`}
            >
              Emails
            </button>
          </div>

          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className={styles.uColGap1}>
              <div className={styles.grid2}>
                <div>
                  <span className={styles.uLabelSm}>Email</span>
                  <span className={styles.uValueMd}>{lead.email || "—"}</span>
                </div>
                <div>
                  <span className={styles.uLabelSm}>Phone</span>
                  <span className={styles.uValueMd}>{lead.phone || "—"}</span>
                </div>
                <div>
                  <span className={styles.uLabelSm}>Company</span>
                  <span className={styles.uValueMd}>{lead.company || "—"}</span>
                </div>
                <div>
                  <span className={styles.uLabelSm}>Source</span>
                  <span className={styles.uValueMd}>{lead.source || "—"}</span>
                </div>
              </div>

              {/* CUSTOM FIELDS VALUES SECTION */}
              {customFields.length > 0 && (
                <div className={styles.customFieldsWrap}>
                  <h5 className={styles.headingSmMb}>Custom Fields</h5>
                  <div className={styles.grid2Tight}>
                    {customFields.map((f) => (
                      <div key={f.id}>
                        <span className={styles.fieldLabelXs}>{f.label}</span>
                        <span className={styles.uValueMd}>{leadCFValues[f.id] || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTACT PERSONS TAB */}
          {activeTab === "contacts" && (
            <div className={styles.uColGap1}>
              <div>
                <h5 className={styles.headingSmMb2}>Linked CRM Contacts ({lead.contactLinks?.length || 0})</h5>
                <div className={styles.linkRow}>
                  <div className={styles.flex1}>
                    <AsyncSelect
                      fetchOptions={fetchContactOptions}
                      value={linkContactId}
                      selectedLabel={linkContactLabel}
                      onChange={(opt) => { setLinkContactId(opt.value); setLinkContactLabel(opt.label) }}
                      placeholder="Link an existing contact…"
                    />
                  </div>
                  <button
                    onClick={handleLinkContact}
                    disabled={!linkContactId}
                    className={styles.btnAccentSm}
                  >
                    Link
                  </button>
                </div>
                <div className={styles.colGapSm}>
                  {(lead.contactLinks || []).length === 0 ? (
                    <p className={styles.emptyTextSm}>No linked CRM contacts yet.</p>
                  ) : (
                    lead.contactLinks.map((l) => (
                      <div key={l.id} className={styles.contactRow}>
                        <div>
                          <div className={styles.uTitleSm}>
                            {l.contact.firstName} {l.contact.lastName} {l.isPrimary && <span className={styles.primaryTag}>(primary)</span>}
                          </div>
                          <div className={styles.uMutedSm}>{l.contact.email}</div>
                        </div>
                        <button onClick={() => handleUnlinkContact(l.contactId)} className={styles.uDangerLink}>Unlink</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.rowBetweenBorderTop}>
                <h5 className={styles.headingSm}>Create a new contact</h5>
                {!showContactForm && (
                  <button
                    onClick={() => { setContactForm({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", newAccountName: "" }); setContactAccountLabel(""); setShowContactForm(true) }}
                    className={styles.linkBtn}
                  >
                    + New Contact
                  </button>
                )}
              </div>

              {showContactForm && (
                <form onSubmit={handleAddContact} className={styles.formPanel}>
                  <div className={styles.formTitle}>New contact — saved to your real Contacts list</div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input required placeholder="First name" value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input required placeholder="Last name" value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Title (e.g. CTO)" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <AsyncSelect
                        fetchOptions={fetchAccountOptions}
                        value={contactForm.accountId}
                        selectedLabel={contactAccountLabel}
                        onChange={(opt) => { setContactForm({ ...contactForm, accountId: opt.value, newAccountName: "" }); setContactAccountLabel(opt.label) }}
                        placeholder="No company / standalone"
                      />
                    </div>
                  </div>
                  {!contactForm.accountId && (
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input
                        placeholder="…or type a new company name to create it"
                        value={contactForm.newAccountName}
                        onChange={(e) => setContactForm({ ...contactForm, newAccountName: e.target.value })}
                        className={styles.uInputSm}
                      />
                    </div>
                  )}
                  {contactError && <div className={styles.errorTextSm}>{contactError}</div>}
                  <div className={styles.actionsEndSm}>
                    <button type="button" onClick={() => setShowContactForm(false)} className={styles.btnGhostSm}>Cancel</button>
                    <button type="submit" className={styles.btnAccentXs}>Save & link</button>
                  </div>
                </form>
              )}

              {(lead.contacts || []).length > 0 && (
                <div className={styles.scrollListMd}>
                  <h5 className={styles.headingSmMb2}>Legacy contact notes</h5>
                  <p className={styles.emptyTextSm}>Captured before this lead was linked to real Contacts — read-only.</p>
                  {lead.contacts.map((c) => (
                    <div key={c.id} className={styles.contactRowBg}>
                      <div>
                        <div className={styles.uTitleSm}>{c.name} {c.role && <span className={styles.roleTag}>({c.role})</span>}</div>
                        <div className={styles.uMutedSm}>{c.email} {c.phone && `· ${c.phone}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "emails" && <EmailThread leadId={lead.id} />}

        </div>
      )}
    </SliderDialog>
  )
}