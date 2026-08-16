import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import PageShell from "../../components/Layout/PageShell.jsx"
import StatCard from "../../components/UI/StatCard.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { api } from "../../api/client.js"
import { formatCurrency, formatDate, initialsOf } from "../../lib/format.js"
import { DashboardSkeleton } from "../../components/UI/Skeleton.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import { MdOutlineMail, MdOutlineCall, MdOutlineEditNote, MdOutlineEvent, MdOutlineEmojiEvents, MdOutlineBolt, MdClose, MdOutlineAccountBalanceWallet, MdOutlineInsights, MdOutlinePersonAddAlt, MdOutlineChecklist, MdCheck, MdOutlineCalendarToday } from "react-icons/md"
import { Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js"
import styles from "./Dashboard.module.css"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTitle,
  ChartTooltip,
  ChartLegend
)

const ACTIVITY_ICON = { EMAIL: MdOutlineMail, CALL: MdOutlineCall, NOTE: MdOutlineEditNote, MEETING: MdOutlineEvent, DEAL: MdOutlineEmojiEvents }

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem("ridgeline-dashboard-banner") !== "dismissed"
  })

  function dismissBanner() {
    setShowBanner(false)
    localStorage.setItem("ridgeline-dashboard-banner", "dismissed")
  }

  async function handleToggleTask(taskId, currentDone) {
    try {
      const nextDone = !currentDone
      setData((prev) => {
        if (!prev) return prev
        const updatedTasks = prev.tasksDue.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t))
        return {
          ...prev,
          tasksDue: updatedTasks.filter((t) => !t.done),
          stats: {
            ...prev.stats,
            openTasksCount: Math.max(0, prev.stats.openTasksCount + (nextDone ? -1 : 1)),
          },
        }
      })
      await api.patch(`/tasks/${taskId}`, { done: nextDone })
    } catch (err) {
      console.error("Failed to toggle task:", err)
    }
  }

  useEffect(() => {
    api
      .get("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  if (error) {
    return (
      <PageShell
        title="Dashboard"
        error={`Couldn't load dashboard: ${error}`}
        errorFallback={<div className={styles.page}><p className={styles.errorText}>Couldn't load dashboard: {error}</p></div>}
      />
    )
  }

  if (!data) {
    return (
      <PageShell
        title="Dashboard"
        loading
        loadingFallback={<div className={styles.page}><DashboardSkeleton /></div>}
      />
    )
  }

  const maxStageTotal = Math.max(...data.byStage.map((s) => s.value), 1)

  const themeVars = getComputedStyle(document.documentElement)
  const gridColor = themeVars.getPropertyValue("--chart-grid").trim()
  const textColor = themeVars.getPropertyValue("--chart-axis").trim()
  const accentColor = themeVars.getPropertyValue("--chart-bar").trim()
  const hoverColor = themeVars.getPropertyValue("--chart-bar-hover").trim()
  const tooltipBg = themeVars.getPropertyValue("--chart-tooltip-bg").trim()
  const tooltipBorder = themeVars.getPropertyValue("--chart-tooltip-border").trim()
  const tooltipTitle = themeVars.getPropertyValue("--text-primary").trim()
  const tooltipBody = themeVars.getPropertyValue("--text-secondary").trim()

  const chartData = {
    labels: data.byStage.map((s) => s.name),
    datasets: [
      {
        label: "Pipeline Value ($)",
        data: data.byStage.map((s) => s.value),
        backgroundColor: accentColor,
        hoverBackgroundColor: hoverColor,
        borderRadius: 6,
        barThickness: 24,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context) => ` Value: $${context.raw.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: {
            family: "Plus Jakarta Sans",
            weight: "600",
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: gridColor,
          drawBorder: false,
        },
        ticks: {
          color: textColor,
          font: {
            family: "Plus Jakarta Sans",
            size: 10,
          },
          callback: (value) => `$${value >= 1000 ? `${value / 1000}k` : value}`,
        },
      },
    },
  }

  return (
    <PageShell
      title={`Good day, ${user?.name?.split(" ")[0] || "there"}`}
      subtitle={`${today} — here's how the pipeline looks`}
    >
      <motion.div className={styles.page} variants={container} initial="hidden" animate="show">
        <AnimatePresence>
          {showBanner && user?.organization?.plan !== "enterprise" && (
            <motion.div
              className={styles.banner}
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.bannerContent}>
                <span className={styles.bannerIcon}><MdOutlineBolt size={28} /></span>
                <div className={styles.bannerTextContainer}>
                  <h4 className={styles.bannerTitle}>Unlock the Power of UniLead!</h4>
                  <p className={styles.bannerDesc}>
                    Your workspace is currently running on the <strong>{user?.organization?.plan || "free"} plan</strong>. Upgrade to <strong>Pro</strong> to build custom roles, or <strong>Enterprise</strong> for complete compliance audit logs.
                  </p>
                </div>
              </div>
              <div className={styles.bannerActions}>
                <Link to="/settings/plans" className={styles.bannerCta}>Upgrade Plan</Link>
                <button className={styles.bannerDismiss} onClick={dismissBanner}><MdClose size={16} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className={styles.statsRow} variants={container}>
          <motion.div variants={item}>
            <StatCard label="Open Pipeline" value={formatCurrency(data.stats.pipelineValue)} delta={`${data.stats.openDealsCount} open deals`} icon={<MdOutlineAccountBalanceWallet size={17} />} />
          </motion.div>
          <motion.div variants={item}>
            <StatCard label="Weighted Forecast" value={formatCurrency(data.stats.weightedForecast)} delta={`${data.stats.winRate}% win rate`} icon={<MdOutlineInsights size={17} />} />
          </motion.div>
          <motion.div variants={item}>
            <StatCard label="New Leads" value={data.stats.newLeadsCount} delta={`${data.stats.totalLeadsCount} total leads`} icon={<MdOutlinePersonAddAlt size={17} />} />
          </motion.div>
          <motion.div variants={item}>
            <StatCard label="Open Tasks" value={data.stats.openTasksCount} icon={<MdOutlineChecklist size={17} />} />
          </motion.div>
        </motion.div>

        <div className={styles.grid}>
          <motion.section className={styles.panel} variants={item}>
            <div className={styles.panelHeader}>
              <h3>Pipeline by stage</h3>
              <span className={styles.panelHint}>{data.stats.openDealsCount} open deals</span>
            </div>
            <div className={`${styles.stageList} ${styles.stageChartBox}`}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </motion.section>

          <motion.section className={styles.panel} variants={item}>
            <div className={styles.panelHeader}>
              <h3>Tasks due</h3>
              <Link to="/tasks" className={styles.panelHint}>
                {data.stats.openTasksCount} remaining
              </Link>
            </div>
            <ul className={styles.taskList}>
              {data.tasksDue.slice(0, 5).map((task) => {
                const relatedName =
                  task.related ||
                  (task.deal ? task.deal.name : task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null)
                return (
                  <motion.li key={task.id} className={styles.taskItem} whileHover={{ x: 2 }}>
                    <button
                      type="button"
                      className={`${styles.taskCheckBtn} ${task.done ? styles.taskChecked : ""}`}
                      onClick={() => handleToggleTask(task.id, task.done)}
                      title={task.done ? "Mark as open" : "Mark as completed"}
                      aria-label="Toggle task completed"
                    >
                      <span className={styles.taskCheckSquare}>
                        {task.done && <MdCheck size={11} />}
                      </span>
                    </button>
                    <div className={styles.taskBody}>
                      <span className={`${styles.taskTitle} ${task.done ? styles.taskTitleDone : ""}`}>
                        {task.title}
                      </span>
                      <div className={styles.taskMetaRow}>
                        {relatedName && (
                          <>
                            <span className={styles.taskRelated}>{relatedName}</span>
                            <span className={styles.metaDot}>•</span>
                          </>
                        )}
                        {task.dueDate && (
                          <span className={styles.taskDueDate}>
                            <MdOutlineCalendarToday size={11} /> {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
              {data.tasksDue.length === 0 && (
                <EmptyState type="tasks" compact title="All caught up." hint="No tasks due right now." />
              )}
            </ul>
          </motion.section>
        </div>

        <div className={styles.grid}>
          <motion.section className={styles.panel} variants={item}>
            <div className={styles.panelHeader}>
              <h3>Recent activity</h3>
            </div>
            <ul className={styles.activityList}>
              {data.recentActivity.map((a) => {
                const ActivityIcon = ACTIVITY_ICON[a.type]
                return (
                <motion.li key={a.id} className={styles.activityItem} whileHover={{ x: 3 }}>
                  <span className={styles.activityIcon}>{ActivityIcon ? <ActivityIcon size={15} /> : "•"}</span>
                  <div className={styles.activityBody}>
                    <p className={styles.activityText}>{a.notes}</p>
                    <span className={styles.activityMeta}>{a.owner?.name} · {formatDate(a.createdAt)}</span>
                  </div>
                </motion.li>
                )
              })}
              {data.recentActivity.length === 0 && <EmptyState type="activity" compact title="No activity yet." hint="Calls, emails, and notes will show up here." />}
            </ul>
          </motion.section>

          <motion.section className={styles.panel} variants={item}>
            <div className={styles.panelHeader}>
              <h3>Top reps this month</h3>
            </div>
            <ul className={styles.repList}>
              {data.topReps.map((rep) => (
                <motion.li key={rep.owner.id} className={styles.repItem} whileHover={{ x: 3 }}>
                  <Avatar name={rep.owner.name} initials={initialsOf(rep.owner.name)} color={rep.owner.color} size={30} />
                  <span className={styles.repName}>{rep.owner.name}</span>
                  <span className={styles.repValue}>{formatCurrency(rep.value)}</span>
                </motion.li>
              ))}
              {data.topReps.length === 0 && <EmptyState type="trophy" compact title="No open deals yet." hint="Top performing reps will be ranked here." />}
            </ul>
          </motion.section>
        </div>
      </motion.div>
    </PageShell>
  )
}
