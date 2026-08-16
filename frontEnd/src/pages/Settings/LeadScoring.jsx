import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"

const FIELD_OPTIONS = ["source", "company", "status"]
const OPERATOR_OPTIONS = ["EQUALS", "CONTAINS", "GT", "LT"]
const EMPTY_FORM = { field: "source", operator: "EQUALS", value: "", points: 10 }

export default function LeadScoring() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("leadScoring.manage")

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [thresholds, setThresholds] = useState(null)
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [thresholdError, setThresholdError] = useState("")

  async function reload() {
    try {
      const [ruleList, orgSettings] = await Promise.all([
        api.get("/lead-scoring"),
        api.get("/org-settings"),
      ])
      setRules(ruleList)
      setThresholds(orgSettings.priorityThresholds)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function updateThreshold(key, value) {
    if (!canManage) return
    setThresholds({ ...thresholds, [key]: Number(value) })
  }

  async function saveThresholds(e) {
    e.preventDefault()
    if (!canManage) return
    setSavingThresholds(true)
    setThresholdError("")
    try {
      await api.patch("/org-settings", { priorityThresholds: thresholds })
    } catch (err) {
      setThresholdError(err.message)
    } finally {
      setSavingThresholds(false)
    }
  }

  function openNew() {
    setEditing("new")
    setForm(EMPTY_FORM)
    setError("")
  }

  function openEdit(rule) {
    setEditing(rule)
    setForm({ field: rule.field, operator: rule.operator, value: rule.value, points: rule.points })
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = { ...form, points: Number(form.points) }
      if (editing === "new") {
        await api.post("/lead-scoring", payload)
      } else {
        await api.patch(`/lead-scoring/${editing.id}`, payload)
      }
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(rule) {
    if (!confirm(`Delete scoring rule "${rule.field} ${rule.operator} ${rule.value}"?`)) return
    try {
      await api.delete(`/lead-scoring/${rule.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Lead Scoring"
        subtitle={loading ? "Loading..." : `${rules.length} rule${rules.length !== 1 ? "s" : ""} - leads are re-scored on every save`}
        action={
          canManage && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + Add Rule
            </motion.button>
          )
        }
      />
      <div className={styles.page}>
        <div className={styles.thresholdsPanel}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Priority</p>
            <h3>Priority thresholds</h3>
          </div>
          <p className={styles.thresholdsHint}>Minimum score needed for a lead to be marked at each priority level.</p>
          <form className={styles.thresholdsForm} onSubmit={saveThresholds}>
            <div className={styles.thresholdGrid}>
              {["urgent", "high", "medium"].map((key) => (
                <div key={key} className={styles.thresholdField}>
                  <label htmlFor={`threshold-${key}`}>{key}</label>
                  <input
                    id={`threshold-${key}`}
                    type="number"
                    value={thresholds ? thresholds[key] : ""}
                    onChange={(e) => updateThreshold(key, e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              ))}
            </div>
            {thresholdError && <p className={styles.empty}>{thresholdError}</p>}
            {canManage && (
              <motion.button type="submit" className={styles.primaryLink} whileTap={{ scale: 0.96 }} disabled={savingThresholds}>
                {savingThresholds ? "Saving..." : "Save thresholds"}
              </motion.button>
            )}
          </form>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Field</th>
                <th>Operator</th>
                <th>Value</th>
                <th>Points</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyState}>Loading rules...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={5} className={styles.emptyState}><EmptyState type="generic" title="No scoring rules yet" hint="Priority falls back to manual selection." compact /></td></tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className={styles.tdStrong}>{rule.field}</td>
                    <td>{rule.operator}</td>
                    <td>{rule.value}</td>
                    <td>{rule.points > 0 ? `+${rule.points}` : rule.points}</td>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add Scoring Rule" : "Edit Scoring Rule"}>
        <form onSubmit={handleSave} className={modalStyles.body}>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Field</label>
              <SearchableSelect
                options={FIELD_OPTIONS.map(f => ({ id: f, name: f }))}
                value={form.field}
                onChange={(v) => setForm({ ...form, field: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
            <div className={modalStyles.field}>
              <label>Operator</label>
              <SearchableSelect
                options={OPERATOR_OPTIONS.map(o => ({ id: o, name: o }))}
                value={form.operator}
                onChange={(v) => setForm({ ...form, operator: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>Value</label>
            <input required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. Referral" />
          </div>
          <div className={modalStyles.field}>
            <label>Points (negative allowed)</label>
            <input required type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
