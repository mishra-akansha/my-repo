import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import Modal from "../../components/UI/Modal.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import { MdClose } from "react-icons/md"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import styles from "./Settings.module.css"

const EMPTY_EVENT = { name: "", date: "", location: "", description: "" }

const STATUS_TONE = { NEW: "new", CONTACTED: "progress", QUALIFYING: "progress", CONVERTED: "won", DISQUALIFIED: "lost" }

export default function Events() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("events.create")
  const canEdit = hasPermission("events.edit")
  const canDelete = hasPermission("events.delete")

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal controls
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_EVENT)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Selected Event Leads view
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventLeads, setEventLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  function reload() {
    setLoading(true)
    return api.get("/events")
      .then((data) => setEvents(data))
      .catch((err) => console.error("Error loading events", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    if (selectedEvent) {
      setLoadingLeads(true)
      api.get(`/events/${selectedEvent.id}/leads`)
        .then((data) => setEventLeads(data))
        .catch((err) => console.error("Error loading event leads", err))
        .finally(() => setLoadingLeads(false))
    } else {
      setEventLeads([])
    }
  }, [selectedEvent])

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
    })
    setError("")
    setModalOpen(true)
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
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this event? Leads associated with it will remain but won't be linked to this event.")) return
    try {
      await api.delete(`/events/${id}`)
      if (selectedEvent?.id === id) setSelectedEvent(null)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar title="Events Manager" subtitle="Organize marketing events & track their generated leads" />
      
      <div className={`${styles.page} ${styles.evPageWrap}`}>
        
        {/* TOP BAR ACTION */}
        <div className={styles.evTopBar}>
          <h3 className={styles.evHeading}>Trade Shows, Conferences & Events</h3>
          {canCreate && (
            <button className={styles.addBtn} onClick={openCreate}>
              + Add Event
            </button>
          )}
        </div>

        {/* SPLIT PANEL VIEW */}
        <div className={`${styles.evSplitGrid} ${selectedEvent ? styles.evSplitGridOpen : ""}`}>
          
          {/* EVENTS LIST */}
          <div className={`${styles.tableWrap} ${styles.evListWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyState}>Loading events…</td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyState}>
                      <EmptyState type="generic" title="No events configured yet" hint="Create an event to start tracking leads captured from it." compact />
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className={`${styles.evRow} ${selectedEvent?.id === e.id ? styles.evRowActive : ""}`}
                    >
                      <td className={styles.evNameCell}>{e.name}</td>
                      <td>{formatDate(e.date)}</td>
                      <td>{e.location || <span className={styles.evMutedDash}>—</span>}</td>
                      <td>
                        <div className={styles.uRowGap2} onClick={(ev) => ev.stopPropagation()}>
                          <button
                            className={styles.rowActionBtn}
                            onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e) }}
                          >
                            View Leads
                          </button>
                          {canEdit && (
                            <button
                              className={styles.rowActionBtn}
                              onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={styles.rowActionBtnDanger}
                              onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id) }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* LEADS TRACKING PANEL */}
          <AnimatePresence>
            {selectedEvent && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`${styles.tableWrap} ${styles.evLeadsPanel}`}
              >
                <div className={styles.evPanelHeader}>
                  <div>
                    <h4 className={styles.evPanelTitle}>Leads from {selectedEvent.name}</h4>
                    <p className={styles.evPanelDesc}>{selectedEvent.description || "No description provided."}</p>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className={styles.evCloseBtn}
                  >
                    <MdClose size={18} />
                  </button>
                </div>

                <div className={styles.evScrollBox}>
                  {loadingLeads ? (
                    <p className={styles.uEmptySm}>Loading leads…</p>
                  ) : eventLeads.length === 0 ? (
                    <p className={styles.uEmptySm}>No leads captured from this event yet.</p>
                  ) : (
                    <div className={styles.evLeadsList}>
                      {eventLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className={styles.evLeadCard}
                        >
                          <div className={styles.evLeadCardHead}>
                            <div>
                              <div className={styles.evLeadName}>{lead.firstName} {lead.lastName}</div>
                              <div className={styles.evLeadCompany}>{lead.company || "No company"}</div>
                            </div>
                            <Badge tone={STATUS_TONE[lead.status] || "neutral"}>{lead.status}</Badge>
                          </div>

                          <div className={styles.evBadgesWrap}>
                            {lead.clientType && <Badge tone="neutral">{lead.clientType.name}</Badge>}
                            {lead.product && <Badge tone="neutral">{lead.product.name}</Badge>}
                            {lead.contacts && lead.contacts.length > 0 && (
                              <Badge tone="neutral">+{lead.contacts.length} Contact Persons</Badge>
                            )}
                          </div>

                          <div className={styles.evLeadFooter}>
                            <div className={styles.evOwnerInfo}>
                              <span>Owner:</span>
                              <Avatar name={lead.owner?.name} color={lead.owner?.color} size={14} />
                              <span className={styles.evOwnerName}>{lead.owner?.name}</span>
                            </div>
                            <div>{lead.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* CREATE/EDIT MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Event" : "Create Event"}>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Event Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vibrant India Expo 2026" />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bangalore Palace" />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide a description of the target audience or details of the show"
              rows={3}
            />
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : "Save Event"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
