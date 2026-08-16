import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { api } from "../../api/client.js"
import { MdCheck, MdAdd } from "react-icons/md"
import styles from "./Settings.module.css"

export default function Plans() {
  const { user, refreshUser, hasPermission } = useAuth()
  const canManage = hasPermission("org.settings.manage")
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api.get("/plans")
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSwitch(planName) {
    if (!canManage) return
    if (user?.organization?.plan === planName) return
    if (!confirm(`Switch this organization to the ${planName.toUpperCase()} plan? No payment processor is connected — this changes feature/seat limits immediately without billing anyone.`)) return
    setError("")
    setMsg("")
    setSwitching(true)
    try {
      await api.patch("/users/plan", { plan: planName })
      await refreshUser()
      setMsg(`Switched to the ${planName.toUpperCase()} plan.`)
    } catch (err) {
      setError(err.message || "Something went wrong changing the plan.")
    } finally {
      setSwitching(false)
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  }

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  }

  return (
    <>
      <Topbar
        title="Plans & Billing"
        subtitle={loading ? "Loading available plans…" : `Current Active Plan: ${user?.organization?.plan?.toUpperCase() || "FREE"}`}
      />

      <div className={styles.page}>
        <div className={`${styles.banner} ${styles.bannerNotice}`}>
          No payment processor is connected. Switching plans here changes seat/feature limits immediately — it does not charge or bill anyone.
        </div>
        {msg && <div className={`${styles.banner} ${styles.bannerSuccess}`}>{msg}</div>}
        {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}

        <motion.div className={`${styles.roleGrid} ${styles.planGrid}`} variants={container} initial="hidden" animate="show">
          {plans.map((p) => {
            const isActive = user?.organization?.plan === p.name
            let parsedFeatures = []
            try {
              if (p.features) parsedFeatures = JSON.parse(p.features)
            } catch (e) {}

            return (
              <motion.div
                key={p.id}
                className={`${styles.roleCard} ${styles.planCard} ${isActive ? styles.planCardActive : ""}`}
                variants={item}
              >
                {isActive && <span className={styles.currentBadge}>Current</span>}

                <div className={styles.planIconWrap}>
                  <div className={styles.planIconBadge}>
                    <MdAdd size={26} />
                  </div>
                </div>

                <div>
                  <h3 className={styles.planName}>{p.name} Plan</h3>
                  <p className={styles.planSeats}>Seats limit: {p.maxUsers >= 9999 ? "Unlimited Users" : `${p.maxUsers} Users`}</p>
                </div>

                <div className={styles.planPriceRow}>
                  <span className={styles.planPriceValue}>₹{p.price}</span>
                  <span className={styles.planPriceUnit}> / month (not billed — no payment processor connected)</span>
                </div>

                <ul className={styles.planFeatureList}>
                  {parsedFeatures.map((feat, idx) => (
                    <li key={idx} className={styles.planFeatureItem}>
                      <span className={styles.planCheck}><MdCheck size={14} /></span> {feat}
                    </li>
                  ))}
                </ul>

                <div className={styles.planActionRow}>
                  {canManage && (
                    <button
                      className={`${styles.addBtn} ${styles.planActionBtn} ${isActive ? styles.planActionBtnInactive : ""}`}
                      disabled={switching || isActive}
                      onClick={() => handleSwitch(p.name)}
                    >
                      {isActive ? "Active Plan" : `Switch to ${p.name.toUpperCase()}`}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </>
  )
}
