import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  MdAttachFile, MdOutlineFileUpload, MdMic, MdOutlineCall, MdOutlineMail, MdOutlineEvent,
  MdOutlineStickyNote2, MdOutlineEdit, MdClose, MdOutlineInfo, MdOutlineForum,
  MdOutlineFlag, MdOutlineCalendarToday, MdOutlineCategory, MdOutlineTimeline,
  MdOutlineLink, MdOutlinePersonOutline, MdOutlineWarningAmber,
} from "react-icons/md"
import fixWebmDuration from "fix-webm-duration"
import SliderDialog from "./SliderDialog.jsx"
import modalStyles from "./Modal.module.css"
import CustomFieldsSection from "./CustomFieldsSection.jsx"
import SearchableSelect from "./SearchableSelect.jsx"
import AsyncSelect from "./AsyncSelect.jsx"
import Avatar from "./Avatar.jsx"
import { api, fileUrl } from "../../api/client.js"
import { formatDate } from "../../lib/format.js"
import { useAuth } from "../../context/AuthContext.jsx"
// Reuses the Tasks page's stylesheet (comments/attachments/tab markup was
// authored there) rather than duplicating those classes into a second file.
import styles from "../../pages/Tasks/Tasks.module.css"
import taskDetailStyles from "./TaskDetailModal.module.css"

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

async function fetchLeadOptions(term) {
  const res = await api.get(`/leads?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((l) => ({ value: l.id, label: `${l.firstName} ${l.lastName}${l.company ? ` — ${l.company}` : ""}` }))
}

async function fetchDealOptions(term) {
  const res = await api.get(`/deals?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((d) => ({ value: d.id, label: d.name }))
}

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

const TYPE_OPTIONS = [
  { id: "TASK", name: "Task" },
  { id: "CALL", name: "Call" },
  { id: "EMAIL", name: "Email" },
  { id: "MEETING", name: "Meeting" },
]
const PRIORITY_OPTIONS = [
  { id: "LOW", name: "Low" },
  { id: "MEDIUM", name: "Medium" },
  { id: "HIGH", name: "High" },
  { id: "CRITICAL", name: "Critical" },
]
const RELATED_TYPE_LABEL = { LEAD: "Lead", DEAL: "Deal", ACCOUNT: "Account" }

function ReadRow({ label, icon: Icon, children, empty = "—" }) {
  // `||` (not `??`) so an empty string — the common case for an unset
  // Contact/Note/Related-to — falls back to the placeholder too, not just
  // null/undefined.
  return (
    <div className={taskDetailStyles.readRow}>
      <label>{Icon && <Icon size={13} />} {label}</label>
      <div className={styles.taskDetailReadValue}>{children || <span className={styles.taskDetailReadEmpty}>{empty}</span>}</div>
    </div>
  )
}

const TAB_ICONS = { details: MdOutlineInfo, discussion: MdOutlineForum, attachments: MdAttachFile }

const RELATED_TYPE_ICON = { LEAD: MdOutlinePersonOutline, DEAL: MdOutlineLink, ACCOUNT: MdOutlineCategory }

function dueMeta(dueDate) {
  if (!dueDate) return null
  // dueDate is a date-only string ("YYYY-MM-DD"). `new Date(dueDate)` parses
  // that as UTC midnight, which — once re-snapped to *local* midnight below —
  // lands a day early for anyone behind UTC. Read the calendar components
  // directly instead of round-tripping through UTC parsing.
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number)
  const due = new Date(y, m - 1, d)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due - today) / 86400000)
  if (diffDays < 0) return { label: `${formatDate(dueDate)} — overdue`, overdue: true }
  if (diffDays === 0) return { label: `${formatDate(dueDate)} — today`, soon: true }
  if (diffDays === 1) return { label: `${formatDate(dueDate)} — tomorrow`, soon: true }
  return { label: formatDate(dueDate), overdue: false, soon: false }
}

