import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { getPlanLimits } from "../../lib/plans.js"
import styles from "./Settings.module.css"
import roleStyles from "./Roles.module.css"

function labelize(s) {
  return s.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Roles() {
  const { user } = useAuth()
  const limits = getPlanLimits(user?.organization?.plan)
  const [roles, setRoles] = useState([])
  const [catalogue, setCatalogue] = useState({ groups: {} })
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null) // role object or "new"
  const [name, setName] = useState("")
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function reload() {
    return Promise.all([api.get("/roles"), api.get("/roles/catalogue")]).then(([r, c]) => {
      setRoles(r)
      setCatalogue(c)
    })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing("new")
    setName("")
    setSelected(new Set())
    setError("")
  }

  function openEdit(role) {
    setEditing(role)
    setName(role.name)
    setSelected(new Set(role.permissions))
    setError("")
  }

  function togglePerm(perm) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const permissions = [...selected]
      if (editing === "new") {
        await api.post("/roles", { name, permissions })
      } else {
        await api.patch(`/roles/${editing.id}`, { name, permissions })
      }
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(role) {
    if (!confirm(`Delete role "${role.name}"?`)) return
    try {
      await api.delete(`/roles/${role.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Roles & Permissions"
        subtitle={loading ? "Loading…" : `${roles.length} role${roles.length !== 1 ? "s" : ""} in your organization`}
        action={
          limits.customRoles && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + New role
            </motion.button>
          )
        }
      />

      <div className={styles.page}>
        {!limits.customRoles && (
          <p className={roleStyles.planNotice}>
            Custom roles aren't available on the {user?.organization?.plan} plan — you can still view/edit the built-in roles below. Ask a Super Admin to upgrade for custom roles.
          </p>
        )}
        <div className={styles.roleGrid}>
          {roles.map((role) => (
            <div key={role.id} className={styles.roleCard}>
              <div className={styles.roleCardHeader}>
                <h4>{role.name}</h4>
                {role.isBuiltIn && <Badge tone="neutral">Built-in</Badge>}
              </div>
              <p className={styles.roleCardMeta}>{role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""} · {role._count?.users ?? 0} member{role._count?.users !== 1 ? "s" : ""}</p>
              <div className={styles.roleCardActions}>
                <button className={styles.rowActionBtn} onClick={() => openEdit(role)}>{role.isBuiltIn ? "View / edit permissions" : "Edit"}</button>
                {!role.isBuiltIn && (
                  <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(role)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New role" : `Edit ${editing?.name || ""}`}>
        <form onSubmit={handleSave} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Role name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} disabled={editing !== "new" && editing?.isBuiltIn} />
          </div>

          <div className={roleStyles.permGroups}>
            {Object.entries(catalogue.groups).map(([resource, actions]) => (
              <div key={resource}>
                <p className={roleStyles.permGroupLabel}>{resource}</p>
                <div className={roleStyles.permChipRow}>
                  {actions.map((action) => {
                    const perm = `${resource}.${action}`
                    const checked = selected.has(perm)
                    return (
                      <label key={perm} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", background: checked ? "var(--primary-bg)" : "var(--bg-chip)", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => togglePerm(perm)} />
                        {labelize(action)}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : "Save role"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}