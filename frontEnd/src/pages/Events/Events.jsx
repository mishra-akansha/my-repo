import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import CustomFieldsSection from "../../components/UI/CustomFieldsSection.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate, formatCurrency } from "../../lib/format.js"
import { MdOutlineEdit, MdOutlineDeleteOutline, MdOutlineEvent, MdOutlineLocationOn, MdOutlineSearch } from "react-icons/md"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import useDebounce from "../../hooks/useDebounce.js"
import styles from "./Events.module.css"

const EMPTY_EVENT = { name: "", date: "", location: "", description: "", customFields: {} }

export default function Events() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("events.create")
  const canEdit = hasPermission("events.edit")
  const canDelete = hasPermission("events.delete")
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)

  const extraParams = useMemo(() => {
    const p = {}
    if (debouncedSearch) p.search = debouncedSearch
    return p
  }, [debouncedSearch])

  const {
    data: events,
    loading,
    hasMore,
    lastElementRef,
    reload: reloadEvents,
    setData: setEvents,
    totalCount
  } = useInfiniteScroll("/events", 12, extraParams)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_EVENT)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Event stats mapping (e.g. eventId -> stats object)
  const [eventStats, setEventStats] = useState({})
  const [customFieldDefs, setCustomFieldDefs] = useState([])

  useEffect(() => {
    api.get("/custom-fields").then((list) => setCustomFieldDefs(list.filter((f) => f.entityType === "EVENT"))).catch(() => {})
    api.get("/events/stats").then(setEventStats).catch(() => ({}))
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_EVENT)
    setError("")
    setModalOpen(true)
  }

  function openEdit(e) {
    setEditingId(e.id)
    setForm({
      name: e.name,
      date: e.date ? e.date.slice(0, 10) : "",
      location: e.location || "",
      description: e.description || "",
      customFields: {},
    })
    setError("")
    setModalOpen(true)
    api.get(`/events/${e.id}`).then((full) => {
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    }).catch((err) => console.error("Failed to load event custom fields", err))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (editingId) {
        await api.patch(`/events/${editingId}`, form)
      } else {
        await api.post("/events", form)
      }
      setModalOpen(false)
      await reloadEvents()
      api.get("/events/stats").then(setEventStats).catch(() => ({}))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this Event Project? Leads, deals, and tasks linked to it will remain but won't show in this campaign project.")) return
    try {
      await api.delete(`/events/${id}`)
      await reloadEvents()
      api.get("/events/stats").then(setEventStats).catch(() => ({}))
    } catch (err) {
      alert(err.message)
    }
  }

  // Calculate totals
  const totalCapturedLeads = Object.values(eventStats).reduce((sum, s) => sum + (s.leadsCount || 0), 0)
  const totalPipelineValue = Object.values(eventStats).reduce((sum, s) => sum + (s.totalValue || 0), 0)

  return (
    <>
      <Topbar
        title="Event Projects"
        subtitle={`${totalCount || events.length} marketing campaigns registered`}
        action={
          canCreate && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openCreate}>
              + Create Event
            </motion.button>
          )
        }
      />

      <div className={`${styles.page} ${styles.uPageWrap2}`}>
        
        {/* SUMMARY STATS CONTAINER */}
        <div className={styles.uStatsGrid3}>
          <div className={styles.uSummaryCard}>
            <span className={styles.uStatLabel2}>Total Campaigns</span>
            <span className={styles.uStatValueLg}>{totalCount || events.length} Total</span>
          </div>
          <div className={styles.uSummaryCard}>
            <span className={styles.uStatLabel2}>Total Leads Generated</span>
            <span className={`${styles.uStatValueLg} ${styles.uStatValueAccent}`}>{totalCapturedLeads} Leads</span>
          </div>
          <div className={styles.uSummaryCard}>
            <span className={styles.uStatLabel2}>Generated Deal Pipeline</span>
            <span className={`${styles.uStatValueLg} ${styles.uStatValueBlue}`}>{formatCurrency(totalPipelineValue)}</span>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className={styles.searchBarWrap}>
          <div className={styles.searchBox}>
            <MdOutlineSearch size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search event campaigns by name, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* PROJECTS GRID DIRECTORY */}
        <div>
          <h3 className={styles.uSectionHeading}>Event Projects Workspace</h3>
          {loading && events.length === 0 ? (
            <div className={styles.uLoadingCenterLg}>Loading Event Projects...</div>
          ) : events.length === 0 ? (
            <div className={styles.uEmptyStateBox}>
              <p className={styles.uEmptyStateText}>No marketing event projects found.</p>
              {canCreate && <button className={styles.addBtn} onClick={openCreate}>+ Create your first Event</button>}
            </div>
          ) : (
            <>
              <div className={styles.uEventsGrid}>
                {events.map((e, index) => {
                  const stats = eventStats[e.id] || { leadsCount: 0, dealsCount: 0, totalValue: 0, tasksCount: 0 }
                  return (
                    <motion.div
                      key={e.id}
                      ref={index === events.length - 1 ? lastElementRef : null}
                      onClick={() => navigate(`/events/${e.id}`)}
                      whileHover={{ y: -4, boxShadow: "var(--shadow-lg)", borderColor: "var(--primary)" }}
                      transition={{ duration: 0.2 }}
                      className={styles.uEventCard}
                    >
                      <div>
                        <div className={styles.uCardHeadRow}>
                          <h4 className={styles.uCardTitleLg}>{e.name}</h4>
                          {(canEdit || canDelete) && (
                            <div className={styles.uCardActions} onClick={(ev) => ev.stopPropagation()}>
                              {canEdit && (
                                <button
                                  onClick={() => openEdit(e)}
                                  className={`${styles.uIconBtn} ${styles.uIconBtnMuted}`}
                                  title="Edit Event"
                                >
                                  <MdOutlineEdit size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(e.id)}
                                  className={`${styles.uIconBtn} ${styles.uIconBtnDanger}`}
                                  title="Delete Event"
                                >
                                  <MdOutlineDeleteOutline size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className={styles.uCardMetaCol}>
                          <span className={styles.uMetaLine}><MdOutlineEvent size={14} /> {formatDate(e.date)}</span>
                          <span className={styles.uMetaLine}><MdOutlineLocationOn size={14} /> {e.location || "Location not configured"}</span>
                        </div>
                      </div>

                      <div className={styles.uCardStatsRow}>
                        <div className={styles.uColPlain}>
                          <span className={styles.uStatLabel}>Leads</span>
                          <span className={styles.uStatValPrimary}>{stats.leadsCount}</span>
                        </div>
                        <div className={styles.uColPlain}>
                          <span className={styles.uStatLabel}>Deals</span>
                          <span className={styles.uStatValPrimary}>{stats.dealsCount}</span>
                        </div>
                        <div className={styles.uColPlain}>
                          <span className={styles.uStatLabel}>Open Tasks</span>
                          <span className={styles.uStatValOrange}>{stats.tasksCount}</span>
                        </div>
                        <div className={styles.uColPlain}>
                          <span className={styles.uStatLabel}>Pipeline</span>
                          <span className={styles.uStatValEmerald}>{formatCurrency(stats.totalValue)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {hasMore && (
                <div className={styles.infiniteLoadingSentinel}>
                  <span>Loading more events...</span>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Event" : "Create Event"}>
        <form onSubmit={handleSubmit} className={modalStyles.body}>
          {error && <div className={modalStyles.error}>{error}</div>}
          
          <div className={modalStyles.field}>
            <label>Event Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. MedTech Expo 2026"
            />
          </div>

          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Event Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className={modalStyles.field}>
              <label>Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Hall 4, Bangalore"
              />
            </div>
          </div>

          <div className={modalStyles.field}>
            <label>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe goals, target stalls, attendees focus..."
            />
          </div>

          <CustomFieldsSection
            fields={customFieldDefs}
            values={form.customFields || {}}
            onChange={(fieldId, val) =>
              setForm((f) => ({ ...f, customFields: { ...(f.customFields || {}), [fieldId]: val } }))
            }
          />

          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