// Full task create/edit view, shared by the Tasks page and the Team page
// (reviewing/assigning a direct report's tasks) so both open the exact same
// detail experience instead of drifting into two different task forms.
// Layout: primary content (title/description/labels/custom fields) on the
// left, a persistent metadata sidebar (status/priority/due date/relations)
// on the right — so opening a task shows everything at a glance instead of
// one long column that needs scrolling to find a single field.
export default function TaskDetailModal({ modalOpen, setModalOpen, editingId, editOnly, onEditOnly, form, setForm, users, user, milestones, statuses, labels, relatedLabel, setRelatedLabel, contactLabel, setContactLabel, customFieldDefs, error, submitting, handleSubmit }) {
  const { hasPermission } = useAuth()
  const canSave = editingId ? hasPermission("tasks.edit") : hasPermission("tasks.create")
  const [activeTab, setActiveTab] = useState("details")
  // Discussion/Attachments are part of the task, not of editing it — only
  // show those tabs when the task was opened to be viewed, not when opened
  // through an explicit "Edit" action.
  const showTabs = editingId && !editOnly

  function toggleLabel(labelId) {
    const current = form.labelIds || []
    const next = current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    setForm({ ...form, labelIds: next })
  }

  useEffect(() => {
    if (modalOpen) setActiveTab("details")
  }, [modalOpen, editingId])

  return (
    <SliderDialog
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editingId ? (form.title || "Task detail") : "New task"}
      subtitle={editingId ? (editOnly ? "Edit task details and workflow" : "Review task parameters") : "Define action item, timeline, and CRM relations"}
      width="min(46rem, 100vw)"
      footer={
        !editingId || editOnly ? (
          <div className={styles.taskDetailFooterActions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            {canSave && (
              <button type="submit" form="task-detail-form" className={modalStyles.submitBtn} disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save changes" : "Create task"}
              </button>
            )}
          </div>
        ) : canSave ? (
          <div className={styles.taskDetailFooterActions}>
            <button type="button" className={modalStyles.submitBtn} onClick={onEditOnly}>
              <MdOutlineEdit size={14} /> Edit task
            </button>
          </div>
        ) : null
      }
    >
      {/* Discussion/Attachments live alongside Details as facets of the task */}
      {showTabs && (
        <div className={taskDetailStyles.modalTabsEdge}>
          {["details", "discussion", "attachments"].map((tab) => {
            const Icon = TAB_ICONS[tab]
            return (
              <button
                key={tab}
                type="button"
                className={`${styles.modalTabBtn} ${activeTab === tab ? styles.modalTabActive : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={14} />
                {tab === "discussion" ? "Discussion" : tab[0].toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <motion.span
                    layoutId="taskDetailTabIndicator"
                    className={taskDetailStyles.tabIndicator}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {(!editingId || editOnly) && (
      <form id="task-detail-form" onSubmit={handleSubmit} className={taskDetailStyles.taskForm}>
        {/* 1. Title & Description Card */}
        <div className={taskDetailStyles.formSectionCard}>
          <div className={taskDetailStyles.titleField}>
            <label>Task Title *</label>
            <input
              required
              className={taskDetailStyles.titleInput}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. Schedule product demo with stakeholders"
            />
          </div>
          <div className={taskDetailStyles.descField}>
            <label>Description</label>
            <textarea
              className={taskDetailStyles.descTextarea}
              value={form.description || ""}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Add key context, requirements, next steps..."
              rows={4}
            />
          </div>
        </div>

        {/* 2. Planning & Execution Grid Card */}
        <div className={taskDetailStyles.formSectionCard}>
          <div className={taskDetailStyles.sectionHeader}>
            <MdOutlineTimeline size={16} />
            <span>Planning & Execution</span>
          </div>
          <div className={taskDetailStyles.fieldsGrid2}>
            <div className={taskDetailStyles.fieldItem}>
              <label>Status</label>
              <SearchableSelect
                options={statuses}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                labelKey="name"
                valueKey="name"
              />
            </div>

            <div className={taskDetailStyles.fieldItem}>
              <label>Priority</label>
              <SearchableSelect
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={(v) => setForm({ ...form, priority: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>

            <div className={taskDetailStyles.fieldItem}>
              <label>Due Date *</label>
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </div>

            <div className={taskDetailStyles.fieldItem}>
              <label>Type</label>
              <SearchableSelect
                options={TYPE_OPTIONS}
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>

            {users.length > 1 && (
              <div className={taskDetailStyles.fieldItem}>
                <label>Assign to</label>
                <SearchableSelect
                  options={[
                    { label: `Me (${user.name})`, value: user.id },
                    ...users.filter((item) => item.id !== user.id && item.active).map((item) => ({
                      label: `${item.name} (${item.role?.name || "Member"})`,
                      value: item.id,
                    })),
                  ]}
                  value={form.ownerId || user.id}
                  onChange={(value) => setForm({ ...form, ownerId: value })}
                  placeholder="Select assignee"
                />
              </div>
            )}

            {milestones.length > 0 && (
              <div className={taskDetailStyles.fieldItem}>
                <label>Milestone / Release</label>
                <SearchableSelect
                  options={[{ id: "", name: "No milestone" }, ...milestones]}
                  value={form.milestoneId || ""}
                  onChange={(v) => setForm({ ...form, milestoneId: v })}
                  labelKey="name"
                  valueKey="id"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. CRM Context & Relations Card */}
        <div className={taskDetailStyles.formSectionCard}>
          <div className={taskDetailStyles.sectionHeader}>
            <MdOutlineLink size={16} />
            <span>CRM Context & Relations</span>
          </div>
          <div className={taskDetailStyles.fieldsGrid2}>
            <div className={taskDetailStyles.fieldItem}>
              <label>Related to</label>
              <SearchableSelect
                options={[
                  { id: "", name: "None" },
                  { id: "LEAD", name: "Lead" },
                  { id: "DEAL", name: "Deal" },
                  { id: "ACCOUNT", name: "Account" },
                ]}
                value={form.relatedType}
                onChange={(v) => { setForm({ ...form, relatedType: v, leadId: "", dealId: "", accountId: "" }); setRelatedLabel("") }}
                labelKey="name"
                valueKey="id"
              />
            </div>

            {form.relatedType === "LEAD" && (
              <div className={taskDetailStyles.fieldItem}>
                <label>Lead</label>
                <AsyncSelect
                  fetchOptions={fetchLeadOptions}
                  value={form.leadId}
                  selectedLabel={relatedLabel}
                  onChange={(opt) => { setForm({ ...form, leadId: opt.value }); setRelatedLabel(opt.label) }}
                  placeholder="Choose a lead…"
                />
              </div>
            )}

            {form.relatedType === "DEAL" && (
              <div className={taskDetailStyles.fieldItem}>
                <label>Deal</label>
                <AsyncSelect
                  fetchOptions={fetchDealOptions}
                  value={form.dealId}
                  selectedLabel={relatedLabel}
                  onChange={(opt) => { setForm({ ...form, dealId: opt.value }); setRelatedLabel(opt.label) }}
                  placeholder="Choose a deal…"
                />
              </div>
            )}

            {form.relatedType === "ACCOUNT" && (
              <div className={taskDetailStyles.fieldItem}>
                <label>Account</label>
                <AsyncSelect
                  fetchOptions={fetchAccountOptions}
                  value={form.accountId}
                  selectedLabel={relatedLabel}
                  onChange={(opt) => { setForm({ ...form, accountId: opt.value }); setRelatedLabel(opt.label) }}
                  placeholder="Choose an account…"
                />
              </div>
            )}

            <div className={taskDetailStyles.fieldItem}>
              <label>Contact (who this task is with)</label>
              <AsyncSelect
                fetchOptions={fetchContactOptions}
                value={form.contactId}
                selectedLabel={contactLabel}
                onChange={(opt) => { setForm({ ...form, contactId: opt.value }); setContactLabel(opt.label) }}
                placeholder="No contact"
              />
            </div>

            <div className={taskDetailStyles.fieldFullWidth}>
              <label>Note (optional)</label>
              <input
                value={form.related}
                onChange={(event) => setForm({ ...form, related: event.target.value })}
                placeholder="e.g. Fleet Suite renewal discussion"
              />
            </div>
          </div>
        </div>

        {/* 4. Labels & Attachments Card */}
        <div className={taskDetailStyles.formSectionCard}>
          <div className={taskDetailStyles.sectionHeader}>
            <MdAttachFile size={16} />
            <span>Labels & Attachments</span>
          </div>

          {labels.length > 0 && (
            <div className={taskDetailStyles.fieldItem}>
              <label>Labels</label>
              <div className={taskDetailStyles.labelsWrap}>
                {labels.map((l) => {
                  const active = (form.labelIds || []).includes(l.id)
                  return (
                    <button
                      type="button"
                      key={l.id}
                      className={taskDetailStyles.labelButton}
                      style={{
                        background: l.color,
                        color: "#ffffff",
                        opacity: active ? 1 : 0.4,
                        boxShadow: active ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${l.color}` : "none",
                        transform: active ? "scale(1.02)" : "scale(1)"
                      }}
                      onClick={() => toggleLabel(l.id)}
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <CustomFieldsSection
            fields={customFieldDefs}
            values={form.customFields}
            onChange={(fieldId, value) => setForm({ ...form, customFields: { ...form.customFields, [fieldId]: value } })}
          />

          <div className={taskDetailStyles.fieldItem} style={{ marginTop: "0.25rem" }}>
            <label>Attachments & Documents</label>
            <div className={taskDetailStyles.attachmentDropArea}>
              <input
                type="file"
                multiple
                id="task-form-file-input"
                style={{ display: "none" }}
                onChange={(e) => {
                  const selected = Array.from(e.target.files || [])
                  setForm((prev) => ({
                    ...prev,
                    pendingFiles: [...(prev.pendingFiles || []), ...selected],
                  }))
                }}
              />
              <label htmlFor="task-form-file-input" className={taskDetailStyles.dropZoneLabel}>
                <MdOutlineFileUpload size={22} style={{ color: "var(--primary)" }} />
                <span>Click to upload or drag & drop files</span>
                <span className={taskDetailStyles.dropZoneSub}>PDFs, Docs, Images, Voice notes</span>
              </label>
            </div>

            {(form.pendingFiles || []).length > 0 && (
              <div className={taskDetailStyles.pendingFilesList}>
                {(form.pendingFiles || []).map((file, idx) => (
                  <div key={idx} className={taskDetailStyles.pendingFileItem}>
                    <MdAttachFile size={14} style={{ color: "var(--primary)" }} />
                    <span className={taskDetailStyles.pendingFileName}>{file.name}</span>
                    <span className={taskDetailStyles.pendingFileSize}>
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      className={taskDetailStyles.removeFileBtn}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          pendingFiles: prev.pendingFiles.filter((_, i) => i !== idx),
                        }))
                      }}
                    >
                      <MdClose size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p className={modalStyles.error}>{error}</p>}
      </form>
      )}

      {/* Viewing an existing task is read-only — compact stacked card flow */}
      {showTabs && activeTab === "details" && (() => {
        const assignee = users.find((u) => u.id === form.ownerId) || (form.ownerId === user.id ? user : null)
        const statusMeta = statuses.find((s) => s.name === form.status)
        const due = dueMeta(form.dueDate)
        const RelatedIcon = RELATED_TYPE_ICON[form.relatedType] || MdOutlineLink
        const priorityId = form.priority
        return (
          <motion.div
            className={taskDetailStyles.readContainer}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header Card */}
            <div className={taskDetailStyles.readHeaderCard} data-priority={priorityId}>
              <h2 className={styles.taskDetailReadTitle}>{form.title}</h2>
              <div className={taskDetailStyles.readMetaChips}>
                <span className={styles.taskDetailPill} style={statusMeta?.color ? { background: `${statusMeta.color}22`, color: statusMeta.color } : undefined}>
                  <span className={taskDetailStyles.statusDot} style={{ background: statusMeta?.color || "var(--text-tertiary)" }} />
                  {form.status}
                </span>
                <span className={`${styles.taskDetailPill} ${styles[`taskDetailPriority${priorityId}`]}`}>
                  <MdOutlineFlag size={12} />
                  {PRIORITY_OPTIONS.find((p) => p.id === priorityId)?.name || priorityId}
                </span>
                {due && (
                  <span className={`${taskDetailStyles.duePill} ${due.overdue ? taskDetailStyles.dueOverdue : due.soon ? taskDetailStyles.dueSoon : ""}`}>
                    {due.overdue ? <MdOutlineWarningAmber size={12} /> : <MdOutlineCalendarToday size={12} />}
                    {due.label}
                  </span>
                )}
              </div>
            </div>

            {/* Key Attributes 2x2 Grid Card */}
            <div className={taskDetailStyles.readCardGrid}>
              <div className={taskDetailStyles.readCardItem}>
                <span className={taskDetailStyles.readCardLabel}><MdOutlineCategory size={13} /> TYPE</span>
                <span className={taskDetailStyles.readCardValue}>{TYPE_OPTIONS.find((t) => t.id === form.type)?.name || form.type}</span>
              </div>

              {users.length > 1 && (
                <div className={taskDetailStyles.readCardItem}>
                  <span className={taskDetailStyles.readCardLabel}><MdOutlinePersonOutline size={13} /> ASSIGNED TO</span>
                  <span className={taskDetailStyles.readCardValue}>
                    {assignee ? (
                      <div className={taskDetailStyles.personChip}>
                        <Avatar name={assignee.name} color={assignee.color} size={18} />
                        {assignee.name}
                      </div>
                    ) : "—"}
                  </span>
                </div>
              )}

              <div className={taskDetailStyles.readCardItem}>
                <span className={taskDetailStyles.readCardLabel}><RelatedIcon size={13} /> RELATED TO</span>
                <span className={taskDetailStyles.readCardValue}>
                  {form.relatedType ? `${RELATED_TYPE_LABEL[form.relatedType]}: ${relatedLabel}` : "—"}
                </span>
              </div>

              <div className={taskDetailStyles.readCardItem}>
                <span className={taskDetailStyles.readCardLabel}><MdOutlinePersonOutline size={13} /> CONTACT</span>
                <span className={taskDetailStyles.readCardValue}>
                  {contactLabel ? (
                    <div className={taskDetailStyles.personChip}>
                      <Avatar name={contactLabel} size={18} />
                      {contactLabel}
                    </div>
                  ) : "—"}
                </span>
              </div>

              {milestones.length > 0 && (
                <div className={taskDetailStyles.readCardItem}>
                  <span className={taskDetailStyles.readCardLabel}><MdOutlineTimeline size={13} /> MILESTONE</span>
                  <span className={taskDetailStyles.readCardValue}>
                    {milestones.find((m) => m.id === form.milestoneId)?.name || "—"}
                  </span>
                </div>
              )}

              {form.related && (
                <div className={taskDetailStyles.readCardItem}>
                  <span className={taskDetailStyles.readCardLabel}><MdOutlineStickyNote2 size={13} /> NOTE</span>
                  <span className={taskDetailStyles.readCardValue}>{form.related}</span>
                </div>
              )}
            </div>

            {/* Description Card */}
            <div className={taskDetailStyles.readDescCard}>
              <div className={taskDetailStyles.readSectionTitle}>DESCRIPTION</div>
              <p className={form.description ? styles.taskDetailReadDescription : styles.taskDetailReadEmpty}>
                {form.description || "No description provided for this task."}
              </p>
            </div>

            {/* Labels & Custom Fields Card (if any) */}
            {labels.length > 0 && (form.labelIds || []).length > 0 && (
              <div className={taskDetailStyles.readDescCard}>
                <div className={taskDetailStyles.readSectionTitle}>LABELS</div>
                <div className={styles.labelChips}>
                  {labels.filter((l) => (form.labelIds || []).includes(l.id)).map((l) => (
                    <span key={l.id} className={`${styles.labelChip} ${taskDetailStyles.labelChipFullOpacity}`} style={{ background: l.color }}>{l.name}</span>
                  ))}
                </div>
              </div>
            )}

            {customFieldDefs.length > 0 && (
              <div className={taskDetailStyles.readDescCard}>
                <div className={taskDetailStyles.readSectionTitle}>CUSTOM FIELDS</div>
                <div className={styles.taskDetailReadCustomFields}>
                  {customFieldDefs.map((f) => (
                    <div key={f.id} className={styles.taskDetailReadCustomField}>
                      <span>{f.label}</span>
                      <strong>{form.customFields?.[f.id] || "—"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )
      })()}

      {showTabs && activeTab === "attachments" && <TaskAttachments taskId={editingId} />}
      {showTabs && activeTab === "discussion" && <TaskComments taskId={editingId} currentUser={user} />}
    </SliderDialog>
  )
}

function TaskAttachments({ taskId }) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission("tasks.edit")
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: "", url: "" })
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartRef = useRef(0)

  useEffect(() => {
    setLoading(true)
    api.get(`/tasks/${taskId}/attachments`).then(setAttachments).catch(console.error).finally(() => setLoading(false))
  }, [taskId])

  async function add(e) {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.url.trim()) return
    setAdding(true)
    try {
      const attachment = await api.post(`/tasks/${taskId}/attachments`, form)
      setAttachments((prev) => [...prev, attachment])
      setForm({ name: "", url: "" })
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function uploadFile(file) {
    const attachment = await api.upload(`/tasks/${taskId}/attachments/upload`, file)
    setAttachments((prev) => [...prev, attachment])
  }

  async function handleFilePick(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return
    setError("")
    setUploading(true)
    try {
      for (const file of files) await uploadFile(file)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function startRecording() {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Let the browser pick its own supported mimeType rather than forcing "audio/webm" —
      // hardcoding a type that doesn't match what MediaRecorder actually encoded (Chrome vs
      // Firefox vs Safari all differ) mislabels the container and breaks playback/duration.
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
        // MediaRecorder-produced webm has no duration in its metadata, so most players show
        // 0:00 and some refuse to play it at all — patch the real duration into the file
        // itself (not just a client-side player hack) so it works everywhere, not just here.
        if (actualType.includes("webm") && durationMs > 0) {
          try {
            blob = await fixWebmDuration(blob, durationMs, { logger: false })
          } catch (err) {
            console.error("fixWebmDuration failed, uploading unpatched blob:", err)
          }
        }
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: actualType })
        setUploading(true)
        try {
          await uploadFile(file)
        } catch (err) {
          setError(err.message)
        } finally {
          setUploading(false)
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

  async function remove(id) {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${id}`)
      setAttachments((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className={styles.attachmentsSection}>
      <h4 className={styles.commentsTitle}>Attachments — docs, screenshots, voice notes ({attachments.length})</h4>
      {loading ? (
        <p className={styles.commentsEmpty}>Loading…</p>
      ) : attachments.length > 0 && (
        <div className={styles.attachmentsList}>
          {attachments.map((a) => {
            const href = a.storageKey ? fileUrl(`/tasks/${taskId}/attachments/${a.id}/file`) : a.url
            const isImage = a.mimeType?.startsWith("image/")
            const isAudio = a.mimeType?.startsWith("audio/")
            return (
              <div key={a.id} className={styles.attachmentRow}>
                {isImage ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={styles.attachmentPreviewLink}>
                    <img src={href} alt={a.name} className={styles.attachmentThumb} />
                    <span>{a.name}</span>
                  </a>
                ) : isAudio ? (
                  <div className={styles.attachmentAudioRow}>
                    <span className={styles.attachmentAudioLabel}>{a.name}</span>
                    <audio
                      controls
                      preload="metadata"
                      src={href}
                      className={styles.attachmentAudio}
                      onLoadedMetadata={(ev) => fixAudioDuration(ev.currentTarget)}
                      onDurationChange={(ev) => fixAudioDuration(ev.currentTarget)}
                    />
                  </div>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer"><MdAttachFile size={13} /> {a.name}</a>
                )}
                {canEdit && <button type="button" onClick={() => remove(a.id)}><MdClose size={13} /></button>}
              </div>
            )
          })}
        </div>
      )}
      {canEdit && (
        <>
          <div className={styles.attachmentActionsRow}>
            <label className={styles.uploadBtn}>
              {uploading ? "Uploading…" : <><MdOutlineFileUpload size={15} /> Upload docs / screenshots</>}
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden disabled={uploading || recording} onChange={handleFilePick} />
            </label>
            {recording ? (
              <button type="button" className={styles.recordingBtn} onClick={stopRecording}>
                <MdMic size={15} /> Stop recording · {recordSeconds}s
              </button>
            ) : (
              <button type="button" className={styles.uploadBtn} onClick={startRecording} disabled={uploading}>
                <MdMic size={15} /> Record voice note
              </button>
            )}
          </div>
          <form className={styles.attachmentForm} onSubmit={add}>
            <input placeholder="Label (e.g. Call recording, Proposal doc)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <button type="submit" className={styles.addBtn} disabled={adding || !form.name.trim() || !form.url.trim()}>
              {adding ? "Adding…" : "+ Add link"}
            </button>
          </form>
        </>
      )}
      {error && <p className={modalStyles.error}>{error}</p>}
    </div>
  )
}

// How the update happened — same vocabulary as Task.type / Activity.type
// elsewhere in the app, so "Called them" vs "Emailed them" vs "Meeting notes"
// reads consistently everywhere, not just here.
const COMMENT_TYPES = [
  { id: "CALL", label: "Call", icon: MdOutlineCall },
  { id: "EMAIL", label: "Email", icon: MdOutlineMail },
  { id: "MEETING", label: "Meeting", icon: MdOutlineEvent },
  { id: "NOTE", label: "Note", icon: MdOutlineStickyNote2 },
]
const COMMENT_TYPE_BY_ID = Object.fromEntries(COMMENT_TYPES.map((t) => [t.id, t]))

function TaskComments({ taskId, currentUser }) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission("tasks.edit")
  const [comments, setComments] = useState([])
  const [type, setType] = useState("NOTE")
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartRef = useRef(0)
  // startRecording()'s `onstop` closure is created once, at recording-start
  // time, but only actually runs later when the user clicks "Stop". If they
  // change the type picker while still recording, that closure would still
  // see the `type` value from when recording began. Track it in a ref kept
  // current on every render so `onstop` always posts the type selected at
  // the moment recording actually ends.
  const typeRef = useRef(type)
  typeRef.current = type

  useEffect(() => {
    setLoading(true)
    api.get(`/tasks/${taskId}/comments`).then(setComments).catch(console.error).finally(() => setLoading(false))
  }, [taskId])

  async function post(e) {
    e.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    try {
      const comment = await api.post(`/tasks/${taskId}/comments`, { body, type })
      setComments((prev) => [...prev, comment])
      setBody("")
    } catch (err) {
      alert(err.message)
    } finally {
      setPosting(false)
    }
  }

  // Voice notes live inside Discussion, not the separate Attachments tab, so a call recap
  // or quick update can carry audio the same way a text comment does. Flow: create an empty
  // comment first, then upload the recording tagged with that comment's id so it renders
  // inline under it rather than as a detached file.
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
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: actualType })
        try {
          const comment = await api.post(`/tasks/${taskId}/comments`, { body: "", type: typeRef.current })
          const attachment = await api.upload(`/tasks/${taskId}/attachments/upload`, file, { commentId: comment.id })
          setComments((prev) => [...prev, { ...comment, attachments: [attachment] }])
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

  const activeType = COMMENT_TYPE_BY_ID[type] || COMMENT_TYPE_BY_ID.NOTE
  const BODY_PLACEHOLDER = {
    CALL: "What did you cover on the call?",
    EMAIL: "What was sent or received?",
    MEETING: "What was discussed / decided?",
    NOTE: "What happened? e.g. Called the client, they need pricing by Friday…",
  }

  return (
    <div className={styles.commentsSection}>
      <h4 className={styles.commentsTitle}>Discussion ({comments.length})</h4>
      <p className={styles.commentsSubtitle}>Log calls, emails, meetings, and updates against this task.</p>
      <div className={styles.commentsList}>
        {loading ? (
          <p className={styles.commentsEmpty}>Loading…</p>
        ) : comments.length === 0 ? (
          <p className={styles.commentsEmpty}>No discussion yet. Log what happened on a call, email, or meeting here.</p>
        ) : (
          comments.map((c) => {
            const voiceNote = c.attachments?.find((a) => a.mimeType?.startsWith("audio/"))
            const href = voiceNote ? fileUrl(`/tasks/${taskId}/attachments/${voiceNote.id}/file`) : null
            const entryType = COMMENT_TYPE_BY_ID[c.type] || COMMENT_TYPE_BY_ID.NOTE
            const EntryIcon = entryType.icon
            return (
              <div key={c.id} className={styles.commentRow}>
                <Avatar name={c.author?.name} color={c.author?.color} size={22} />
                <div className={styles.commentBody}>
                  <div className={styles.commentMeta}>
                    <strong>{c.author?.name}</strong>
                    <span className={`${styles.commentTypeBadge} ${styles[`commentType${entryType.id}`]}`}>
                      <EntryIcon size={11} /> {entryType.label}
                    </span>
                    <span className={styles.commentDate}>{formatDate(c.createdAt)}</span>
                  </div>
                  {c.body && <p>{c.body}</p>}
                  {voiceNote && (
                    <div className={styles.attachmentAudioRow}>
                      <span className={styles.attachmentAudioLabel}><MdMic size={13} /> Voice note</span>
                      <audio
                        controls
                        preload="metadata"
                        src={href}
                        className={styles.attachmentAudio}
                        onLoadedMetadata={(ev) => fixAudioDuration(ev.currentTarget)}
                        onDurationChange={(ev) => fixAudioDuration(ev.currentTarget)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      {canEdit && (
        <form className={styles.commentForm} onSubmit={post}>
          <div className={styles.commentTypePicker}>
            {COMMENT_TYPES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.commentTypeBtn} ${type === t.id ? styles.commentTypeBtnActive : ""}`}
                  onClick={() => setType(t.id)}
                  aria-pressed={type === t.id}
                >
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </div>
          <textarea
            rows={2}
            placeholder={BODY_PLACEHOLDER[activeType.id]}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className={styles.attachmentActionsRow}>
            <button type="submit" className={styles.addBtn} disabled={posting || !body.trim()}>
              {posting ? "Posting…" : `Post as ${activeType.label}`}
            </button>
            {recording ? (
              <button type="button" className={styles.recordingBtn} onClick={stopRecording}>
                <MdMic size={15} /> Stop recording · {recordSeconds}s
              </button>
            ) : (
              <button type="button" className={styles.uploadBtn} onClick={startRecording}>
                <MdMic size={15} /> Record voice note
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p className={modalStyles.error}>{error}</p>}
    </div>
  )
}
