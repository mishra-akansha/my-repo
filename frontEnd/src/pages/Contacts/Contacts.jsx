import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PageShell from "../../components/Layout/PageShell.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import CustomFieldsSection from "../../components/UI/CustomFieldsSection.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import Badge from "../../components/UI/Badge.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import EmailThread from "../../components/UI/EmailThread.jsx"
import { formatCurrency, formatDate } from "../../lib/format.js"
import { CardsSkeleton } from "../../components/UI/Skeleton.jsx"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import { MdOutlineMail, MdOutlineCall } from "react-icons/md"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import styles from "./Contacts.module.css"

async function fetchAccountOptions(term) {
  const res = await api.get(`/accounts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((a) => ({ value: a.id, label: a.name }))
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }
const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", customFields: {} }

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Contacts() {
  const { hasPermission } = useAuth()
  const [accountLabel, setAccountLabel] = useState("")
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 350)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState("overview")

  const extraParams = useMemo(() => {
    const p = {}
    if (debouncedQuery) p.search = debouncedQuery
    return p
  }, [debouncedQuery])

  const {
    data: contacts,
    loading,
    hasMore,
    reload,
    lastElementRef,
    setData: setContacts,
    totalCount,
  } = useInfiniteScroll("/contacts", 18, extraParams)

  const [customFieldDefs, setCustomFieldDefs] = useState([])

  useEffect(() => {
    api.get("/custom-fields").then((list) => setCustomFieldDefs(list.filter((f) => f.entityType === "CONTACT"))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    api.get(`/contacts/${detailId}`).then(setDetail).catch(console.error).finally(() => setDetailLoading(false))
  }, [detailId])

  function openDetail(contact) {
    setDetailId(contact.id)
    setDetailTab("overview")
    setOpenMenuId(null)
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setAccountLabel("")
    setError("")
    setModalOpen(true)
  }

  useEffect(() => {
    if (!openMenuId) return
    function handleOutsideClick() {
      setOpenMenuId(null)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [openMenuId])

  async function openEdit(contact) {
    setEditingId(contact.id)
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      title: contact.title || "",
      accountId: contact.accountId || "",
      customFields: {},
    })
    setAccountLabel(contact.account?.name || "")
    setError("")
    setModalOpen(true)
    setOpenMenuId(null)
    try {
      const full = await api.get(`/contacts/${contact.id}`)
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
      if (full.account?.name) setAccountLabel(full.account.name)
    } catch (err) {
      console.error("Failed to load contact custom fields", err)
    }
  }

  async function handleDelete(contact) {
    setOpenMenuId(null)
    if (!confirm(`Delete contact "${contact.firstName} ${contact.lastName}"? This can't be undone.`)) return
    await api.delete(`/contacts/${contact.id}`)
    setContacts((prev) => prev.filter((c) => c.id !== contact.id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = { ...form, accountId: form.accountId || undefined }
      if (editingId) {
        const updated = await api.patch(`/contacts/${editingId}`, payload)
        setContacts((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
      } else {
        await api.post("/contacts", payload)
        await reload()
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const companyCount = useMemo(
    () => new Set(contacts.map((c) => c.account?.name).filter(Boolean)).size,
    [contacts]
  )

  return (
    <PageShell
      title="Contacts"
      subtitle={loading && contacts.length === 0 ? "Loading…" : `${totalCount} people`}
      action={
        hasPermission("contacts.create") ? (
          <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openCreate}>
            + New Contact
          </motion.button>
        ) : null
      }
      loading={loading && contacts.length === 0}
      loadingFallback={<div className={styles.page}><CardsSkeleton /></div>}
    >
      <div className={styles.page}>
        <div className={styles.filterRow}>
          <input
            className={styles.search}
            placeholder="Search contacts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.cardsWrap}>
          {loading && contacts.length === 0 ? (
            <CardsSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState type="contacts" title="No contacts match this search" hint="Try a different search term, or add a new contact to get started." />
          ) : (
            <>
              <motion.div className={styles.grid} variants={container} initial="hidden" animate="show">
                <AnimatePresence>
                  {contacts.map((contact, idx) => {
                    const owner = contact.owner
                    const dealCount = contact._count?.deals ?? 0
                    const fullName = `${contact.firstName} ${contact.lastName}`
                    const isLast = idx === contacts.length - 1
                    return (
                      <motion.div
                        key={contact.id}
                        ref={isLast ? lastElementRef : null}
                        className={styles.card}
                        variants={item}
                        layout
                        exit={{ opacity: 0, scale: 0.94 }}
                        whileHover={{ y: -4, boxShadow: "0 0.6rem 1.5rem rgba(20,23,26,0.12)" }}
                        transition={{ duration: 0.2 }}
                        onClick={() => openDetail(contact)}
                      >
                        <div className={styles.cardTop}>
                          <Avatar name={fullName} size={44} color={owner?.color} />
                          <div className={styles.menuAnchor}>
                            {(hasPermission("contacts.edit") || hasPermission("contacts.delete")) && (
                              <button className={styles.moreBtn} onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === contact.id ? null : contact.id) }}>⋯</button>
                            )}
                            {openMenuId === contact.id && (
                              <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                                {hasPermission("contacts.edit") && <button onClick={(e) => { e.stopPropagation(); openEdit(contact) }}>Edit</button>}
                                {hasPermission("contacts.delete") && <button onClick={(e) => { e.stopPropagation(); handleDelete(contact) }} className={styles.menuDanger}>Delete</button>}
                              </div>
                            )}
                          </div>
                        </div>
                        <h4 className={styles.name}>{fullName}</h4>
                        <p className={styles.role}>{contact.title || "—"} · {contact.account?.name || "No account"}</p>

                        <div className={styles.divider} />

                        <div className={styles.detailRow}>
                          <span className={styles.detailIcon}><MdOutlineMail size={13} /></span>
                          <span className={styles.detailText}>{contact.email || "—"}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailIcon}><MdOutlineCall size={13} /></span>
                          <span className={styles.detailText}>{contact.phone || "—"}</span>
                        </div>

                        <div className={styles.cardFooter}>
                          <span className={styles.dealBadge}>{dealCount} active deal{dealCount !== 1 ? "s" : ""}</span>
                          <span className={styles.ownerName}>{owner?.name}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
              {hasMore && (
                <div ref={lastElementRef} className={styles.loadMore}>
                  {loading ? "Loading more contacts..." : "Scroll down to load more..."}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit contact" : "New contact"}>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
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
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Account</label>
              <AsyncSelect
                fetchOptions={fetchAccountOptions}
                value={form.accountId}
                selectedLabel={accountLabel}
                onChange={(opt) => { setForm({ ...form, accountId: opt.value }); setAccountLabel(opt.label) }}
                placeholder="No account"
              />
            </div>
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
              {submitting ? "Saving…" : editingId ? "Save changes" : "Create contact"}
            </button>
          </div>
        </form>
      </Modal>

      <SliderDialog
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.firstName} ${detail.lastName}` : "Contact"}
        width="min(30rem, 100vw)"
        footer={detail && (
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setDetailId(null)}>Close</button>
            {hasPermission("contacts.edit") && (
              <button type="button" className={modalStyles.submitBtn} onClick={() => { setDetailId(null); openEdit(detail) }}>Edit contact</button>
            )}
          </div>
        )}
      >
        {detailLoading || !detail ? (
          <p className={styles.uMuted}>Loading…</p>
        ) : (
          <div className={styles.uColGap1}>
            <div className={styles.uRowWrap}>
              {detail.title && <Badge tone="neutral">{detail.title}</Badge>}
              {detail.account && <Badge tone="neutral">{detail.account.name}</Badge>}
            </div>

            <div className={styles.tabRow}>
              <button onClick={() => setDetailTab("overview")} className={`${styles.tabBtn} ${detailTab === "overview" ? styles.tabBtnActive : ""}`}>Overview</button>
              <button onClick={() => setDetailTab("related")} className={`${styles.tabBtn} ${detailTab === "related" ? styles.tabBtnActive : ""}`}>
                Related ({(detail.leadLinks?.length || 0) + (detail.deals?.length || 0)})
              </button>
              <button onClick={() => setDetailTab("emails")} className={`${styles.tabBtn} ${detailTab === "emails" ? styles.tabBtnActive : ""}`}>Emails</button>
            </div>

            {detailTab === "overview" && (
            <div className={styles.uColGap1}>
            <div className={styles.uListPlain}>
              <div className={styles.uRowItem}><span>Email</span><span>{detail.email || "—"}</span></div>
              <div className={styles.uRowItem}><span>Phone</span><span>{detail.phone || "—"}</span></div>
              <div className={styles.uRowItem}><span>Owner</span><span>{detail.owner?.name || "—"}</span></div>
            </div>
            {customFieldDefs.length > 0 && (
              <div>
                <h5 className={styles.uSectionTitleSm}>Custom Fields</h5>
                <div className={styles.uListPlain}>
                  {customFieldDefs.map((f) => (
                    <div key={f.id} className={styles.uRowItem}>
                      <span>{f.label}</span>
                      <span>{detail.customFields?.[f.id] || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
            )}

            {detailTab === "related" && (
            <div className={styles.uColGap1}>
            <div>
              <h5 className={styles.uSectionTitleSm}>Linked Leads ({detail.leadLinks?.length || 0})</h5>
              <div className={styles.uListPlain}>
                {(detail.leadLinks || []).length === 0 ? (
                  <p className={styles.uMuted}>No leads linked to this contact.</p>
                ) : (
                  detail.leadLinks.map((l) => (
                    <div key={l.id} className={styles.uRowItem}>
                      <span>{l.lead.firstName} {l.lead.lastName}</span>
                      <Badge tone="neutral">{l.lead.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h5 className={styles.uSectionTitleSm}>Deals ({detail.deals?.length || 0})</h5>
              <div className={styles.uListPlain}>
                {(detail.deals || []).length === 0 ? (
                  <p className={styles.uMuted}>No deals linked to this contact.</p>
                ) : (
                  detail.deals.map((d) => (
                    <div key={d.id} className={styles.uRowItem}>
                      <span>{d.name}</span>
                      <span>{formatCurrency(d.value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h5 className={styles.uSectionTitleSm}>Activity ({detail.activities?.length || 0})</h5>
              <div className={styles.uListPlain}>
                {(detail.activities || []).length === 0 ? (
                  <p className={styles.uMuted}>No activity logged yet.</p>
                ) : (
                  detail.activities.map((a) => (
                    <div key={a.id} className={styles.uRowItem}>
                      <span>{a.notes.slice(0, 60)}{a.notes.length > 60 ? "…" : ""}</span>
                      <span className={styles.uMuted}>{formatDate(a.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
            )}

            {detailTab === "emails" && <EmailThread contactId={detail.id} />}
          </div>
        )}
      </SliderDialog>
    </PageShell>
  )
}