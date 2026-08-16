import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Badge from "../../components/UI/Badge.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import {
  MdOutlineMail,
  MdMic,
  MdExpandMore,
  MdExpandLess,
  MdChevronRight,
  MdOutlineDeleteOutline,
  MdOutlineChatBubbleOutline,
  MdOutlineCall,
  MdOutlineDescription,
  MdOutlineEvent,
  MdFilterList,
  MdPersonAdd,
  MdClose,
} from "react-icons/md"
import { api, fileUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import { fillTemplate, findMissingTags, hasUnfilledTags } from "../../lib/emailTemplate.js"
import TemplateMissingFields from "../../components/UI/TemplateMissingFields.jsx"
import fixWebmDuration from "fix-webm-duration"
import styles from "./EventAttendees.module.css"

const STATUS_TONE = { INVITED: "neutral", ATTENDED: "progress", NO_SHOW: "lost" }
const STATUS_LABEL = { INVITED: "Invited", ATTENDED: "Attended", NO_SHOW: "No-show" }
const STATUS_FLOW = ["INVITED", "ATTENDED", "NO_SHOW"]
const STATUS_FILTERS = ["ALL", "INVITED", "ATTENDED", "NO_SHOW"]
const EMPTY_LEAD = { firstName: "", lastName: "", email: "", phone: "", company: "" }
const PAGE_SIZE = 12

const LOG_TYPE_CONFIG = {
  NOTE: { label: "Note", icon: MdOutlineDescription, tone: "neutral" },
  CALL: { label: "Call", icon: MdOutlineCall, tone: "progress" },
  MEETING: { label: "Meeting", icon: MdOutlineEvent, tone: "won" },
  EMAIL: { label: "Email", icon: MdOutlineMail, tone: "primary" },
  VOICE: { label: "Voice", icon: MdMic, tone: "warning" },
}

function parseFollowUpNote(rawNotes, voiceKey) {
  if (voiceKey) return { type: "VOICE", text: rawNotes || "" }
  if (!rawNotes) return { type: "NOTE", text: "" }
  const match = rawNotes.match(/^\[(NOTE|CALL|MEETING|EMAIL)\]\s*(.*)/s)
  if (match) {
    return { type: match[1], text: match[2] }
  }
  return { type: "NOTE", text: rawNotes }
}

// Chrome bug: MediaRecorder-produced webm often reports duration as 0/Infinity/NaN until
// the element is seeked once — force that here. Guarded by a WeakSet so the seek-triggered
// durationchange/timeupdate events this causes don't loop back into fixing it again.
const audioDurationFixed = new WeakSet()
function fixAudioDuration(el) {
  if (audioDurationFixed.has(el)) return
  if (el.duration && isFinite(el.duration)) return
  audioDurationFixed.add(el)
  el.currentTime = 1e7
  const onTimeUpdate = () => {
    el.currentTime = 0
    el.removeEventListener("timeupdate", onTimeUpdate)
  }
  el.addEventListener("timeupdate", onTimeUpdate)
}

export default function EventAttendees({ eventId, leads, onLeadCreated }) {
  const { user, hasPermission } = useAuth()
  const canEdit = hasPermission("events.edit")
  const canEmail = hasPermission("activities.create")
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedAttendeeId, setSelectedAttendeeId] = useState(null)
  const [activeTab, setActiveTab] = useState("activity") // "activity" | "email"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalTab, setAddModalTab] = useState("EXISTING") // "EXISTING" | "NEW"
  const [addModalStatus, setAddModalStatus] = useState("ATTENDED")
  const [addingLeadId, setAddingLeadId] = useState("")
  const [newLead, setNewLead] = useState(EMPTY_LEAD)
  const [newLeadError, setNewLeadError] = useState("")
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" })
  const [emailSending, setEmailSending] = useState(false)
  const [emailTemplateId, setEmailTemplateId] = useState("")
  const [activeEmailTemplate, setActiveEmailTemplate] = useState(null)
  const [missingEmailTags, setMissingEmailTags] = useState([])
  const [emailManualValues, setEmailManualValues] = useState({})
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  async function fetchEmailTemplateOptions(term) {
    const res = await api.get(`/email-templates?search=${encodeURIComponent(term)}&category=event`).catch(() => [])
    return (res || []).map((t) => ({ value: t.id, label: t.name, raw: t }))
  }

  async function reload() {
    try {
      const data = await api.get(`/events/${eventId}/summary`)
      setSummary(data)
    } catch (err) {
      console.error("Failed to load attendee summary", err)
    }
  }

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  useEffect(() => {
    if (summary?.attendees?.length > 0) {
      setSelectedAttendeeId((prev) => (prev && summary.attendees.some((a) => a.id === prev) ? prev : summary.attendees[0].id))
    } else {
      setSelectedAttendeeId(null)
    }
  }, [summary])

  const attendedLeadIds = new Set((summary?.attendees || []).map((a) => a.leadId).filter(Boolean))
  const availableLeads = leads.filter((l) => !attendedLeadIds.has(l.id))

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, statusFilter])

  const allAttendees = summary?.attendees || []
  const filteredAttendees = allAttendees.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false
    if (query.trim()) {
      const person = a.lead || a.contact
      const name = person ? `${person.firstName} ${person.lastName}` : ""
      const haystack = `${name} ${person?.email || ""}`.toLowerCase()
      if (!haystack.includes(query.trim().toLowerCase())) return false
    }
    return true
  })
  const visibleAttendees = filteredAttendees.slice(0, visibleCount)

  const selectedAttendee = summary?.attendees?.find((a) => a.id === selectedAttendeeId) || filteredAttendees[0] || null
  const selectedPerson = selectedAttendee ? (selectedAttendee.lead || selectedAttendee.contact) : null
  const selectedPersonName = selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : "Unknown"
  const selectedCompany = selectedAttendee?.lead?.company || selectedAttendee?.contact?.account?.name || ""

  async function setStatus(attendee, status) {
    try {
      await api.patch(`/events/${eventId}/attendees/${attendee.id}`, { status })
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function removeAttendee(attendee) {
    if (!confirm("Remove this attendee?")) return
    try {
      await api.delete(`/events/${eventId}/attendees/${attendee.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  function openEmail(attendee) {
    if (!attendee) return
    setEmailForm({ subject: "", body: "" })
    setEmailTemplateId("")
    setActiveEmailTemplate(null)
    setMissingEmailTags([])
    setEmailManualValues({})
  }

  function emailAutoData(attendee) {
    const person = attendee.lead || attendee.contact
    return {
      first_name: person?.firstName || "",
      company_name: user?.organization?.name || "",
      owner_name: user?.name || "",
      owner_email: user?.email || "",
    }
  }

  function applyEmailTemplate(attendee, t) {
    setEmailTemplateId(t ? t.id : "")
    if (!t) { setActiveEmailTemplate(null); setMissingEmailTags([]); setEmailManualValues({}); return }
    const autoData = emailAutoData(attendee)
    setActiveEmailTemplate(t)
    setMissingEmailTags(findMissingTags(t, autoData))
    setEmailManualValues({})
    setEmailForm(fillTemplate(t, autoData))
  }

  function updateEmailManualValue(attendee, tag, value) {
    const nextValues = { ...emailManualValues, [tag]: value }
    setEmailManualValues(nextValues)
    if (!activeEmailTemplate) return
    setEmailForm(fillTemplate(activeEmailTemplate, { ...emailAutoData(attendee), ...nextValues }))
  }

  async function sendEmail(attendee) {
    const person = attendee.lead || attendee.contact
    if (!person?.email) return
    if (hasUnfilledTags(emailForm.subject) || hasUnfilledTags(emailForm.body)) {
      alert("Fill in the highlighted template fields before sending.")
      return
    }
    setEmailSending(true)
    try {
      await api.post("/activities/send-email", {
        toEmail: person.email,
        subject: emailForm.subject,
        body: emailForm.body,
        leadId: attendee.leadId || undefined,
        contactId: attendee.contactId || undefined,
        fromEmail: activeEmailTemplate?.fromEmail || null,
        fromName: activeEmailTemplate?.fromName || null,
      })
      alert("Email sent successfully!")
      setActiveTab("activity")
    } catch (err) {
      alert(err.message)
    } finally {
      setEmailSending(false)
    }
  }

  if (loading || !summary) {
    return <div className={styles.section}><p className={styles.empty}>Loading attendee follow-up workspace…</p></div>
  }

  return (
    <div className={styles.section}>
      {/* SECTION HEADER */}
      <div className={styles.sectionHeader}>
        <div className={styles.titleWrap}>
          <h3 className={styles.sectionTitle}>Attendee Follow-up Workspace</h3>
          <div className={styles.statChips}>
            <span className={styles.statChip}>{summary.total} total</span>
            <span className={styles.statChip}>{summary.attendedCount || 0} attended</span>
            {summary.pendingFollowUp > 0 && (
              <span className={`${styles.statChip} ${styles.statChipWarn}`}>{summary.pendingFollowUp} pending</span>
            )}
          </div>
        </div>
      </div>

      {/* MASTER-DETAIL SPLIT GRID */}
      <div className={styles.masterDetailGrid}>
        
        {/* LEFT COLUMN: ATTENDEE DIRECTORY LIST */}
        <div className={styles.leftColumn}>
          <div className={styles.leftColumnToolbar}>
            <div className={styles.leftColumnTopRow}>
              <div className={styles.searchWrap}>
                <MdFilterList size={15} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search attendees…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {canEdit && (
                <button
                  type="button"
                  className={styles.addAttendeeHeaderBtn}
                  onClick={() => {
                    setIsAddModalOpen(true)
                    setAddModalTab(availableLeads.length > 0 ? "EXISTING" : "NEW")
                    setNewLeadError("")
                  }}
                  title="Add or invite attendee to event"
                >
                  <MdPersonAdd size={15} /> + Add
                </button>
              )}
            </div>

            <div className={styles.filterPills}>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === s ? styles.filterPillActive : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "ALL" ? "All" : STATUS_LABEL[s]}
                  {s !== "ALL" && summary.byStatus?.[s] ? ` (${summary.byStatus[s]})` : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Attendees List */}
          <div className={styles.attendeeListScroll}>
            {allAttendees.length === 0 ? (
              <div className={styles.emptyList}>
                <p>No attendees logged for this event yet.</p>
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div className={styles.emptyList}>
                <p>No attendees match this filter.</p>
              </div>
            ) : (
              visibleAttendees.map((a) => {
                const isSelected = selectedAttendee && a.id === selectedAttendee.id
                const person = a.lead || a.contact
                const personName = a.lead ? `${a.lead.firstName} ${a.lead.lastName}` : a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : "Unknown"
                const company = a.lead?.company || a.contact?.account?.name || ""
                const followUpCount = a._count?.followUps || 0
                const needsFollowUp = a.status === "ATTENDED" && followUpCount === 0

                return (
                  <div
                    key={a.id}
                    className={`${styles.attendeeCard} ${isSelected ? styles.attendeeCardSelected : ""}`}
                    onClick={() => {
                      setSelectedAttendeeId(a.id)
                    }}
                  >
                    <div className={styles.cardMain}>
                      <Avatar name={personName} size={34} />
                      <div className={styles.cardInfo}>
                        <div className={styles.cardNameRow}>
                          <span className={styles.cardName}>{personName}</span>
                          {needsFollowUp && <span className={styles.pendingDot} title="Attended attendee needs follow-up!">!</span>}
                        </div>
                        {company ? (
                          <span className={styles.cardCompany}>{company}</span>
                        ) : person?.email ? (
                          <span className={styles.cardEmail}>{person.email}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.cardMetaRow}>
                      <span className={`${styles.statusBadge} ${styles[`status_${a.status}`]}`}>
                        ● {STATUS_LABEL[a.status] || a.status}
                      </span>
                      <span className={styles.cardLogCount}>
                        {followUpCount > 0 ? `${followUpCount} logs` : "0 logs"}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DEDICATED FOLLOW-UP WORKSPACE FOR SELECTED ATTENDEE */}
        <div className={styles.rightColumn}>
          {selectedAttendee ? (
            <div className={styles.detailWorkspace}>
              
              {/* Detail Profile Header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailIdentity}>
                  <Avatar name={selectedPersonName} size={42} />
                  <div className={styles.detailInfo}>
                    <div className={styles.detailNameRow}>
                      <h4 className={styles.detailName}>{selectedPersonName}</h4>
                      {selectedCompany && <span className={styles.detailCompanyTag}>{selectedCompany}</span>}
                    </div>
                    <div className={styles.detailContactRow}>
                      {selectedPerson?.email && <span className={styles.detailContactItem}><MdOutlineMail size={13} /> {selectedPerson.email}</span>}
                      {selectedPerson?.phone && <span className={styles.detailContactItem}><MdOutlineCall size={13} /> {selectedPerson.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className={styles.detailActions}>
                  <select
                    className={`${styles.statusSelectPill} ${styles[`status_${selectedAttendee.status}`]}`}
                    value={selectedAttendee.status}
                    disabled={!canEdit}
                    onChange={(e) => setStatus(selectedAttendee, e.target.value)}
                  >
                    <option value="INVITED">● Invited</option>
                    <option value="ATTENDED">● Attended</option>
                    <option value="NO_SHOW">● No-show</option>
                  </select>

                  {canEdit && (
                    <button
                      type="button"
                      className={styles.removeAttendeeBtn}
                      onClick={() => removeAttendee(selectedAttendee)}
                      title="Remove attendee from event"
                    >
                      <MdOutlineDeleteOutline size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Workspace Mode Tabs */}
              <div className={styles.workspaceTabs}>
                <button
                  type="button"
                  className={`${styles.workspaceTabBtn} ${activeTab === "activity" ? styles.workspaceTabBtnActive : ""}`}
                  onClick={() => setActiveTab("activity")}
                >
                  <MdOutlineChatBubbleOutline size={15} /> Activity Timeline & Follow-ups
                  <span className={styles.workspaceTabBadge}>{selectedAttendee._count?.followUps || 0}</span>
                </button>

                {selectedPerson?.email && canEmail && (
                  <button
                    type="button"
                    className={`${styles.workspaceTabBtn} ${activeTab === "email" ? styles.workspaceTabBtnActive : ""}`}
                    onClick={() => {
                      setActiveTab("email")
                      openEmail(selectedAttendee)
                    }}
                  >
                    <MdOutlineMail size={15} /> Send Follow-up Email
                  </button>
                )}
              </div>

              {/* TAB 1: FOLLOW-UP ACTIVITY TIMELINE & COMPOSER */}
              {activeTab === "activity" && (
                <div className={styles.activityContent}>
                  <AttendeeFollowUps
                    eventId={eventId}
                    attendee={selectedAttendee}
                    onLogged={reload}
                    canEdit={canEdit}
                  />
                </div>
              )}

              {/* TAB 2: SPATIOUS EMAIL COMPOSER */}
              {activeTab === "email" && (
                <div className={styles.emailWorkspaceCard}>
                  <div className={styles.emailCardHeader}>
                    <h5><MdOutlineMail size={16} /> Compose Email to {selectedPersonName}</h5>
                    <span className={styles.emailRecipient}>{selectedPerson?.email}</span>
                  </div>

                  <AsyncSelect
                    fetchOptions={fetchEmailTemplateOptions}
                    value={emailTemplateId}
                    selectedLabel={activeEmailTemplate?.name || ""}
                    onChange={(opt) => applyEmailTemplate(selectedAttendee, opt ? opt.raw : null)}
                    placeholder="Choose an email template (optional)…"
                  />
                  <input placeholder="Email Subject line" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
                  <textarea placeholder="Write your email body message…" rows={6} value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} />
                  <TemplateMissingFields tags={missingEmailTags} values={emailManualValues} onChange={(tag, value) => updateEmailManualValue(selectedAttendee, tag, value)} />
                  <div className={styles.emailFormActions}>
                    <button type="button" className={styles.emailCancelBtn} onClick={() => setActiveTab("activity")}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.emailSendBtn}
                      disabled={emailSending || !emailForm.subject || !emailForm.body}
                      onClick={() => sendEmail(selectedAttendee)}
                    >
                      <MdOutlineMail size={15} />
                      {emailSending ? "Sending…" : "Send Email"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className={styles.noSelectionEmpty}>
              <MdOutlineChatBubbleOutline size={44} className={styles.emptyIcon} />
              <h4>No Attendee Selected</h4>
              <p>Select an attendee from the list on the left to review their interaction timeline, log call notes, or send follow-up emails.</p>
            </div>
          )}
        </div>

      </div>

      {/* ADD ATTENDEE MODAL */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4><MdPersonAdd size={18} /> Add Event Attendee</h4>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setIsAddModalOpen(false)}>
                <MdClose size={18} />
              </button>
            </div>

            <div className={styles.modalTabs}>
              <button
                type="button"
                className={`${styles.modalTabBtn} ${addModalTab === "EXISTING" ? styles.modalTabBtnActive : ""}`}
                onClick={() => setAddModalTab("EXISTING")}
              >
                Invite Existing Lead / Contact
              </button>
              <button
                type="button"
                className={`${styles.modalTabBtn} ${addModalTab === "NEW" ? styles.modalTabBtnActive : ""}`}
                onClick={() => setAddModalTab("NEW")}
              >
                Create New Walk-in Lead
              </button>
            </div>

            {addModalTab === "EXISTING" ? (
              <div className={styles.modalBody}>
                <div className={styles.modalFieldGroup}>
                  <label>Select Lead from CRM</label>
                  {availableLeads.length > 0 ? (
                    <SearchableSelect
                      options={availableLeads.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}${l.company ? ` — ${l.company}` : ""}${l.email ? ` (${l.email})` : ""}` }))}
                      value={addingLeadId}
                      onChange={(v) => setAddingLeadId(v)}
                      labelKey="name"
                      valueKey="id"
                      placeholder="Search leads by name, email or company…"
                    />
                  ) : (
                    <p className={styles.emptyList}>All captured leads are already in this event roster.</p>
                  )}
                </div>

                <div className={styles.modalFieldGroup}>
                  <label>Initial Attendance Status</label>
                  <select
                    className={styles.modalSelect}
                    value={addModalStatus}
                    onChange={(e) => setAddModalStatus(e.target.value)}
                  >
                    <option value="ATTENDED">Attended (Checked-in)</option>
                    <option value="INVITED">Invited (Roster)</option>
                    <option value="NO_SHOW">No-show</option>
                  </select>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    className={styles.addBtn}
                    disabled={!addingLeadId}
                    onClick={async () => {
                      if (!addingLeadId) return
                      try {
                        await api.post(`/events/${eventId}/attendees`, { leadId: addingLeadId, status: addModalStatus })
                        setAddingLeadId("")
                        setIsAddModalOpen(false)
                        await reload()
                      } catch (err) {
                        alert(err.message)
                      }
                    }}
                  >
                    Add to Event
                  </button>
                </div>
              </div>
            ) : (
              <form className={styles.modalBody} onSubmit={async (e) => {
                e.preventDefault()
                setNewLeadError("")
                if (!newLead.firstName.trim() || !newLead.lastName.trim()) return setNewLeadError("First and last name are required")
                try {
                  const lead = await api.post("/leads", { ...newLead, eventId, source: "Event" })
                  await api.post(`/events/${eventId}/attendees`, { leadId: lead.id, status: addModalStatus })
                  setNewLead(EMPTY_LEAD)
                  setIsAddModalOpen(false)
                  await reload()
                  onLeadCreated?.()
                } catch (err) {
                  setNewLeadError(err.message)
                }
              }}>
                <div className={styles.modalGrid}>
                  <div className={styles.modalFieldGroup}>
                    <label>First Name *</label>
                    <input className={styles.modalInput} placeholder="e.g. Rahul" value={newLead.firstName} onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })} required />
                  </div>
                  <div className={styles.modalFieldGroup}>
                    <label>Last Name *</label>
                    <input className={styles.modalInput} placeholder="e.g. Sharma" value={newLead.lastName} onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })} required />
                  </div>
                  <div className={styles.modalGridFull}>
                    <div className={styles.modalFieldGroup}>
                      <label>Company / Organization</label>
                      <input className={styles.modalInput} placeholder="e.g. Acme Corp" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.modalFieldGroup}>
                    <label>Email Address</label>
                    <input className={styles.modalInput} type="email" placeholder="rahul@example.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
                  </div>
                  <div className={styles.modalFieldGroup}>
                    <label>Phone Number</label>
                    <input className={styles.modalInput} placeholder="+91 9876543210" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
                  </div>
                  <div className={styles.modalGridFull}>
                    <div className={styles.modalFieldGroup}>
                      <label>Attendance Status</label>
                      <select
                        className={styles.modalSelect}
                        value={addModalStatus}
                        onChange={(e) => setAddModalStatus(e.target.value)}
                      >
                        <option value="ATTENDED">Attended (Checked-in)</option>
                        <option value="INVITED">Invited (Roster)</option>
                        <option value="NO_SHOW">No-show</option>
                      </select>
                    </div>
                  </div>
                </div>

                {newLeadError && <p className={styles.modalError}>{newLeadError}</p>}

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className={styles.addBtn}>Create & Add Attendee</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Repeatable follow-up log for one attendee — separate from their INVITED/ATTENDED/NO_SHOW
// status entirely. You can log as many follow-ups as actually happened (call, email, event
// nudge…), each with a text note and/or a voice recording, same pattern as Task Discussion.
function AttendeeFollowUps({ eventId, attendee, onLogged, canEdit }) {
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState("")
  const [selectedType, setSelectedType] = useState("NOTE")
  const [logFilter, setLogFilter] = useState("ALL")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartRef = useRef(0)

  const baseUrl = `/events/${eventId}/attendees/${attendee.id}/follow-ups`

  useEffect(() => {
    setLoading(true)
    api.get(baseUrl).then(setFollowUps).catch(console.error).finally(() => setLoading(false))
  }, [attendee.id])

  async function post(e) {
    e.preventDefault()
    if (!notes.trim()) return
    setPosting(true)
    const formattedNotes = `[${selectedType}] ${notes.trim()}`
    try {
      const followUp = await api.post(baseUrl, { notes: formattedNotes })
      setFollowUps((prev) => [...prev, followUp])
      setNotes("")
      onLogged?.()
    } catch (err) {
      alert(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function remove(followUpId) {
    if (!confirm("Delete this follow-up entry?")) return
    try {
      await api.delete(`${baseUrl}/${followUpId}`)
      setFollowUps((prev) => prev.filter((f) => f.id !== followUpId))
      onLogged?.()
    } catch (err) {
      alert(err.message)
    }
  }

  async function startRecording() {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      const supportedType = preferredTypes.find((t) => MediaRecorder.isTypeSupported?.(t))
      const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream)
      recordChunksRef.current = []
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) recordChunksRef.current.push(ev.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(recordTimerRef.current)
        const actualType = recorder.mimeType || "audio/webm"
        const ext = actualType.includes("mp4") ? "m4a" : actualType.includes("ogg") ? "ogg" : "webm"
        const durationMs = Date.now() - recordStartRef.current
        let blob = new Blob(recordChunksRef.current, { type: actualType })
        if (actualType.includes("webm") && durationMs > 0) {
          try {
            blob = await fixWebmDuration(blob, durationMs, { logger: false })
          } catch (err) {
            console.error("fixWebmDuration failed, uploading unpatched blob:", err)
          }
        }
        const file = new File([blob], `follow-up-${Date.now()}.${ext}`, { type: actualType })
        try {
          const followUp = await api.upload(`${baseUrl}/voice-note`, file, { notes: `[VOICE] Recording` })
          setFollowUps((prev) => [...prev, followUp])
          setNotes("")
          onLogged?.()
        } catch (err) {
          setError(err.message)
        }
      }
      mediaRecorderRef.current = recorder
      recordStartRef.current = Date.now()
      recorder.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch (err) {
      setError("Microphone access denied or unavailable.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const filteredLogs = followUps.filter((f) => {
    if (logFilter === "ALL") return true
    const parsed = parseFollowUpNote(f.notes, f.voiceNoteStorageKey)
    return parsed.type === logFilter
  })

  return (
    <div className={styles.followUpsSection}>
      <div className={styles.logHeaderRow}>
        <span className={styles.logHeaderTitle}>
          Activity Timeline ({followUps.length})
        </span>

        {followUps.length > 0 && (
          <div className={styles.logFilterPills}>
            {["ALL", "NOTE", "CALL", "MEETING", "EMAIL", "VOICE"].map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.logFilterPill} ${logFilter === t ? styles.logFilterPillActive : ""}`}
                onClick={() => setLogFilter(t)}
              >
                {t === "ALL" ? "All" : LOG_TYPE_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className={styles.followUpsEmpty}>Loading activity timeline…</p>
      ) : filteredLogs.length === 0 ? (
        <p className={styles.followUpsEmpty}>
          {logFilter === "ALL" ? "No follow-up activity logged yet." : `No ${LOG_TYPE_CONFIG[logFilter]?.label || logFilter} logs found.`}
        </p>
      ) : (
        <div className={styles.followUpsListScroll}>
          {filteredLogs.map((f) => {
            const href = f.voiceNoteStorageKey ? fileUrl(`${baseUrl}/${f.id}/voice-note/file`) : null
            const parsed = parseFollowUpNote(f.notes, f.voiceNoteStorageKey)
            const typeConfig = LOG_TYPE_CONFIG[parsed.type] || LOG_TYPE_CONFIG.NOTE
            const IconComp = typeConfig.icon

            return (
              <div key={f.id} className={styles.followUpItem}>
                <div className={styles.followUpIconCol}>
                  <div className={`${styles.logTypeBadgeIcon} ${styles[`logTypeIcon_${parsed.type}`]}`}>
                    <IconComp size={12} />
                  </div>
                </div>

                <div className={styles.followUpBody}>
                  <div className={styles.followUpMeta}>
                    <div className={styles.followUpAuthorWrap}>
                      <Avatar name={f.author?.name} color={f.author?.color} size={18} />
                      <strong className={styles.authorName}>{f.author?.name}</strong>
                      <span className={styles.logTypeTag}>{typeConfig.label}</span>
                    </div>
                    <div className={styles.followUpRightMeta}>
                      <span className={styles.logTime}>{formatDate(f.createdAt)}</span>
                      {canEdit && (
                        <button type="button" className={styles.followUpRemove} onClick={() => remove(f.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {parsed.text && <p className={styles.followUpNotes}>{parsed.text}</p>}

                  {href && (
                    <audio
                      controls
                      preload="metadata"
                      src={href}
                      className={styles.followUpAudio}
                      onLoadedMetadata={(ev) => fixAudioDuration(ev.currentTarget)}
                      onDurationChange={(ev) => fixAudioDuration(ev.currentTarget)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canEdit && (
        <form className={styles.followUpFormBox} onSubmit={post}>
          <div className={styles.typeSelectorRow}>
            <span className={styles.typeLabel}>Log Type:</span>
            {["NOTE", "CALL", "MEETING", "EMAIL"].map((t) => {
              const cfg = LOG_TYPE_CONFIG[t]
              const Icon = cfg.icon
              return (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeSelectBtn} ${selectedType === t ? styles.typeSelectBtnActive : ""}`}
                  onClick={() => setSelectedType(t)}
                >
                  <Icon size={12} /> {cfg.label}
                </button>
              )
            })}
          </div>

          <div className={styles.followUpInputRow}>
            <input
              type="text"
              className={styles.followUpInput}
              placeholder={
                selectedType === "NOTE"
                  ? "Log a quick note…"
                  : selectedType === "EMAIL"
                  ? "Log an email summary…"
                  : selectedType === "CALL"
                  ? "Log a call summary…"
                  : "Log a meeting note…"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button type="submit" className={styles.addNoteBtn} disabled={posting || !notes.trim()}>
              {posting ? "Saving…" : "Save Log"}
            </button>
            {recording ? (
              <button type="button" className={styles.recordingBtn} onClick={stopRecording}>
                <MdMic size={14} /> {recordSeconds}s
              </button>
            ) : (
              <button type="button" className={styles.micBtn} onClick={startRecording} title="Record voice note">
                <MdMic size={15} />
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p className={styles.formError}>{error}</p>}
    </div>
  )
}