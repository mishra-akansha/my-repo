import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate, formatCurrency } from "../../lib/format.js"
import styles from "./Settings.module.css"
import productStyles from "./Products.module.css"

const BILLING_LABELS = { ONE_TIME: "One-time", MONTHLY: "Monthly", ANNUAL: "Annual" }

export default function Products() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("products.manage")

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Edit / Create State
  const [editing, setEditing] = useState(null) // "new" or a product object
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [sku, setSku] = useState("")
  const [billingPeriod, setBillingPeriod] = useState("ONE_TIME")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function reload() {
    try {
      const data = await api.get("/products")
      setProducts(data)
    } catch (err) {
      console.error("Failed to load products", err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing("new")
    setName("")
    setDescription("")
    setPrice("")
    setSku("")
    setBillingPeriod("ONE_TIME")
    setError("")
  }

  function openEdit(item) {
    setEditing(item)
    setName(item.name)
    setDescription(item.description || "")
    setPrice(item.price ? String(item.price) : "")
    setSku(item.sku || "")
    setBillingPeriod(item.billingPeriod || "ONE_TIME")
    setError("")
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return setError("Name is required")

    setError("")
    setSubmitting(true)
    try {
      const parsedPrice = price === "" ? 0 : Number(price)
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return setError("Price must be a positive number")
      }

      const payload = { name, description, price: parsedPrice, sku: sku || null, billingPeriod }
      if (editing === "new") {
        await api.post("/products", payload)
      } else {
        await api.patch(`/products/${editing.id}`, payload)
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
    if (!confirm(`Are you sure you want to delete product "${item.name}"?`)) return
    try {
      await api.delete(`/products/${item.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Products"
        subtitle={loading ? "Loading…" : `${products.length} product${products.length !== 1 ? "s" : ""} configured`}
        action={
          canManage && (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openNew}>
              + Add Product
            </motion.button>
          )
        }
      />

      <div className={styles.page}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={productStyles.pdThName}>Name</th>
                <th className={productStyles.pdThSku}>SKU</th>
                <th className={productStyles.pdThDesc}>Description</th>
                <th className={productStyles.pdThPrice}>Price</th>
                <th className={productStyles.pdThBilling}>Billing</th>
                <th className={productStyles.pdThCreated}>Created</th>
                {canManage && <th className={productStyles.pdThActions}></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className={styles.uEmptyState2}>
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className={styles.uEmptyState2}>
                    No products configured. Click "+ Add Product" to create one.
                  </td>
                </tr>
              ) : (
                products.map((item) => (
                  <tr key={item.id}>
                    <td className={productStyles.pdCellName}>{item.name}</td>
                    <td className={productStyles.pdCellSku}>{item.sku || "—"}</td>
                    <td className={productStyles.pdCellDesc}>{item.description || "—"}</td>
                    <td className={productStyles.pdCellPrice}>{formatCurrency(item.price)}</td>
                    <td className={productStyles.pdCellBilling}>{BILLING_LABELS[item.billingPeriod] || "One-time"}</td>
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
        title={editing === "new" ? "Add Product" : `Edit Product: ${editing?.name}`}
      >
        <form onSubmit={handleSave} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Name</label>
            <input
              required
              placeholder="e.g. Enterprise License, Starter Kit"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Price (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 25000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className={modalStyles.field}>
              <label>Billing Period</label>
              <SearchableSelect
                options={[
                  { id: "ONE_TIME", name: "One-time" },
                  { id: "MONTHLY", name: "Monthly" },
                  { id: "ANNUAL", name: "Annual" },
                ]}
                value={billingPeriod}
                onChange={(v) => setBillingPeriod(v)}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>SKU</label>
            <input
              placeholder="e.g. PROD-001"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <div className={modalStyles.field}>
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Details about this product..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={productStyles.pdTextarea}
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
