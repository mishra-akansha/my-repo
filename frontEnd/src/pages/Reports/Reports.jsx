import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import TaskDetailModal from "../../components/UI/TaskDetailModal.jsx"
import { TableSkeleton } from "../../components/UI/Skeleton.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import useTaskEditor from "../../hooks/useTaskEditor.js"
import {
  MdOutlineTrendingUp,
  MdOutlinePersonOutline,
  MdOutlineChecklist,
  MdOutlineMail,
  MdOutlineCall,
  MdOutlineEvent,
  MdOutlineDescription,
  MdOutlineGroups,
  MdAdd,
  MdArrowBack,
  MdSearch,
  MdFilterList,
  MdOutlineAttachMoney,
  MdChevronRight,
} from "react-icons/md"
import styles from "./Reports.module.css"

const TYPE_ICON = { EMAIL: MdOutlineMail, CALL: MdOutlineCall, TASK: MdOutlineDescription, MEETING: MdOutlineEvent }

export default function Reports() {
  const { user, hasPermission } = useAuth()
  const [teammates, setTeammates] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedTeammate, setSelectedTeammate] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [teamFilter, setTeamFilter] = useState("")

  // Subordinate Details State
  const [subTasks, setSubTasks] = useState([])
  const [subActivities, setSubActivities] = useState([])
  const [subDeals, setSubDeals] = useState([])
  const [subLeads, setSubLeads] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState("tasks")

  // Overview Aggregate Cache
  const [teamSummary, setTeamSummary] = useState({})

  // Lookups for TaskDetailModal
  const [milestones, setMilestones] = useState([])
  const [statuses, setStatuses] = useState([])
  const [labels, setLabels] = useState([])
  const [customFieldDefs, setCustomFieldDefs] = useState([])

  useEffect(() => {
    Promise.all([
      api.get("/milestones").catch(() => []),
      api.get("/labels").catch(() => []),
      api.get("/task-statuses").catch(() => []),
      api.get("/custom-fields").then((list) => list.filter((f) => f.entityType === "TASK")).catch(() => []),
      api.get("/teams").catch(() => []),
    ]).then(([mList, lList, sList, cfList, tList]) => {
      setMilestones(mList)
      setLabels(lList)
      setStatuses(sList)
      setCustomFieldDefs(cfList)
      setTeams(tList)
    })
  }, [])

  const taskEditor = useTaskEditor({
    currentUser: user,
    statuses,
    onSaved: async () => {
      if (!selectedTeammate) return
      const updated = await api.get(`/tasks?ownerId=${selectedTeammate.id}`)
      setSubTasks(Array.isArray(updated) ? updated : (updated?.data || []))
    },
  })

  async function loadTeammatesData() {
    try {
      const [allUsers, allDeals, allTasks, allLeads] = await Promise.all([
        api.get("/users"),
        api.get("/deals"),
        api.get("/tasks"),
        api.get("/leads"),
      ])

      const hasFullReporting = hasPermission("reports.view.org")
      let filtered = []
      if (hasFullReporting) {
        filtered = allUsers
      } else {
        const subordinateIds = (user.subordinates || []).map((s) => s.id)
        filtered = allUsers.filter((u) => u.id === user.id || subordinateIds.includes(u.id))
      }
      setTeammates(filtered)

      // Calculate per-member aggregate metrics for the Overview Table
      const summaryMap = {}
      filtered.forEach((m) => {
        const memberDeals = (allDeals || []).filter((d) => d.ownerId === m.id && d.status === "OPEN")
        const pipelineVal = memberDeals.reduce((sum, d) => sum + (d.value || 0), 0)
        const memberTasks = (allTasks || []).filter((t) => t.ownerId === m.id && !t.done)
        const memberLeads = (allLeads || []).filter((l) => l.ownerId === m.id && l.status !== "DISQUALIFIED" && l.status !== "CONVERTED")

        summaryMap[m.id] = {
          pipelineVal,
          openDealsCount: memberDeals.length,
          pendingTasksCount: memberTasks.length,
          activeLeadsCount: memberLeads.length,
        }
      })
      setTeamSummary(summaryMap)
    } catch (err) {
      console.error("Could not load team reports data:", err)
    } finally {
      setLoading(false)
    }
  }

  async function selectTeammate(member) {
    setSelectedTeammate(member)
    setActiveDetailTab("tasks")
    setLoadingDetails(true)
    try {
      const [tasksRes, activitiesRes, dealsRes, leadsRes] = await Promise.all([
        api.get(`/tasks?ownerId=${member.id}`),
        api.get(`/activities?ownerId=${member.id}`),
        api.get(`/deals?ownerId=${member.id}`),
        api.get(`/leads?ownerId=${member.id}`),
      ])

      setSubTasks(Array.isArray(tasksRes) ? tasksRes : (tasksRes?.data || []))
      setSubActivities(Array.isArray(activitiesRes) ? activitiesRes : (activitiesRes?.data || []))
      setSubDeals(Array.isArray(dealsRes) ? dealsRes : (dealsRes?.data || []))
      setSubLeads(Array.isArray(leadsRes) ? leadsRes : (leadsRes?.data || []))
    } catch (err) {
      console.error("Could not load teammate details:", err)
    } finally {
      setLoadingDetails(false)
    }
  }

  useEffect(() => {
    loadTeammatesData()
  }, [])

  async function toggleSubTask(task) {
    const nextDone = !task.done
    setSubTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t)))
    try {
      await api.patch(`/tasks/${task.id}`, { done: nextDone })
    } catch (err) {
      setSubTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)))
      alert(err.message || "Could not update task")
    }
  }

  async function quickUpdateSubTask(taskId, patch) {
    setSubTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
    try {
      await api.patch(`/tasks/${taskId}`, patch)
    } catch (err) {
      console.error("Failed to update task", err)
    }
  }

  async function handleDeleteSubTask(taskId) {
    if (!window.confirm("Are you sure you want to delete this task?")) return
    setSubTasks((prev) => prev.filter((t) => t.id !== taskId))
    try {
      await api.delete(`/tasks/${taskId}`)
    } catch (err) {
      console.error("Failed to delete task", err)
    }
  }

  // Filtered teammates list for Overview mode
  const filteredTeammates = teammates.filter((m) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchesTeam = !teamFilter || (teamFilter === "none" ? !m.team : m.team?.id === teamFilter)
    return matchesSearch && matchesTeam
  })

  // Overview Aggregate Totals
  const totalTeamPipeline = Object.values(teamSummary).reduce((sum, s) => sum + (s.pipelineVal || 0), 0)
  const totalTeamDeals = Object.values(teamSummary).reduce((sum, s) => sum + (s.openDealsCount || 0), 0)
  const totalTeamLeads = Object.values(teamSummary).reduce((sum, s) => sum + (s.activeLeadsCount || 0), 0)
  const totalTeamTasks = Object.values(teamSummary).reduce((sum, s) => sum + (s.pendingTasksCount || 0), 0)

  // Selected Teammate Metrics
  const selectedPipelineVal = subDeals.filter((d) => d.status === "OPEN").reduce((sum, d) => sum + (d.value || 0), 0)
  const selectedLeadsCount = subLeads.filter((l) => l.status !== "DISQUALIFIED" && l.status !== "CONVERTED").length
  const selectedTasksCount = subTasks.filter((t) => !t.done).length

  const tasksByDay = subTasks
    .filter((t) => t.dueDate)
    .reduce((groups, t) => {
      const key = t.dueDate.slice(0, 10)
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
      return groups
    }, {})
  const sortedDayKeys = Object.keys(tasksByDay).sort((a, b) => a.localeCompare(b))

  // Tasks Date Range Filter State
  const [taskDateFilter, setTaskDateFilter] = useState("all") // "all" | "today" | "week" | "month"

  return (
    <>
      <Topbar
        title="Team Reports"
        subtitle={
          selectedTeammate
            ? `Performance audit & task delegation for ${selectedTeammate.name}`
            : "Overview of sales team performance, pipeline, and tasks"
        }
        action={
          selectedTeammate ? (
            <button
              type="button"
              className={styles.assignBtn}
              onClick={() => taskEditor.openCreate({ ownerId: selectedTeammate.id })}
            >
              <MdAdd size={16} /> Assign Task to {selectedTeammate.name.split(" ")[0]}
            </button>
          ) : (
            <button
              type="button"
              className={styles.assignBtn}
              onClick={() => taskEditor.openCreate({ ownerId: user.id })}
            >
              <MdAdd size={16} /> Quick Assign Task
            </button>
          )
        }
      />

      <div className={styles.page}>
        {/* MODE 1: OVERVIEW DASHBOARD */}
        {!selectedTeammate ? (
          <div className={styles.overviewContainer}>
            {/* Top KPI Cards */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiIconWrap} style={{ background: "rgba(168, 85, 247, 0.15)", color: "var(--primary)" }}>
                  <MdOutlineTrendingUp size={20} />
                </div>
                <div>
                  <span className={styles.kpiLabel}>Total Team Pipeline</span>
                  <span className={styles.kpiVal}>
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalTeamPipeline)}
                  </span>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiIconWrap} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                  <MdOutlineAttachMoney size={20} />
                </div>
                <div>
                  <span className={styles.kpiLabel}>Open Deals</span>
                  <span className={styles.kpiVal}>{totalTeamDeals}</span>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiIconWrap} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                  <MdOutlinePersonOutline size={20} />
                </div>
                <div>
                  <span className={styles.kpiLabel}>Active Leads</span>
                  <span className={styles.kpiVal}>{totalTeamLeads}</span>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiIconWrap} style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                  <MdOutlineChecklist size={20} />
                </div>
                <div>
                  <span className={styles.kpiLabel}>Pending Tasks</span>
                  <span className={styles.kpiVal}>{totalTeamTasks}</span>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className={styles.tableToolbar}>
              <div className={styles.searchWrap}>
                <MdSearch className={styles.searchIcon} size={18} />
                <input
                  type="text"
                  placeholder="Search team member by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className={styles.teamFilterSelect}
              >
                <option value="">All Departments & Teams</option>
                <option value="none">Unassigned Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Leaderboard & Teammate Performance Table */}
            <div className={styles.tableCard}>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : filteredTeammates.length === 0 ? (
                <div className={styles.emptyTableState}>
                  <MdOutlineGroups size={32} />
                  <p>No team members match your filter criteria.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Team Member</th>
                      <th>Role</th>
                      <th>Department / Team</th>
                      <th>Active Pipeline</th>
                      <th>Open Deals</th>
                      <th>Active Leads</th>
                      <th>Pending Tasks</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeammates.map((m) => {
                      const summary = teamSummary[m.id] || { pipelineVal: 0, openDealsCount: 0, pendingTasksCount: 0, activeLeadsCount: 0 }
                      return (
                        <tr
                          key={m.id}
                          className={styles.tableRow}
                          onClick={() => selectTeammate(m)}
                        >
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                              <Avatar name={m.name} color={m.color} size={30} />
                              <div>
                                <div className={styles.memberName}>{m.name}</div>
                                <div className={styles.memberEmail}>{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone="neutral">{m.role?.name || "Rep"}</Badge>
                          </td>
                          <td>
                            {m.team ? (
                              <span className={styles.teamBadge}>{m.team.name}</span>
                            ) : (
                              <span style={{ fontSize: "0.71875rem", color: "var(--text-tertiary)" }}>—</span>
                            )}
                          </td>
                          <td className={styles.valCell}>
                            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(summary.pipelineVal)}
                          </td>
                          <td>
                            <span className={styles.numBadge}>{summary.openDealsCount}</span>
                          </td>
                          <td>
                            <span className={styles.numBadge}>{summary.activeLeadsCount}</span>
                          </td>
                          <td>
                            <span className={`${styles.numBadge} ${summary.pendingTasksCount > 0 ? styles.numBadgeWarning : ""}`}>
                              {summary.pendingTasksCount}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.35rem" }}>
                              <button
                                type="button"
                                className={styles.rowAssignTaskBtn}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  taskEditor.openCreate({ ownerId: m.id })
                                }}
                              >
                                <MdAdd size={14} /> Assign Task
                              </button>
                              <button
                                type="button"
                                className={styles.rowInspectBtn}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectTeammate(m)
                                }}
                              >
                                Inspect <MdChevronRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* MODE 2: TEAMMATE DEEP DIVE INSPECTOR */
          <div className={styles.deepDiveContainer}>
            {/* Top Navigation Banner */}
            <div className={styles.deepDiveTopNav}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setSelectedTeammate(null)}
              >
                <MdArrowBack size={16} /> Back to Team Overview
              </button>

              <div className={styles.teammateSelectorWrap}>
                <span className={styles.selectorLabel}>Switch Teammate:</span>
                <select
                  value={selectedTeammate.id}
                  onChange={(e) => {
                    const found = teammates.find((t) => t.id === e.target.value)
                    if (found) selectTeammate(found)
                  }}
                  className={styles.teammateSelect}
                >
                  {teammates.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role?.name})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Profile & KPI Summary Header */}
            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <Avatar name={selectedTeammate.name} color={selectedTeammate.color} size={42} />
                <div>
                  <h3 className={styles.profileName}>{selectedTeammate.name}</h3>
                  <div className={styles.profileMeta}>
                    <span>{selectedTeammate.email}</span>
                    <span>•</span>
                    <Badge tone="neutral">{selectedTeammate.role?.name}</Badge>
                    {selectedTeammate.team && (
                      <>
                        <span>•</span>
                        <span className={styles.teamBadge}>{selectedTeammate.team.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Subordinate Stat Pills */}
              <div className={styles.profileMetrics}>
                <div className={styles.pMetricItem}>
                  <span className={styles.pMetricLabel}>Active Pipeline</span>
                  <span className={styles.pMetricVal}>
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(selectedPipelineVal)}
                  </span>
                </div>
                <div className={styles.pMetricDivider} />
                <div className={styles.pMetricItem}>
                  <span className={styles.pMetricLabel}>Active Leads</span>
                  <span className={styles.pMetricVal}>{selectedLeadsCount}</span>
                </div>
                <div className={styles.pMetricDivider} />
                <div className={styles.pMetricItem}>
                  <span className={styles.pMetricLabel}>Pending Tasks</span>
                  <span className={styles.pMetricVal}>{selectedTasksCount}</span>
                </div>
                <div className={styles.pMetricDivider} />
                <div className={styles.pMetricItem}>
                  <span className={styles.pMetricLabel}>Activities Logged</span>
                  <span className={styles.pMetricVal}>{subActivities.length}</span>
                </div>
              </div>
            </div>

            {/* Detail Tabs */}
            <div className={styles.detailTabsRow}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeDetailTab === "tasks" ? styles.activeTab : ""}`}
                onClick={() => setActiveDetailTab("tasks")}
              >
                <MdOutlineChecklist size={16} /> Tasks ({subTasks.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeDetailTab === "deals" ? styles.activeTab : ""}`}
                onClick={() => setActiveDetailTab("deals")}
              >
                <MdOutlineAttachMoney size={16} /> Deals ({subDeals.filter((d) => d.status === "OPEN").length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeDetailTab === "activity" ? styles.activeTab : ""}`}
                onClick={() => setActiveDetailTab("activity")}
              >
                <MdOutlineEvent size={16} /> Activity Log ({subActivities.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeDetailTab === "leads" ? styles.activeTab : ""}`}
                onClick={() => setActiveDetailTab("leads")}
              >
                <MdOutlinePersonOutline size={16} /> Assigned Leads ({subLeads.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className={styles.tabContentArea}>
              {loadingDetails ? (
                <TableSkeleton rows={4} />
              ) : activeDetailTab === "tasks" ? (
                <div className={styles.contentSection}>
                  <div className={styles.taskFilterRow}>
                    <span className={styles.periodLabel}>Timeframe:</span>
                    <button
                      type="button"
                      className={`${styles.periodBtn} ${taskDateFilter === "all" ? styles.periodBtnActive : ""}`}
                      onClick={() => setTaskDateFilter("all")}
                    >
                      All ({subTasks.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.periodBtn} ${taskDateFilter === "today" ? styles.periodBtnActive : ""}`}
                      onClick={() => setTaskDateFilter("today")}
                    >
                      Today / Overdue
                    </button>
                    <button
                      type="button"
                      className={`${styles.periodBtn} ${taskDateFilter === "week" ? styles.periodBtnActive : ""}`}
                      onClick={() => setTaskDateFilter("week")}
                    >
                      Next 7 Days
                    </button>
                    <button
                      type="button"
                      className={`${styles.periodBtn} ${taskDateFilter === "month" ? styles.periodBtnActive : ""}`}
                      onClick={() => setTaskDateFilter("month")}
                    >
                      This Month
                    </button>
                  </div>

                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const weekAhead = new Date()
                    weekAhead.setDate(weekAhead.getDate() + 7)
                    const weekAheadStr = weekAhead.toISOString().slice(0, 10)
                    const monthAhead = new Date()
                    monthAhead.setDate(monthAhead.getDate() + 30)
                    const monthAheadStr = monthAhead.toISOString().slice(0, 10)

                    const filteredTasks = subTasks.filter((t) => {
                      if (taskDateFilter === "all") return true
                      if (!t.dueDate) return false
                      const due = t.dueDate.slice(0, 10)
                      if (taskDateFilter === "today") return due <= todayStr
                      if (taskDateFilter === "week") return due <= weekAheadStr
                      if (taskDateFilter === "month") return due <= monthAheadStr
                      return true
                    })

                    const groupedByDay = filteredTasks
                      .filter((t) => t.dueDate)
                      .reduce((groups, t) => {
                        const key = t.dueDate.slice(0, 10)
                        if (!groups[key]) groups[key] = []
                        groups[key].push(t)
                        return groups
                      }, {})
                    const dayKeys = Object.keys(groupedByDay).sort((a, b) => a.localeCompare(b))

                    if (filteredTasks.length === 0) {
                      return (
                        <div className={styles.emptyContentBlock}>
                          <MdOutlineChecklist size={28} />
                          <p>No tasks match the selected timeframe ({taskDateFilter}).</p>
                          <button
                            type="button"
                            className={styles.assignBtn}
                            onClick={() => taskEditor.openCreate({ ownerId: selectedTeammate.id })}
                          >
                            + Assign Task
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div className={styles.dayGroups}>
                        {dayKeys.map((day) => (
                          <div key={day} className={styles.dayGroup}>
                            <div className={styles.dayGroupLabel}>
                              {new Date(day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            </div>
                            <div className={styles.dayGroupTasks}>
                              {groupedByDay[day].map((t) => {
                                const relatedMeta = t.lead
                                  ? `Lead: ${t.lead.firstName} ${t.lead.lastName}`
                                  : t.deal
                                  ? `Deal: ${t.deal.name}`
                                  : t.account
                                  ? `Account: ${t.account.name}`
                                  : ""
                                return (
                                  <div
                                    key={t.id}
                                    className={`${styles.dayTaskRow} ${t.done ? styles.dayTaskDone : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className={styles.taskCheckbox}
                                      checked={t.done}
                                      onChange={() => toggleSubTask(t)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className={styles.typePill}>{t.type || "TASK"}</span>

                                    <div className={styles.dayTaskBody}>
                                      <span
                                        className={styles.dayTaskTitle}
                                        onClick={() => taskEditor.openEdit(t)}
                                      >
                                        {t.title}
                                      </span>
                                      <span className={styles.dayTaskMeta}>
                                        {relatedMeta}
                                        {t.contact && <span> · {t.contact.firstName} {t.contact.lastName}</span>}
                                        {t.owner && t.owner.id !== selectedTeammate.id && <span> · {t.owner.name}</span>}
                                      </span>
                                    </div>

                                    <select
                                      className={`${styles.inlineSelect} ${styles[`priority_${t.priority || "MEDIUM"}`]}`}
                                      value={t.priority || "MEDIUM"}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => quickUpdateSubTask(t.id, { priority: e.target.value })}
                                    >
                                      <option value="LOW">Low</option>
                                      <option value="MEDIUM">Medium</option>
                                      <option value="HIGH">High</option>
                                      <option value="CRITICAL">Critical</option>
                                    </select>

                                    <select
                                      className={`${styles.inlineSelect} ${styles.statusSelect}`}
                                      value={t.status || (statuses[0]?.name || "Todo")}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => quickUpdateSubTask(t.id, { status: e.target.value })}
                                    >
                                      {statuses.map((s) => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                      ))}
                                    </select>

                                    {t.dueDate && (
                                      <span className={styles.dayTaskDue}>
                                        {formatDate(t.dueDate)}
                                      </span>
                                    )}

                                    <div className={styles.taskRowActions}>
                                      <button
                                        type="button"
                                        className={styles.rowBtn}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          taskEditor.openEdit(t)
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.rowBtn} ${styles.rowBtnDelete}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteSubTask(t.id)
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              ) : activeDetailTab === "deals" ? (
                <div className={styles.contentSection}>
                  {subDeals.filter((d) => d.status === "OPEN").length === 0 ? (
                    <div className={styles.emptyContentBlock}>
                      <MdOutlineAttachMoney size={28} />
                      <p>No active deals currently assigned to {selectedTeammate.name.split(" ")[0]}.</p>
                    </div>
                  ) : (
                    <div className={styles.dealsGrid}>
                      {subDeals
                        .filter((d) => d.status === "OPEN")
                        .map((d) => (
                          <div key={d.id} className={styles.dealCard}>
                            <div className={styles.dealHeader}>
                              <span className={styles.dealName}>{d.name}</span>
                              <Badge tone="primary">{d.stage?.name || "Open"}</Badge>
                            </div>
                            <div className={styles.dealVal}>
                              {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(d.value)}
                            </div>
                            {d.expectedCloseDate && (
                              <div className={styles.dealSub}>Expected close: {formatDate(d.expectedCloseDate)}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : activeDetailTab === "activity" ? (
                <div className={styles.contentSection}>
                  {subActivities.length === 0 ? (
                    <div className={styles.emptyContentBlock}>
                      <MdOutlineEvent size={28} />
                      <p>No logged activities found for this teammate.</p>
                    </div>
                  ) : (
                    <div className={styles.timeline}>
                      {subActivities.map((a) => {
                        const cleanNotes = a.notes?.replace(/^\[Sent Email\]\s*|^\[Client Reply\]\s*/, "") || ""
                        const TypeIcon = TYPE_ICON[a.type] || MdOutlineDescription
                        return (
                          <div key={a.id} className={styles.activityCard}>
                            <div className={styles.activityHeader}>
                              <span className={styles.activityType}>
                                <TypeIcon size={14} /> {a.type}
                              </span>
                              <span className={styles.activityDate}>{formatDate(a.createdAt)}</span>
                            </div>
                            <div className={styles.activityNotes}>{cleanNotes}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* LEADS TAB */
                <div className={styles.contentSection}>
                  {subLeads.length === 0 ? (
                    <div className={styles.emptyContentBlock}>
                      <MdOutlinePersonOutline size={28} />
                      <p>No active leads assigned to {selectedTeammate.name.split(" ")[0]}.</p>
                    </div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Lead Name</th>
                          <th>Company / Organization</th>
                          <th>Status</th>
                          <th>Estimated Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subLeads.map((l) => (
                          <tr key={l.id} className={styles.tableRow}>
                            <td style={{ fontWeight: "700" }}>{l.name}</td>
                            <td>{l.company || "—"}</td>
                            <td><Badge tone="neutral">{l.status}</Badge></td>
                            <td className={styles.valCell}>
                              {l.value
                                ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(l.value)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <TaskDetailModal
        modalOpen={taskEditor.modalOpen}
        setModalOpen={taskEditor.setModalOpen}
        editingId={taskEditor.editingId}
        editOnly={taskEditor.editOnly}
        onEditOnly={() => taskEditor.setEditOnly(true)}
        form={taskEditor.form}
        setForm={taskEditor.setForm}
        users={teammates}
        user={user}
        milestones={milestones}
        statuses={statuses}
        labels={labels}
        relatedLabel={taskEditor.relatedLabel}
        setRelatedLabel={taskEditor.setRelatedLabel}
        contactLabel={taskEditor.contactLabel}
        setContactLabel={taskEditor.setContactLabel}
        customFieldDefs={customFieldDefs}
        error={taskEditor.error}
        submitting={taskEditor.submitting}
        handleSubmit={taskEditor.handleSubmit}
      />
    </>
  )
}
