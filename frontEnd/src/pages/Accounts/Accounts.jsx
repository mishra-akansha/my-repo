import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PageShell from "../../components/Layout/PageShell.jsx"
import Modal from "../../components/UI/Modal.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import CustomFieldsSection from "../../components/UI/CustomFieldsSection.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { CardsSkeleton } from "../../components/UI/Skeleton.jsx"
import { formatCurrency } from "../../lib/format.js"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import EmptyState from "../../components/UI/EmptyState.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import {
  MdOutlineBusiness,
  MdOutlineLanguage,
  MdOutlineLocationOn,
  MdOutlinePersonOutline,
  MdOutlineAttachMoney,
  MdOutlineMail,
  MdOutlinePhone,
  MdOpenInNew,
} from "react-icons/md"
import styles from "./Accounts.module.css"

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }
const EMPTY_FORM = { name: "", industry: "", website: "", address: "", customFields: {} }

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Accounts() {
  const { hasPermission } = useAuth()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState(null)
  const [customFieldDefs, setCustomFieldDefs] = useState([])

  const extraParams = useMemo(() => {
    const params = {}
    if (debouncedQuery) params.search = debouncedQuery
    return params
  }, [debouncedQuery])

  const {
    data: accounts,
    totalCount,
    hasMore,
    loading,
    lastElementRef,
    reload,
  } = useInfiniteScroll("/accounts", 20, extraParams)

  useEffect(() => {
    api.get("/custom-fields").then((list) => {
      setCustomFieldDefs(list.filter((f) => f.entityType === "ACCOUNT"))
    }).catch(console.error)
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError("")
    setModalOpen(true)
  }

  function openEdit(account) {
    setEditingId(account.id)
    setForm({
      name: account.name,
      industry: account.industry || "",
      website: account.website || "",
      address: account.address || "",
      customFields: {},
    })
    setError("")
    setModalOpen(true)
    api.get(`/accounts/${account.id}`).then((full) => {
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    }).catch((err) => console.error("Failed to load account custom fields", err))
  }

  async function handleDelete(account) {
    if (!window.confirm(`Delete ${account.name}?`)) return
    try {
      await api.delete(`/accounts/${account.id}`)
      reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (editingId) {
        await api.patch(`/accounts/${editingId}`, form)
      } else {
        await api.post("/accounts", form)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(account) {
    const full = await api.get(`/accounts/${account.id}`)
    setDetail(full)
  }

  return (
    <PageShell
      title="Accounts"
      subtitle={loading && accounts.length === 0 ? "Loading…" : `${totalCount} companies`}
      action={
        hasPermission("accounts.create") ? (
          <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openCreate}>
            + New Account
          </motion.button>
        ) : null
      }
      loading={loading && accounts.length === 0}
      loadingFallback={<div className={styles.page}><CardsSkeleton /></div>}
    >
      <div className={styles.page}>
        <div className={styles.filterRow}>
          <input className={styles.search} placeholder="Search accounts…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className={styles.cardsWrap}>
          {accounts.length === 0 ? (
            <EmptyState type="accounts" title="No accounts match this search" hint="Try a different search term, or add a new account to get started." />
          ) : (
            <>
              <motion.div className={styles.grid} variants={container} initial="hidden" animate="show">
                <AnimatePresence>
                  {accounts.map((account, idx) => {
                    const isLast = idx === accounts.length - 1
                    return (
                      <motion.div
                        key={account.id}
                        ref={isLast ? lastElementRef : null}
                        className={styles.card}
                        variants={item}
                        layout
                        exit={{ opacity: 0, scale: 0.94 }}
                        whileHover={{ y: -4 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => openDetail(account)}
                      >
                        <h4 className={styles.name}>{account.name}</h4>
                        <p className={styles.meta}>{account.industry || "No industry set"}</p>
                        <div className={styles.stats}>
                          <span>{account._count?.contacts ?? 0} contacts</span>
                          <span>{account._count?.deals ?? 0} deals</span>
                        </div>
                        <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                          {hasPermission("accounts.edit") && <button onClick={() => openEdit(account)}>Edit</button>}
                          {hasPermission("accounts.delete") && <button onClick={() => handleDelete(account)} className={styles.danger}>Delete</button>}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit account" : "New account"}>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Industry</label>
              <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
              {submitting ? "Saving…" : editingId ? "Save changes" : "Create account"}
            </button>
          </div>
        </form>
      </Modal>

      <SliderDialog open={!!detail} onClose={() => setDetail(null)} title={detail?.name || "Account Detail"} width="min(34rem, 100vw)">
        {detail && (
          <div className={styles.drawerContainer}>
            <div className={styles.drawerHeaderCard}>
              <div className={styles.drawerHeaderTop}>
                <div className={styles.companyIconBox}>
                  <MdOutlineBusiness size={22} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <h3 className={styles.drawerTitle}>{detail.name}</h3>
                  <div className={styles.drawerMetaChips}>
                    {detail.industry && (
                      <span className={styles.industryPill}>{detail.industry}</span>
                    )}
                    {detail.website && (
                      <a
                        href={detail.website.startsWith("http") ? detail.website : `https://${detail.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.websiteLink}
                      >
                        <MdOutlineLanguage size={13} />
                        {detail.website.replace(/^https?:\/\//, "")}
                        <MdOpenInNew size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {detail.address && (
                <div className={styles.addressRow}>
                  <MdOutlineLocationOn size={14} style={{ color: "var(--text-tertiary)" }} />
                  <span>{detail.address}</span>
                </div>
              )}
            </div>

            <div className={styles.drawerSectionCard}>
              <div className={styles.drawerSectionHeader}>
                <span className={styles.drawerSectionTitle}>
                  <MdOutlinePersonOutline size={15} /> Linked Contacts ({detail.contacts.length})
                </span>
              </div>

              {detail.contacts.length === 0 ? (
                <div className={styles.drawerEmptyState}>No contacts linked to this account.</div>
              ) : (
                <div className={styles.contactsList}>
                  {detail.contacts.map((c) => (
                    <div key={c.id} className={styles.contactItemCard}>
                      <Avatar name={`${c.firstName} ${c.lastName}`} size={28} />
                      <div className={styles.contactItemInfo}>
                        <span className={styles.contactItemName}>{c.firstName} {c.lastName}</span>
                        {c.email && (
                          <span className={styles.contactItemEmail}>
                            <MdOutlineMail size={12} /> {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className={styles.contactItemPhone}>
                            <MdOutlinePhone size={12} /> {c.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.drawerSectionCard}>
              <div className={styles.drawerSectionHeader}>
                <span className={styles.drawerSectionTitle}>
                  <MdOutlineAttachMoney size={15} /> Linked Deals ({detail.deals.length})
                </span>
              </div>

              {detail.deals.length === 0 ? (
                <div className={styles.drawerEmptyState}>No deals linked to this account.</div>
              ) : (
                <div className={styles.dealsList}>
                  {detail.deals.map((d) => (
                    <div key={d.id} className={styles.dealItemCard}>
                      <div className={styles.dealItemHeader}>
                        <span className={styles.dealItemName}>{d.name}</span>
                        <Badge tone={d.status === "WON" ? "success" : d.status === "LOST" ? "danger" : "primary"}>
                          {d.status}
                        </Badge>
                      </div>
                      <div className={styles.dealItemValue}>
                        {formatCurrency(d.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {customFieldDefs.length > 0 && (
              <div className={styles.drawerSectionCard}>
                <div className={styles.drawerSectionHeader}>
                  <span className={styles.drawerSectionTitle}>Custom Fields</span>
                </div>
                <div className={styles.customFieldsGrid}>
                  {customFieldDefs.map((f) => (
                    <div key={f.id} className={styles.customFieldRow}>
                      <span className={styles.cfLabel}>{f.label}</span>
                      <span className={styles.cfValue}>{detail.customFields?.[f.id] || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SliderDialog>
    </PageShell>
  )
}