import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import styles from "./Settings.module.css"
import ctStyles from "./ClientTypes.module.css"

export default function ClientTypes() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("clientTypes.manage")

  const [clientTypes, setClientTypes] = useState([])
  const [loading, setLoading] = useState(true)

  // Edit / Create State
  const [editing, setEditing] = useState(null) // "new" or a clientType object
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function reload() {
    try {
      const data = await api.get("/client-types")
      setClientTypes(data)
    } catch (err) {
      console.error("Failed to load client types", err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing("new")
    setName("")
    setDescription("")
    setError("")
  }

  function openEdit(item) {
    setEditing(item)
    setName(item.name)
    setDescription(item.description || "")
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return setError("Name is required")

    setError("")
    setSubmitting(true)
    try {
      if (editing === "new") {
        await api.post("/client-types", { name, description })
      } else {
        await api.patch(`/client-types/${editing.id}`, { name, description })
      }
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Are you sure you want to delete client type "${item.name}"?`)) return
    try {
      await api.delete(`/client-types/${item.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Client Types"
        subtitle={loading ? "Loading…" : `${clientTypes.length} client type${clientTypes.length !== 1 ? "s" : ""} configured`}
        action={
          canManage && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + Add Client Type
            </motion.button>
          )
        }
      />

      <div className={styles.page}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={ctStyles.colName}>Name</th>
                <th className={ctStyles.colDescription}>Description</th>
                <th className={ctStyles.colCreated}>Created</th>
                {canManage && <th className={ctStyles.colActions}></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className={styles.uEmptyState2}>
                    Loading client types...
                  </td>
                </tr>
              ) : clientTypes.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className={styles.uEmptyState2}>
                    <EmptyState type="generic" title="No client types configured" hint='Click "+ Add Client Type" to create one.' compact />
                  </td>
                </tr>
              ) : (
                clientTypes.map((item) => (
                  <tr key={item.id}>
                    <td className={ctStyles.cellName}>{item.name}</td>
                    <td className={ctStyles.cellDescription}>{item.description || "—"}</td>
                    <td className={styles.dateCell}>{formatDate(item.createdAt)}</td>
                    {canManage && (
                      <td>
                        <div className={styles.uActionsEnd}>
                          <button className={styles.rowActionBtn} onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(item)}>
                            Delete
                          </button>
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

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add Client Type" : `Edit Client Type: ${editing?.name}`}
      >
        <form onSubmit={handleSave} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input
              required
              placeholder="e.g. Enterprise, Corporate, Retail"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={modalStyles.field}>
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Details about this type of client..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={ctStyles.descriptionInput}
            />
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
