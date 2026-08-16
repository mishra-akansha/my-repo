import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { MdOutlineDescription, MdOutlineViewKanban, MdOutlineGpsFixed, MdOutlineEvent, MdOutlineBusiness, MdOutlineArticle, MdChevronRight } from "react-icons/md"
import Topbar from "../../components/Layout/Topbar.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./CustomizationStudio.module.css"

const MODULE_META = {
  events: { name: "Events", owner: "Marketing", settingsPath: "/settings/events" },
  invoices: { name: "Invoices", owner: "Finance", settingsPath: "/invoices" },
  taskBoard: { name: "Task Board", owner: "Every team", settingsPath: "/settings/task-boards" },
  leadScoring: { name: "Lead Scoring", owner: "Sales ops", settingsPath: "/settings/lead-scoring" },
}

export default function CustomizationStudio() {
  const { hasPermission, refreshUser } = useAuth()
  const canManage = hasPermission("org.settings.manage")

  const [orgSettings, setOrgSettings] = useState(null)
  const [fields, setFields] = useState([])
  const [statuses, setStatuses] = useState([])
  const [scoringRules, setScoringRules] = useState([])
  const [loading, setLoading] = useState(true)

  function reload() {
    return Promise.all([
      api.get("/org-settings"),
      api.get("/custom-fields"),
      api.get("/task-statuses").catch(() => []),
      api.get("/lead-scoring").catch(() => []),
    ]).then(([settings, fieldList, taskStatuses, rules]) => {
      setOrgSettings(settings)
      setFields(fieldList)
      setStatuses(taskStatuses)
      setScoringRules(rules)
    })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function toggleModule(key) {
    if (!canManage || !orgSettings) return
    const nextModules = { ...orgSettings.modules, [key]: !orgSettings.modules[key] }
    setOrgSettings({ ...orgSettings, modules: nextModules })
    try {
      await api.patch("/org-settings", { modules: nextModules })
      await refreshUser()
      await reload()
    } catch (err) {
      reload()
    }
  }

  const moduleKeys = Object.keys(MODULE_META)
  const enabledCount = orgSettings ? moduleKeys.filter((k) => orgSettings.modules[k]).length : 0

  const entityTypeCount = useMemo(() => {
    const types = new Set(fields.map((field) => field.entityType))
    return types.size
  }, [fields])

  const setupHealth = useMemo(() => {
    const hasDealFields = fields.some((field) => field.entityType === "DEAL")
    const hasLeadFields = fields.some((field) => field.entityType === "LEAD")
    return [
      { label: "Modules configured", done: enabledCount >= 1 },
      { label: "Deal fields configured", done: hasDealFields },
      { label: "Lead fields configured", done: hasLeadFields },
      { label: "Task board has statuses", done: statuses.length > 0 },
      { label: "Lead scoring rules defined", done: scoringRules.length > 0 },
    ]
  }, [fields, enabledCount, statuses, scoringRules])

  const summaryCards = useMemo(
    () => [
      {
        key: "fields",
        icon: MdOutlineDescription,
        title: "Custom Fields",
        summary:
          fields.length === 0
            ? "No custom fields configured yet"
            : `${fields.length} custom field${fields.length === 1 ? "" : "s"} across ${entityTypeCount} entity type${entityTypeCount === 1 ? "" : "s"}`,
        to: "/settings/custom-fields",
      },
      {
        key: "profile",
        icon: MdOutlineBusiness,
        title: "Company Profile",
        summary: "Logo, name, tagline, address - used across the whole platform",
        to: "/settings/company-profile",
      },
      {
        key: "documents",
        icon: MdOutlineArticle,
        title: "Document Templates",
        summary: "Invoice footer note, and .docx mail-merge templates",
        to: "/settings/document-templates",
      },
      {
        key: "board",
        icon: MdOutlineViewKanban,
        title: "Task Board",
        summary: statuses.length === 0
          ? "No task statuses found yet"
          : `${statuses.length} status${statuses.length === 1 ? "" : "es"} configured`,
        to: "/settings/task-boards",
        module: "taskBoard",
      },
      {
        key: "scoring",
        icon: MdOutlineGpsFixed,
        title: "Lead Scoring",
        summary:
          scoringRules.length === 0
            ? "No scoring rules defined yet"
            : `${scoringRules.length} scoring rule${scoringRules.length === 1 ? "" : "s"} active`,
        to: "/settings/lead-scoring",
        module: "leadScoring",
      },
      {
        key: "events",
        icon: MdOutlineEvent,
        title: "Events & Modules",
        summary: `${enabledCount}/${moduleKeys.length} modules active`,
        to: "/settings/events",
        module: "events",
      },
    ],
    [fields.length, entityTypeCount, statuses, scoringRules.length, enabledCount, moduleKeys.length]
  )

  if (loading || !orgSettings) {
    return (
      <>
        <Topbar title="Customization Studio" subtitle="Loading..." />
        <main className={styles.page} />
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Customization Studio"
        subtitle={`${enabledCount}/${moduleKeys.length} modules active, ${fields.length} custom fields configured`}
      />

      <main className={styles.page}>
        <motion.section
          className={styles.hero}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.heroText}>
            <p className={styles.kicker}>Live setup - reads and writes real org data</p>
            <h2>Everything here reflects your actual configuration.</h2>
            <p>Toggle modules, and jump into custom fields, company profile, document templates, your task board, or lead scoring - all backed by the same settings used across the CRM.</p>
          </div>

          <div className={styles.healthPanel}>
            {setupHealth.map((item) => (
              <div key={item.label} className={styles.healthRow}>
                <span className={item.done ? styles.doneDot : styles.todoDot} />
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </motion.section>

        <section className={styles.moduleSummary}>
          <div className={styles.moduleSummaryHeader}>
            <p className={styles.eyebrow}>Modules</p>
            <h3>Feature toggles</h3>
          </div>
          <div className={styles.moduleList}>
            {moduleKeys.map((key) => {
              const isOn = orgSettings.modules[key]
              return (
                <div key={key} className={styles.moduleRow}>
                  <span>
                    <strong>{MODULE_META[key].name}</strong>
                    <small>{MODULE_META[key].owner}</small>
                  </span>
                  <span className={styles.moduleStatusGroup}>
                    <span className={isOn ? styles.statusOnLabel : styles.statusOffLabel}>{isOn ? "On" : "Off"}</span>
                    <span
                      className={`${styles.switch} ${isOn ? styles.switchOn : ""} ${canManage ? "" : styles.switchDisabled}`}
                      onClick={() => toggleModule(key)}
                      role="switch"
                      aria-checked={isOn}
                      aria-disabled={!canManage}
                      tabIndex={canManage ? 0 : -1}
                    />
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={styles.cardGrid}>
          {summaryCards.map((card) => {
            const isDisabled = card.module && !orgSettings.modules[card.module]
            if (isDisabled) {
              return (
                <div key={card.key} className={`${styles.summaryCard} ${styles.summaryCardDisabled}`}>
                  <span className={styles.cardIcon}><card.icon size={20} /></span>
                  <span className={styles.cardInfo}>
                    <strong>{card.title}</strong>
                    <p>Module turned off - enable it above to configure.</p>
                  </span>
                  <span className={styles.statusOffLabel}>Off</span>
                </div>
              )
            }
            return (
              <Link key={card.key} to={card.to} className={styles.summaryCard}>
                <span className={styles.cardIcon}><card.icon size={20} /></span>
                <span className={styles.cardInfo}>
                  <strong>{card.title}</strong>
                  <p>{card.summary}</p>
                </span>
                <span className={styles.cardArrow} aria-hidden="true"><MdChevronRight size={18} /></span>
              </Link>
            )
          })}
        </section>
      </main>
    </>
  )
}
