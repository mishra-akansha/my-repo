import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"

const TRIGGER_OPTIONS = [
  { value: "LEAD_CREATED", label: "Lead created" },
  { value: "DEAL_STAGE_CHANGED", label: "Deal stage changed" },
]
const OPERATOR_OPTIONS = ["EQUALS", "CONTAINS", "GT", "LT"]
const ACTION_OPTIONS = [
  { value: "ASSIGN_OWNER", label: "Assign owner" },
  { value: "UPDATE_PRIORITY", label: "Update priority (leads only)" },
  { value: "CREATE_TASK", label: "Create a follow-up task" },
  { value: "SEND_EMAIL", label: "Send an email" },
]
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const EMPTY_FORM = {
  name: "",
  trigger: "LEAD_CREATED",
  useCondition: false,
  conditionField: "source",
  conditionOperator: "EQUALS",
  conditionValue: "",
  actionType: "CREATE_TASK",
  actionOwnerId: "",
  actionPriority: "HIGH",
  actionTaskTitle: "",
  actionTaskDueInDays: 1,
  actionEmailSubject: "",
  actionEmailBody: "",
}

function ruleToForm(rule) {
  const condition = rule.conditions[0]
  const action = rule.actions[0] || {}
  return {
    name: rule.name,
    trigger: rule.trigger,
    useCondition: !!condition,
    conditionField: condition?.field || "source",
    conditionOperator: condition?.operator || "EQUALS",
    conditionValue: condition?.value || "",
    actionType: action.type || "CREATE_TASK",
    actionOwnerId: action.params?.ownerId || "",
    actionPriority: action.params?.priority || "HIGH",
    actionTaskTitle: action.params?.title || "",
    actionTaskDueInDays: action.params?.dueInDays ?? 1,
    actionEmailSubject: action.params?.subject || "",
    actionEmailBody: action.params?.body || "",
  }
}

function formToPayload(form) {
  const conditions = form.useCondition && form.conditionValue
    ? [{ field: form.conditionField, operator: form.conditionOperator, value: form.conditionValue }]
    : []

  let params = {}
  if (form.actionType === "ASSIGN_OWNER") params = { ownerId: form.actionOwnerId }
  if (form.actionType === "UPDATE_PRIORITY") params = { priority: form.actionPriority }
  if (form.actionType === "CREATE_TASK") params = { title: form.actionTaskTitle || undefined, dueInDays: Number(form.actionTaskDueInDays) || 1 }
  if (form.actionType === "SEND_EMAIL") params = { subject: form.actionEmailSubject, body: form.actionEmailBody }

  return {
    name: form.name,
    trigger: form.trigger,
    conditions,
    actions: [{ type: form.actionType, params }],
  }
}

