import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { MdClose } from "react-icons/md"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import styles from "./Settings.module.css"
import taskBoardsStyles from "./TaskBoards.module.css"

const TABS = [
  { id: "statuses", label: "Statuses" },
  { id: "milestones", label: "Milestones" },
  { id: "labels", label: "Labels" },
]

export default function TaskBoards() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("taskBoards.manage")
  const [tab, setTab] = useState("statuses")

  return (
    <>
      <Topbar title="Task Boards" subtitle="Configure statuses, milestones and labels for the task tracker" />
      <div className={styles.page}>
        <div className={styles.tabRow}>
          {TABS.map((t) => (
            <button key={t.id} className={`${styles.tabBtn} ${tab === t.id ? styles.active : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "statuses" && <StatusesPanel canManage={canManage} />}
        {tab === "milestones" && <MilestonesPanel canManage={canManage} />}
        {tab === "labels" && <LabelsPanel canManage={canManage} />}
      </div>
    </>
  )
}

function StatusesPanel({ canManage }) {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState("")

  async function reload() {
    try {
      setStatuses(await api.get("/task-statuses"))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  async function addStatus() {
    const name = draft.trim()
    if (!name) return
    try {
      await api.post("/task-statuses", { name })
      setDraft("")
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function saveRename(status) {
    const name = renameValue.trim()
    if (!name || name === status.name) { setRenaming(null); return }
    try {
      await api.patch(`/task-statuses/${status.id}`, { name })
      setRenaming(null)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function deleteStatus(status) {
    if (!confirm(`Delete status "${status.name}"? It must have no tasks in it.`)) return
    try {
      await api.delete(`/task-statuses/${status.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className={styles.emptyState}>Loading statuses…</p>

  return (
    <>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h4 className={styles.sectionHeaderTitle}>Task statuses</h4>
          <p className={styles.sectionHeaderSub}>These are the columns tasks move through on the board — rename, reorder, add or remove them.</p>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <div className={styles.chipList}>
          {statuses.map((s) => (
            <span key={s.id} className={styles.chip}>
              {renaming === s.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveRename(s) } if (e.key === "Escape") setRenaming(null) }}
                  onBlur={() => saveRename(s)}
                  className={`${modalStyles.field} ${taskBoardsStyles.renameInput}`}
                />
              ) : (
                <span onDoubleClick={() => canManage && (setRenaming(s.id), setRenameValue(s.name))}>{s.name}</span>
              )}
              {canManage && renaming !== s.id && (
                <button className={styles.chipRemoveBtn} onClick={() => deleteStatus(s)} aria-label={`Remove status ${s.name}`}><MdClose size={13} /></button>
              )}
            </span>
          ))}
          {statuses.length === 0 && <p className={styles.emptyState}>No statuses yet.</p>}
        </div>
        {canManage && (
          <div className={styles.columnAddRow}>
            <input
              placeholder="New status name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStatus() } }}
              className={modalStyles.field}
            />
            <button className={styles.rowActionBtn} onClick={addStatus}>Add Status</button>
          </div>
        )}
      </div>
    </>
  )
}

function MilestonesPanel({ canManage }) {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: "", targetDate: "", status: "OPEN" })
  const [error, setError] = useState("")

  async function reload() {
    try {
      setMilestones(await api.get("/milestones"))
    } catch (err) {
      console.error(err)
    }
  }
  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  function openNew() {
    setEditing("new")
    setForm({ name: "", targetDate: "", status: "OPEN" })
    setError("")
  }
  function openEdit(m) {
    setEditing(m)
    setForm({ name: m.name, targetDate: m.targetDate ? m.targetDate.slice(0, 10) : "", status: m.status })
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    try {
      const payload = { name: form.name, status: form.status, targetDate: form.targetDate || null }
      if (editing === "new") await api.post("/milestones", payload)
      else await api.patch(`/milestones/${editing.id}`, payload)
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(m) {
    if (!confirm(`Delete milestone "${m.name}"? Tasks will be unassigned from it.`)) return
    try {
      await api.delete(`/milestones/${m.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className={styles.emptyState}>Loading milestones…</p>

  return (
    <>
      {canManage && (
        <div className={styles.actionsRowSpaced}>
          <motion.button className={styles.addBtn} whileTap={{ scale: 0.96 }} onClick={openNew}>+ New Milestone</motion.button>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Name</th><th>Target</th><th>Status</th><th>Tasks</th>{canManage && <th></th>}</tr>
          </thead>
          <tbody>
            {milestones.length === 0 ? (
              <tr><td colSpan={5} className={styles.emptyState}><EmptyState type="generic" title="No milestones (releases) yet" compact /></td></tr>
            ) : (
              milestones.map((m) => (
                <tr key={m.id}>
                  <td className={styles.tdStrong}>{m.name}</td>
                  <td className={styles.dateCell}>{m.targetDate ? formatDate(m.targetDate) : "—"}</td>
                  <td>{m.status}</td>
                  <td>{m._count?.tasks ?? 0}</td>
                  {canManage && (
                    <td>
                      <div className={styles.actionsRow}>
                        <button className={styles.rowActionBtn} onClick={() => openEdit(m)}>Edit</button>
                        <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(m)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New Milestone" : "Edit Milestone"}>
        <form onSubmit={handleSave} className={modalStyles.body}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. v1.2 Release" />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Target date</label>
              <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Status</label>
              <SearchableSelect
                options={[
                  { id: "OPEN", name: "Open" },
                  { id: "CLOSED", name: "Closed" },
                ]}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn}>Save</button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function LabelsPanel({ canManage }) {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: "", color: "#6366f1" })
  const [error, setError] = useState("")

  async function reload() {
    try {
      setLabels(await api.get("/labels"))
    } catch (err) {
      console.error(err)
    }
  }
  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  function openNew() {
    setEditing("new")
    setForm({ name: "", color: "#6366f1" })
    setError("")
  }
  function openEdit(l) {
    setEditing(l)
    setForm({ name: l.name, color: l.color })
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    try {
      if (editing === "new") await api.post("/labels", form)
      else await api.patch(`/labels/${editing.id}`, form)
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(l) {
    if (!confirm(`Delete label "${l.name}"?`)) return
    try {
      await api.delete(`/labels/${l.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className={styles.emptyState}>Loading labels…</p>

  return (
    <>
      {canManage && (
        <div className={styles.actionsRowSpaced}>
          <motion.button className={styles.addBtn} whileTap={{ scale: 0.96 }} onClick={openNew}>+ New Label</motion.button>
        </div>
      )}
      <div className={styles.chipList}>
        {labels.length === 0 ? (
          <p className={styles.emptyState}>No labels yet.</p>
        ) : (
          labels.map((l) => (
            <span key={l.id} className={styles.chip}>
              <span className={styles.colorSwatch} style={{ background: l.color }} />
              {l.name}
              {canManage && (
                <>
                  <button className={styles.rowActionBtn} onClick={() => openEdit(l)}>Edit</button>
                  <button className={styles.chipRemoveBtn} onClick={() => handleDelete(l)} aria-label={`Remove label ${l.name}`}><MdClose size={13} /></button>
                </>
              )}
            </span>
          ))
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New Label" : "Edit Label"}>
        <form onSubmit={handleSave} className={modalStyles.body}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. bug, urgent" />
          </div>
          <div className={modalStyles.field}>
            <label>Color</label>
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn}>Save</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
