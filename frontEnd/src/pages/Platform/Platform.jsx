import { useState, useEffect } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import Modal from "../../components/UI/Modal.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import { MdOutlineApartment, MdOutlineCreditCard, MdCheck } from "react-icons/md"
import styles from "../Settings/Settings.module.css"

const EMPTY_FORM = { name: "", plan: "", adminName: "", adminEmail: "" }
const STATUS_TONE = { active: "won", suspended: "lost", trial: "progress" }

const EMPTY_PLAN_FORM = {
  name: "",
  price: 0,
  maxUsers: 5,
  features: ["Custom roles & permissions"],
  newFeatureText: ""
}

export default function Platform() {
  const { startImpersonation, user } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [plans, setPlans] = useState([])
  const [activeTab, setActiveTab] = useState("orgs")
  const [loading, setLoading] = useState(true)

  // Orgs Modals
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tempPasswordResult, setTempPasswordResult] = useState(null)

  // Plans Modals
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM)
  const [planError, setPlanError] = useState("")
  const [submittingPlan, setSubmittingPlan] = useState(false)

  function reload() {
    return Promise.all([
      api.get("/platform/organizations"),
      api.get("/platform/plans")
    ]).then(([orgList, planList]) => {
      setOrgs(orgList)
      setPlans(planList)
      
      // Auto-set default selected plan for org signup form
      if (planList.length > 0 && !form.plan) {
        setForm((f) => ({ ...f, plan: planList[0].name }))
      }
    })
  }

  useEffect(() => {
    reload()
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Organization signup handlers
  async function handleCreate(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await api.post("/platform/organizations", form)
      setTempPasswordResult(res)
      setForm({ ...EMPTY_FORM, plan: plans[0]?.name || "" })
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(org) {
    const next = org.status === "suspended" ? "active" : "suspended"
    if (!confirm(`${next === "suspended" ? "Suspend" : "Reactivate"} "${org.name}"?`)) return
    await api.patch(`/platform/organizations/${org.id}/status`, { status: next })
    await reload()
  }

  async function handleImpersonate(org) {
    await startImpersonation(org.id)
    navigate("/")
  }

  // Plan creation / updates handlers
  async function handlePlanSubmit(e) {
    e.preventDefault()
    setPlanError("")
    setSubmittingPlan(true)
    
    // Normalise pricing and users
    const payload = {
      name: planForm.name.toLowerCase().trim(),
      price: Number(planForm.price) || 0,
      maxUsers: Number(planForm.maxUsers) || 1,
      features: planForm.features
    }

    try {
      if (editingPlanId) {
        await api.patch(`/platform/plans/${editingPlanId}`, payload)
      } else {
        await api.post("/platform/plans", payload)
      }
      setPlanModalOpen(false)
      setPlanForm(EMPTY_PLAN_FORM)
      setEditingPlanId(null)
      await reload()
    } catch (err) {
      setPlanError(err.message)
    } finally {
      setSubmittingPlan(false)
    }
  }

  function handleEditPlan(plan) {
    let parsedFeatures = []
    try {
      parsedFeatures = JSON.parse(plan.features)
    } catch (e) {}

    setEditingPlanId(plan.id)
    setPlanForm({
      name: plan.name,
      price: plan.price,
      maxUsers: plan.maxUsers,
      features: parsedFeatures,
      newFeatureText: ""
    })
    setPlanError("")
    setPlanModalOpen(true)
  }

  async function handleDeletePlan(plan) {
    if (!confirm(`Are you sure you want to delete the plan "${plan.name.toUpperCase()}"? This cannot be undone.`)) return
    try {
      await api.delete(`/platform/plans/${plan.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  function addFeatureItem() {
    if (!planForm.newFeatureText.trim()) return
    setPlanForm((f) => ({
      ...f,
      features: [...f.features, f.newFeatureText.trim()],
      newFeatureText: ""
    }))
  }

  function removeFeatureItem(idx) {
    setPlanForm((f) => ({
      ...f,
      features: f.features.filter((_, i) => i !== idx)
    }))
  }

  if (!user?.isSuperAdmin) return <Navigate to="/" replace />

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  if (loadError) {
    return (
      <>
        <Topbar title="Platform Console" subtitle="Access restricted" />
        <div className={styles.page}>
          <p className={modalStyles.error}>{loadError}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Platform Console"
        subtitle={
          loading
            ? "Loading…"
            : activeTab === "orgs"
            ? `${orgs.length} client organization${orgs.length !== 1 ? "s" : ""} active`
            : `${plans.length} custom subscription plan${plans.length !== 1 ? "s" : ""} configured`
        }
        action={
          activeTab === "orgs" ? (
            <motion.button
              className={styles.addBtn}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setModalOpen(true)
                setError("")
                setTempPasswordResult(null)
              }}
            >
              + New organization
            </motion.button>
          ) : (
            <motion.button
              className={`${styles.addBtn} ${styles.pfAccentBtn}`}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setPlanForm(EMPTY_PLAN_FORM)
                setEditingPlanId(null)
                setPlanError("")
                setPlanModalOpen(true)
              }}
            >
              + Create Custom Plan
            </motion.button>
          )
        }
      />

      <div className={styles.pfTabsBar}>
        <button
          onClick={() => setActiveTab("orgs")}
          className={`${styles.pfTabBtn} ${activeTab === "orgs" ? styles.pfTabBtnActive : ""}`}
        >
          <MdOutlineApartment size={16} /> Client Organizations
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`${styles.pfTabBtn} ${activeTab === "plans" ? styles.pfTabBtnActive : ""}`}
        >
          <MdOutlineCreditCard size={16} /> Custom Subscription Plans
        </button>
      </div>

      <div className={styles.page}>
        
        {activeTab === "orgs" && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className={styles.pfCellBold}>{org.name}</td>
                    <td className={styles.pfCapitalize}>{org.plan}</td>
                    <td><Badge tone={STATUS_TONE[org.status] || "neutral"}>{org.status}</Badge></td>
                    <td>{org._count?.users ?? 0}</td>
                    <td className={styles.dateCell}>{formatDate(org.createdAt)}</td>
                    <td>
                      <div className={styles.pfActionsEnd}>
                        <button className={styles.rowActionBtn} onClick={() => handleImpersonate(org)}>Impersonate</button>
                        <button className={org.status === "suspended" ? styles.rowActionBtn : styles.rowActionBtnDanger} onClick={() => toggleStatus(org)}>
                          {org.status === "suspended" ? "Reactivate" : "Suspend"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "plans" && (
          <motion.div className={`${styles.roleGrid} ${styles.pfPlansGrid}`} variants={container} initial="hidden" animate="show">
            {plans.map((plan) => {
              let parsedFeatures = []
              try {
                if (plan.features) parsedFeatures = JSON.parse(plan.features)
              } catch (e) {}

              const enrolledCount = orgs.filter(o => o.plan === plan.name).length

              return (
                <motion.div
                  key={plan.id}
                  className={`${styles.roleCard} ${styles.pfPlanCard}`}
                  variants={item}
                >
                  <div>
                    <h3 className={styles.pfPlanName}>
                      {plan.name}
                    </h3>
                    <div className={styles.pfPriceRow}>
                      <span className={styles.pfPriceValue}>₹{plan.price}</span>
                      <span className={styles.pfPriceUnit}>/mo</span>
                    </div>
                    <span className={styles.pfSeatsLabel}>
                      Seats Limit: {plan.maxUsers >= 9999 ? "Unlimited" : `${plan.maxUsers} Users`}
                    </span>
                  </div>

                  <div className={styles.pfFeaturesSection}>
                    <span className={styles.pfFeaturesLabel}>
                      Included Features:
                    </span>
                    <ul className={styles.pfFeaturesList}>
                      {parsedFeatures.map((f, i) => (
                        <li key={i} className={styles.pfFeatureItem}>
                          <MdCheck size={14} className={styles.pfCheckIcon} /> {f}
                        </li>
                      ))}
                      {parsedFeatures.length === 0 && (
                        <li className={styles.pfNoFeatures}>No feature highlights listed</li>
                      )}
                    </ul>
                  </div>

                  <div className={styles.pfCardFooter}>
                    <span>Enrolled: <strong>{enrolledCount} orgs</strong></span>
                    <div className={styles.pfCardFooterActions}>
                      <button className={styles.rowActionBtn} onClick={() => handleEditPlan(plan)}>Edit</button>
                      <button
                        className={`${styles.rowActionBtnDanger} ${enrolledCount > 0 ? styles.pfDisabledLook : ""}`}
                        onClick={() => handleDeletePlan(plan)}
                        disabled={enrolledCount > 0}
                        title={enrolledCount > 0 ? "Cannot delete plan currently assigned to client organizations" : ""}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New organization">
        {tempPasswordResult ? (
          <div className={`${modalStyles.body} ${styles.uP0}`}>
            <p>{tempPasswordResult.organization.name} created. Admin: <strong>{tempPasswordResult.admin.name}</strong> ({tempPasswordResult.admin.email})</p>
            <p className={styles.pfMutedSm}>Share this one-time temporary password with them:</p>
            <div className={modalStyles.field}>
              <input readOnly value={tempPasswordResult.tempPassword} onFocus={(e) => e.target.select()} className={styles.pfMonoInput} />
            </div>
            <div className={modalStyles.actions}>
              <button className={modalStyles.submitBtn} onClick={() => { setModalOpen(false); setTempPasswordResult(null) }}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className={`${modalStyles.body} ${styles.uP0}`}>
            <div className={modalStyles.field}>
              <label>Organization name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corporation" />
            </div>
            <div className={modalStyles.field}>
              <label>Subscription Plan</label>
              <SearchableSelect
                options={plans.map(p => ({ id: p.name, name: `${p.name.toUpperCase()} (₹${p.price}/mo)` }))}
                value={form.plan}
                onChange={(v) => setForm({ ...form, plan: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Admin name</label>
                <input required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="John Doe" />
              </div>
              <div className={modalStyles.field}>
                <label>Admin email</label>
                <input required type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="john@example.com" />
              </div>
            </div>
            {error && <p className={modalStyles.error}>{error}</p>}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
                {submitting ? "Creating…" : "Create organization"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={planModalOpen} onClose={() => setPlanModalOpen(false)} title={editingPlanId ? "Edit Subscription Plan" : "Create Subscription Plan"}>
        <form onSubmit={handlePlanSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Plan identifier (Lowercase name)</label>
            <input
              required
              disabled={!!editingPlanId}
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              placeholder="e.g. platinum, developer, standard"
            />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Monthly Price (₹)</label>
              <input
                required
                type="number"
                min="0"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
              />
            </div>
            <div className={modalStyles.field}>
              <label>Seats limit (Active Users)</label>
              <input
                required
                type="number"
                min="1"
                max="9999"
                value={planForm.maxUsers}
                onChange={(e) => setPlanForm({ ...planForm, maxUsers: e.target.value })}
              />
              <span className={styles.pfHintXs}>
                Enter 9999 for unlimited users
              </span>
            </div>
          </div>

          <div className={styles.pfSectionWrap}>
            <h4 className={styles.uSectionTitleSm}>Structural Rules Configuration</h4>
            
            <div className={styles.pfCheckCol}>
              <label className={styles.uCheckRow}>
                <input
                  type="checkbox"
                  checked={planForm.features.includes("Custom roles & permissions")}
                  onChange={(e) => {
                    const active = e.target.checked
                    setPlanForm(f => ({
                      ...f,
                      features: active
                        ? [...f.features, "Custom roles & permissions"]
                        : f.features.filter(feat => feat !== "Custom roles & permissions")
                    }))
                  }}
                />
                Enable Custom Roles management
              </label>

              <label className={styles.uCheckRow}>
                <input
                  type="checkbox"
                  checked={planForm.features.includes("Immutable audit trail logs")}
                  onChange={(e) => {
                    const active = e.target.checked
                    setPlanForm(f => ({
                      ...f,
                      features: active
                        ? [...f.features, "Immutable audit trail logs"]
                        : f.features.filter(feat => feat !== "Immutable audit trail logs")
                    }))
                  }}
                />
                Enable Immutable System Audit logs
              </label>
            </div>

            <h4 className={styles.uSectionTitleSm}>Plan Feature Highlights</h4>
            <div className={styles.pfFeatureInputRow}>
              <input
                value={planForm.newFeatureText}
                onChange={(e) => setPlanForm({ ...planForm, newFeatureText: e.target.value })}
                placeholder="e.g. 24/7 Phone SLA Support"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addFeatureItem()
                  }
                }}
              />
              <button type="button" className={`${styles.rowActionBtn} ${styles.pfAddBtnHeight}`} onClick={addFeatureItem}>
                Add Highlight
              </button>
            </div>

            <ul className={styles.pfExistingFeaturesList}>
              {planForm.features.map((feat, idx) => (
                <li key={idx} className={styles.pfExistingFeatureRow}>
                  <span className={styles.pfFeatureText}><MdCheck size={13} /> {feat}</span>
                  <button
                    type="button"
                    onClick={() => removeFeatureItem(idx)}
                    className={styles.pfRemoveBtn}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {planError && <p className={modalStyles.error}>{planError}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setPlanModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submittingPlan}>
              {submittingPlan ? "Saving plan…" : editingPlanId ? "Update plan" : "Create custom plan"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}