export default function Automations() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [rules, setRules] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function reload() {
    try {
      const [ruleList, userList] = await Promise.all([api.get("/automations"), api.get("/users")])
      setRules(ruleList)
      setUsers(userList)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing("new")
    setForm(EMPTY_FORM)
    setError("")
  }

  function openEdit(rule) {
    setEditing(rule)
    setForm(ruleToForm(rule))
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = formToPayload(form)
      if (editing === "new") {
        await api.post("/automations", payload)
      } else {
        await api.patch(`/automations/${editing.id}`, payload)
      }
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(rule) {
    try {
      await api.patch(`/automations/${rule.id}`, { active: !rule.active })
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(rule) {
    if (!confirm(`Delete automation "${rule.name}"?`)) return
    try {
      await api.delete(`/automations/${rule.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Automations"
        subtitle={loading ? "Loading…" : `${rules.length} rule${rules.length !== 1 ? "s" : ""} — runs automatically when the trigger fires`}
        action={
          canManage && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + Add Automation
            </motion.button>
          )
        }
      />
      <div className={styles.page}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Action</th>
                <th>Active</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyState}>Loading automations…</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={5} className={styles.emptyState}><EmptyState type="generic" title="No automations yet" hint="Add one to auto-assign, prioritize, or follow up on new leads/deals." compact /></td></tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className={styles.tdStrong}>{rule.name}</td>
                    <td>{TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.label || rule.trigger}</td>
                    <td>{ACTION_OPTIONS.find((a) => a.value === rule.actions[0]?.type)?.label || "—"}</td>
                    <td>
                      {canManage ? (
                        <button className={styles.rowActionBtn} onClick={() => toggleActive(rule)}>
                          {rule.active ? "Active" : "Paused"}
                        </button>
                      ) : (rule.active ? "Active" : "Paused")}
                    </td>
                    {canManage && (
                      <td>
                        <div className={styles.actionsRow}>
                          <button className={styles.rowActionBtn} onClick={() => openEdit(rule)}>Edit</button>
                          <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(rule)}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New Automation" : "Edit Automation"}>
        <form onSubmit={handleSave} className={modalStyles.body}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-assign referral leads" />
          </div>

          <div className={modalStyles.field}>
            <label>Trigger</label>
            <SearchableSelect
              options={TRIGGER_OPTIONS.map(t => ({ id: t.value, name: t.label }))}
              value={form.trigger}
              onChange={(v) => setForm({ ...form, trigger: v })}
              labelKey="name"
              valueKey="id"
            />
          </div>

          <div className={modalStyles.field}>
            <label>
              <input type="checkbox" checked={form.useCondition} onChange={(e) => setForm({ ...form, useCondition: e.target.checked })} />
              {" "}Only when a condition matches
            </label>
          </div>

          {form.useCondition && (
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Field</label>
                <input value={form.conditionField} onChange={(e) => setForm({ ...form, conditionField: e.target.value })} placeholder="e.g. source" />
              </div>
              <div className={modalStyles.field}>
                <label>Operator</label>
                <SearchableSelect
                  options={OPERATOR_OPTIONS.map(o => ({ id: o, name: o }))}
                  value={form.conditionOperator}
                  onChange={(v) => setForm({ ...form, conditionOperator: v })}
                  labelKey="name"
                  valueKey="id"
                />
              </div>
              <div className={modalStyles.field}>
                <label>Value</label>
                <input value={form.conditionValue} onChange={(e) => setForm({ ...form, conditionValue: e.target.value })} placeholder="e.g. Referral" />
              </div>
            </div>
          )}

          <div className={modalStyles.field}>
            <label>Action</label>
            <SearchableSelect
              options={ACTION_OPTIONS.map(a => ({ id: a.value, name: a.label }))}
              value={form.actionType}
              onChange={(v) => setForm({ ...form, actionType: v })}
              labelKey="name"
              valueKey="id"
            />
          </div>

          {form.actionType === "ASSIGN_OWNER" && (
            <div className={modalStyles.field}>
              <label>Assign to</label>
              <SearchableSelect
                options={users}
                value={form.actionOwnerId}
                onChange={(value) => setForm({ ...form, actionOwnerId: value })}
                labelKey="name"
                valueKey="id"
                placeholder="Choose a user…"
              />
            </div>
          )}

          {form.actionType === "UPDATE_PRIORITY" && (
            <div className={modalStyles.field}>
              <label>Set priority to</label>
              <SearchableSelect
                options={PRIORITY_OPTIONS.map(p => ({ id: p, name: p }))}
                value={form.actionPriority}
                onChange={(v) => setForm({ ...form, actionPriority: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          )}

          {form.actionType === "CREATE_TASK" && (
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Task title (optional)</label>
                <input value={form.actionTaskTitle} onChange={(e) => setForm({ ...form, actionTaskTitle: e.target.value })} placeholder="Follow up…" />
              </div>
              <div className={modalStyles.field}>
                <label>Due in (days)</label>
                <input type="number" min="0" value={form.actionTaskDueInDays} onChange={(e) => setForm({ ...form, actionTaskDueInDays: e.target.value })} />
              </div>
            </div>
          )}

          {form.actionType === "SEND_EMAIL" && (
            <>
              <div className={modalStyles.field}>
                <label>Subject</label>
                <input required value={form.actionEmailSubject} onChange={(e) => setForm({ ...form, actionEmailSubject: e.target.value })} />
              </div>
              <div className={modalStyles.field}>
                <label>Body</label>
                <textarea required value={form.actionEmailBody} onChange={(e) => setForm({ ...form, actionEmailBody: e.target.value })} rows={4} />
              </div>
            </>
          )}

          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
