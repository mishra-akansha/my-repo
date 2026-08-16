import { useState, useEffect, useMemo, useRef, forwardRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import Modal from "../../components/UI/Modal.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import Avatar from "../../components/UI/Avatar.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import { api } from "../../api/client.js"

async function fetchContactOptions(term) {
  const res = await api.get(`/contacts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res.data || [])
  return list.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.email ? ` (${c.email})` : ""}` }))
}
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate, formatCurrency } from "../../lib/format.js"
import EventAttendees from "./EventAttendees.jsx"
import {
  MdOutlineMail,
  MdOutlineCall,
  MdOutlineEvent,
  MdOutlineDescription,
  MdOutlineEmojiEvents,
  MdArrowBack,
  MdOutlineGroups,
  MdOutlineAttachMoney,
  MdOutlineChecklist,
  MdOutlineBolt,
  MdOutlineBlock,
  MdCheckCircle,
  MdOutlineLocationOn,
} from "react-icons/md"
import styles from "./Events.module.css"
import pageStyles from "./EventDetailProject.module.css"

const TYPE_ICON = { EMAIL: MdOutlineMail, CALL: MdOutlineCall, TASK: MdOutlineDescription, MEETING: MdOutlineEvent }
const ACTIVITY_TYPE_ICON = { CALL: MdOutlineCall, EMAIL: MdOutlineMail, MEETING: MdOutlineEvent, NOTE: MdOutlineDescription, DEAL: MdOutlineEmojiEvents }
const LEAD_STATUS_TONE = { NEW: "new", CONTACTED: "progress", QUALIFYING: "progress", CONVERTED: "won", DISQUALIFIED: "lost" }
const DEAL_STAGE_DOT_CLASS = { New: "dot_new", Qualified: "dot_qualified", Proposal: "dot_proposal", Negotiation: "dot_negotiation", Won: "dot_won" }

export default function EventDetailProject() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()

  const [event, setEvent] = useState(null)
  const [leads, setLeads] = useState([])
  const [deals, setDeals] = useState([])
  const [tasks, setTasks] = useState([])
  const [stages, setStages] = useState([])
  const [clientTypes, setClientTypes] = useState([])
  const [products, setProducts] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageTab, setPageTab] = useState("attendees")
  const [leadLayout, setLeadLayout] = useState("BOARD")
  const [dealLayout, setDealLayout] = useState("BOARD")
  const [taskLayout, setTaskLayout] = useState("BOARD")
  const [leadQuery, setLeadQuery] = useState("")
  const [dealQuery, setDealQuery] = useState("")
  const [taskQuery, setTaskQuery] = useState("")

  // Drag states
  const [dragType, setDragType] = useState(null) // "lead" | "deal" | "task"
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  // Modals Detail ID states
  const [detailLeadId, setDetailLeadId] = useState(null)
  const [detailDealId, setDetailDealId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", type: "TASK", related: "", ownerId: "", status: "", priority: "MEDIUM", description: "" })
  const [taskStatuses, setTaskStatuses] = useState([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskUsers, setTaskUsers] = useState([])
  const [taskError, setTaskError] = useState("")

  function loadAll() {
    return Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/leads`),
      api.get(`/events/${id}/deals`),
      api.get(`/events/${id}/tasks`),
      api.get("/deals/pipelines"),
      api.get("/task-statuses"),
      api.get("/client-types"),
      api.get("/products"),
      api.get("/custom-fields"),
      api.get("/users")
    ]).then(([evt, ldList, dlList, tkList, pipelines, tsList, ctList, pList, cfList, uList]) => {
      setEvent(evt)
      setLeads(ldList)
      setDeals(dlList)
      setTasks(tkList)
      setStages(pipelines[0]?.stages || [])
      setTaskStatuses(tsList)
      setClientTypes(ctList)
      setProducts(pList)
      setCustomFields(cfList)
      setTaskUsers(uList)
    }).catch(err => {
      console.error(err)
      navigate("/events")
    })
  }

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Drag and drop handlers
  async function handleDrop(targetCol) {
    if (!dragId || !dragType) return
    const idToUpdate = dragId
    const type = dragType
    setDragId(null)
    setDragType(null)
    setOverCol(null)

    if (type === "lead") {
      const prev = leads
      setLeads(curr => curr.map(l => l.id === idToUpdate ? { ...l, status: targetCol } : l))
      try {
        await api.patch(`/leads/${idToUpdate}`, { status: targetCol })
      } catch {
        setLeads(prev)
      }
    } else if (type === "deal") {
      const prev = deals
      setDeals(curr => curr.map(d => d.id === idToUpdate ? { ...d, stageId: targetCol, stage: stages.find(s => s.id === targetCol) } : d))
      try {
        await api.patch(`/deals/${idToUpdate}/stage`, { stageId: targetCol })
      } catch {
        setDeals(prev)
      }
    } else if (type === "task") {
      const prev = tasks
      const isDoneCol = /done/i.test(targetCol)
      setTasks(curr => curr.map(t => t.id === idToUpdate ? { ...t, status: targetCol, done: isDoneCol } : t))
      try {
        await api.patch(`/tasks/${idToUpdate}`, { status: targetCol, done: isDoneCol })
      } catch {
        setTasks(prev)
      }
    }
  }

  // Task inline editing
  function openEditTask(task) {
    setEditingTaskId(task.id)
    setTaskForm({
      title: task.title,
      dueDate: task.dueDate.slice(0, 10),
      type: task.type,
      related: task.related || "",
      ownerId: task.ownerId || user.id,
      status: task.status || taskStatuses[0]?.name || "",
      priority: task.priority || "MEDIUM",
      description: task.description || "",
    })
    setTaskError("")
    setTaskModalOpen(true)
  }

  async function handleTaskSubmit(e) {
    e.preventDefault()
    setTaskError("")
    try {
      const updated = await api.patch(`/tasks/${editingTaskId}`, taskForm)
      setTasks(prev => prev.map(t => t.id === editingTaskId ? updated : t))
      setTaskModalOpen(false)
    } catch (err) {
      setTaskError(err.message)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (!leadQuery) return true
      const term = leadQuery.toLowerCase()
      return `${l.firstName} ${l.lastName}`.toLowerCase().includes(term) || (l.company && l.company.toLowerCase().includes(term))
    })
  }, [leads, leadQuery])

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (!dealQuery) return true
      const term = dealQuery.toLowerCase()
      return d.name.toLowerCase().includes(term) || (d.account && d.account.name.toLowerCase().includes(term))
    })
  }, [deals, dealQuery])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!taskQuery) return true
      const term = taskQuery.toLowerCase()
      return t.title.toLowerCase().includes(term) || (t.related && t.related.toLowerCase().includes(term))
    })
  }, [tasks, taskQuery])

  if (loading || !event) {
    return (
      <>
        <Topbar title="Event Project Workspace" />
        <div className={styles.uLoadingCenter}>Loading campaign dashboard...</div>
      </>
    )
  }

  // Stats
  const pipelineVal = deals.filter(d => d.status === "OPEN").reduce((sum, d) => sum + d.value, 0)
  const wonVal = deals.filter(d => d.status === "WON").reduce((sum, d) => sum + d.value, 0)
  const pendingTasksCount = tasks.filter(t => !t.done).length

  return (
    <>
      <Topbar
        title={`Event Project: ${event.name}`}
        subtitle={<><MdOutlineLocationOn size={14} /> {event.location || "Online"} · <MdOutlineEvent size={14} /> {formatDate(event.date)}</>}
        action={
          <button className={`${styles.addBtn} ${styles.uBackBtn}`} onClick={() => navigate("/events")}>
            <MdArrowBack size={15} /> Back to Directory
          </button>
        }
      />

      <div className={styles.uPageWrap}>
        
        {/* INTERACTIVE STATS OVERVIEW CARDS */}
        <div className={styles.uStatsGrid}>
          <div className={styles.uStatCard} onClick={() => setPageTab("attendees")}>
            <span className={styles.uStatLabel}>Attendees & Follow-up</span>
            <span className={`${styles.uStatValue} ${styles.uStatValueAccent}`}>{leads.length}</span>
          </div>
          <div className={styles.uStatCard} onClick={() => setPageTab("leads")}>
            <span className={styles.uStatLabel}>Captured Leads</span>
            <span className={`${styles.uStatValue} ${styles.uStatValueBlue}`}>{leads.length}</span>
          </div>
          <div className={styles.uStatCard} onClick={() => setPageTab("deals")}>
            <span className={styles.uStatLabel}>Open Pipeline Value</span>
            <span className={`${styles.uStatValue} ${styles.uStatValueBlue}`}>{formatCurrency(pipelineVal)}</span>
          </div>
          <div className={styles.uStatCard} onClick={() => setPageTab("deals")}>
            <span className={styles.uStatLabel}>Won Revenue</span>
            <span className={`${styles.uStatValue} ${styles.uStatValueGreen}`}>{formatCurrency(wonVal)}</span>
          </div>
          <div className={styles.uStatCard} onClick={() => setPageTab("tasks")}>
            <span className={styles.uStatLabel}>Pending Tasks</span>
            <span className={`${styles.uStatValue} ${styles.uStatValueYellow}`}>{pendingTasksCount}</span>
          </div>
        </div>

        {/* UNIFIED 5-TAB WORKSPACE NAVIGATION */}
        <div className={styles.pageTabs}>
          <button
            type="button"
            className={`${styles.pageTabBtn} ${pageTab === "attendees" ? styles.pageTabActive : ""}`}
            onClick={() => setPageTab("attendees")}
          >
            <MdOutlineGroups size={16} /> Attendees & Follow-ups
            <span className={styles.pageTabBadge}>{leads.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.pageTabBtn} ${pageTab === "leads" ? styles.pageTabActive : ""}`}
            onClick={() => setPageTab("leads")}
          >
            <MdOutlineDescription size={16} /> Captured Leads
            <span className={styles.pageTabBadge}>{leads.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.pageTabBtn} ${pageTab === "deals" ? styles.pageTabActive : ""}`}
            onClick={() => setPageTab("deals")}
          >
            <MdOutlineAttachMoney size={16} /> Deals Pipeline
            <span className={styles.pageTabBadge}>{deals.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.pageTabBtn} ${pageTab === "tasks" ? styles.pageTabActive : ""}`}
            onClick={() => setPageTab("tasks")}
          >
            <MdOutlineChecklist size={16} /> Follow-up Tasks
            <span className={styles.pageTabBadge}>{tasks.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.pageTabBtn} ${pageTab === "overview" ? styles.pageTabActive : ""}`}
            onClick={() => setPageTab("overview")}
          >
            <MdOutlineEmojiEvents size={16} /> Event ROI & Summary
          </button>
        </div>

        {/* TAB 1: ATTENDEES & FOLLOW-UPS */}
        {pageTab === "attendees" && (
          <EventAttendees eventId={id} leads={leads} onLeadCreated={loadAll} />
        )}

        {/* TAB 2: CAPTURED LEADS WORKSPACE */}
        {pageTab === "leads" && (
          <div>
            <div className={pageStyles.toolbarRow}>
              <div className={pageStyles.searchBarWrap}>
                <input
                  className={styles.uFilterInput}
                  placeholder="Filter captured leads in this event..."
                  value={leadQuery}
                  onChange={(e) => setLeadQuery(e.target.value)}
                />
              </div>
              <div className={pageStyles.layoutToggleGroup}>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${leadLayout === "BOARD" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setLeadLayout("BOARD")}
                >
                  Board (Kanban)
                </button>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${leadLayout === "TABLE" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setLeadLayout("TABLE")}
                >
                  Table (List)
                </button>
              </div>
            </div>

            {leadLayout === "BOARD" ? (
              <div className={styles.uBoardRow}>
                {["NEW", "CONTACTED", "QUALIFYING", "CONVERTED", "DISQUALIFIED"].map(statusCol => {
                  const colLeads = filteredLeads.filter(l => l.status === statusCol)
                  const isOver = overCol === statusCol
                  return (
                    <div
                      key={statusCol}
                      onDragOver={(e) => { e.preventDefault(); setOverCol(statusCol) }}
                      onDragLeave={() => setOverCol(null)}
                      onDrop={() => handleDrop(statusCol)}
                      className={`${styles.uKanbanCol} ${isOver ? styles.uKanbanColOver : styles.uKanbanColDefault}`}
                    >
                      <div className={styles.uCardHeaderRow}>
                        <span className={styles.uCardTitleBare}>{statusCol}</span>
                        <span className={styles.uCountPill}>{colLeads.length}</span>
                      </div>
                      <div className={styles.uColumnBody}>
                        {colLeads.map(l => (
                          <div
                            key={l.id}
                            draggable={hasPermission("leads.edit")}
                            onDragStart={() => { setDragId(l.id); setDragType("lead") }}
                            onDragEnd={() => { setDragId(null); setDragType(null) }}
                            onClick={() => setDetailLeadId(l.id)}
                            className={styles.uDraggableCard}
                          >
                            <h5 className={styles.uCardTitle}>{l.firstName} {l.lastName}</h5>
                            <span className={styles.uMutedXs}>{l.company || "No Company"}</span>
                            <div className={styles.uRowWrapTight}>
                              {l.clientType && <Badge tone="neutral" className={styles.uTextXs}>{l.clientType.name}</Badge>}
                              {(l.products || []).length > 0
                                ? l.products.map((lp) => <Badge key={lp.id} tone="progress" className={styles.uTextXs}>{lp.product?.name}</Badge>)
                                : l.product && <Badge tone="progress" className={styles.uTextXs}>{l.product.name}</Badge>}
                            </div>
                            <div className={styles.uCardFooter}>
                              <span className={styles.uMutedSm}>{l.email}</span>
                              <Avatar name={l.owner?.name} color={l.owner?.color} size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.uCardWrap}>
                <table className={styles.uTable}>
                  <thead>
                    <tr className={styles.uTheadRow}>
                      <th className={styles.uThHead}>Lead Name</th>
                      <th className={styles.uThHead}>Company</th>
                      <th className={styles.uThHead}>Email / Phone</th>
                      <th className={styles.uThHead}>Status</th>
                      <th className={styles.uThHead}>Type / Product</th>
                      <th className={styles.uThHead}>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.uEmptyCell}>No leads captured from this event.</td>
                      </tr>
                    ) : (
                      filteredLeads.map(l => (
                        <tr
                          key={l.id}
                          onClick={() => setDetailLeadId(l.id)}
                          className={styles.uHoverRow}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <td className={styles.uCellPadMd}>{l.firstName} {l.lastName}</td>
                          <td className={styles.uCellPadMd}>{l.company || "—"}</td>
                          <td className={styles.uCellPadMd}>{l.email} {l.phone && `· ${l.phone}`}</td>
                          <td className={styles.uCellPad}>
                            <Badge tone={LEAD_STATUS_TONE[l.status] || "neutral"}>{l.status}</Badge>
                          </td>
                          <td className={styles.uCellPad}>
                            <div className={styles.uRowGap25}>
                              {l.clientType && <Badge tone="neutral">{l.clientType.name}</Badge>}
                              {(l.products || []).length > 0
                                ? l.products.map((lp) => <Badge key={lp.id} tone="progress">{lp.product?.name}</Badge>)
                                : l.product && <Badge tone="progress">{l.product.name}</Badge>}
                            </div>
                          </td>
                          <td className={styles.uCellPad}>
                            <div className={styles.uInlineFlex}>
                              <Avatar name={l.owner?.name} color={l.owner?.color} size={18} />
                              <span>{l.owner?.name}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEALS PIPELINE WORKSPACE */}
        {pageTab === "deals" && (
          <div>
            <div className={pageStyles.toolbarRow}>
              <div className={pageStyles.searchBarWrap}>
                <input
                  className={styles.uFilterInput}
                  placeholder="Filter deals in this event..."
                  value={dealQuery}
                  onChange={(e) => setDealQuery(e.target.value)}
                />
              </div>
              <div className={pageStyles.layoutToggleGroup}>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${dealLayout === "BOARD" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setDealLayout("BOARD")}
                >
                  Board (Kanban)
                </button>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${dealLayout === "TABLE" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setDealLayout("TABLE")}
                >
                  Table (List)
                </button>
              </div>
            </div>

            {dealLayout === "BOARD" ? (
              <div className={styles.uBoardRow}>
                {stages.map(stage => {
                  const stageDeals = filteredDeals.filter(d => d.stageId === stage.id && d.status !== "LOST")
                  const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0)
                  const isOver = overCol === stage.id

                  return (
                    <div
                      key={stage.id}
                      onDragOver={(e) => { e.preventDefault(); setOverCol(stage.id) }}
                      onDragLeave={() => setOverCol(null)}
                      onDrop={() => handleDrop(stage.id)}
                      className={`${styles.uKanbanCol} ${isOver ? styles.uKanbanColOver : styles.uKanbanColDefault}`}
                    >
                      <div className={styles.uCardHeaderRow}>
                        <div className={styles.uFlexGap35}>
                          <span className={`${styles.stageDot} ${styles[DEAL_STAGE_DOT_CLASS[stage.name] || "dot_default"]} ${styles.uDot8}`} />
                          <span className={styles.uCardTitleBare}>{stage.name}</span>
                        </div>
                        <span className={styles.uCountPill}>{stageDeals.length}</span>
                      </div>
                      <div className={styles.uStageTotal}>
                        {formatCurrency(stageTotal)}
                      </div>
                      <div className={styles.uColumnBody}>
                        {stageDeals.map(d => (
                          <div
                            key={d.id}
                            draggable={hasPermission("deals.edit")}
                            onDragStart={() => { setDragId(d.id); setDragType("deal") }}
                            onDragEnd={() => { setDragId(null); setDragType(null) }}
                            onClick={() => setDetailDealId(d.id)}
                            className={styles.uDraggableCard}
                          >
                            <h5 className={styles.uCardTitle}>{d.name}</h5>
                            <span className={styles.uMutedXs}>{d.account?.name || "—"}</span>
                            <div className={styles.uRowWrapTight}>
                              {d.clientType && <Badge tone="neutral" className={styles.uTextXs}>{d.clientType.name}</Badge>}
                              {(d.products || []).length > 0
                                ? d.products.map((dp) => <Badge key={dp.id} tone="progress" className={styles.uTextXs}>{dp.product?.name}</Badge>)
                                : d.product && <Badge tone="progress" className={styles.uTextXs}>{d.product.name}</Badge>}
                            </div>
                            <div className={styles.uCardFooter}>
                              <span className={styles.uValueSm}>{formatCurrency(d.value)}</span>
                              <Avatar name={d.owner?.name} color={d.owner?.color} size={18} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.uCardWrap}>
                <table className={styles.uTable}>
                  <thead>
                    <tr className={styles.uTheadRow}>
                      <th className={styles.uThHead}>Deal Name</th>
                      <th className={styles.uThHead}>Company</th>
                      <th className={styles.uThHead}>Value</th>
                      <th className={styles.uThHead}>Stage</th>
                      <th className={styles.uThHead}>Close Date</th>
                      <th className={styles.uThHead}>Client Type / Product</th>
                      <th className={styles.uThHead}>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.uEmptyCell}>No deals generated from this event.</td>
                      </tr>
                    ) : (
                      filteredDeals.map(d => (
                        <tr
                          key={d.id}
                          onClick={() => setDetailDealId(d.id)}
                          className={styles.uHoverRow}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <td className={styles.uCellPadMd}>{d.name}</td>
                          <td className={styles.uCellPadMd}>{d.account?.name || "—"}</td>
                          <td className={styles.uCellPadSemibold}>{formatCurrency(d.value)}</td>
                          <td className={styles.uCellPad}>
                            <span className={styles.uStageBadge}>
                              <span className={`${styles.stageDot} ${styles[DEAL_STAGE_DOT_CLASS[d.stage?.name] || "dot_default"]} ${styles.uDot8}`} />
                              {d.stage?.name}
                            </span>
                          </td>
                          <td className={styles.uCellPadMd}>{formatDate(d.expectedCloseDate)}</td>
                          <td className={styles.uCellPad}>
                            <div className={styles.uRowGap25}>
                              {d.clientType && <Badge tone="neutral">{d.clientType.name}</Badge>}
                              {(d.products || []).length > 0
                                ? d.products.map((dp) => <Badge key={dp.id} tone="progress">{dp.product?.name}</Badge>)
                                : d.product && <Badge tone="progress">{d.product.name}</Badge>}
                            </div>
                          </td>
                          <td className={styles.uCellPad}>
                            <div className={styles.uInlineFlex}>
                              <Avatar name={d.owner?.name} color={d.owner?.color} size={18} />
                              <span>{d.owner?.name}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TASKS WORKSPACE */}
        {pageTab === "tasks" && (
          <div>
            <div className={pageStyles.toolbarRow}>
              <div className={pageStyles.searchBarWrap}>
                <input
                  className={styles.uFilterInput}
                  placeholder="Filter tasks in this event..."
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                />
              </div>
              <div className={pageStyles.layoutToggleGroup}>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${taskLayout === "BOARD" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setTaskLayout("BOARD")}
                >
                  Board (Kanban)
                </button>
                <button
                  type="button"
                  className={`${pageStyles.layoutToggleBtn} ${taskLayout === "TABLE" ? pageStyles.layoutToggleBtnActive : ""}`}
                  onClick={() => setTaskLayout("TABLE")}
                >
                  Table (List)
                </button>
              </div>
            </div>

            {taskLayout === "BOARD" ? (
              <div className={styles.uBoardRow}>
                {taskStatuses.map((statusObj) => {
                  const statusCol = statusObj.name
                  const knownNames = new Set(taskStatuses.map(s => s.name))
                  const colTasks = filteredTasks.filter(t => (knownNames.has(t.status) ? t.status : taskStatuses[0]?.name) === statusCol)
                  const isOver = overCol === statusCol
                  const StatusIcon = /done/i.test(statusCol) ? MdCheckCircle : /progress/i.test(statusCol) ? MdOutlineBolt : /block/i.test(statusCol) ? MdOutlineBlock : MdOutlineChecklist
                  return (
                    <div
                      key={statusObj.id}
                      onDragOver={(e) => { e.preventDefault(); setOverCol(statusCol) }}
                      onDragLeave={() => setOverCol(null)}
                      onDrop={() => handleDrop(statusCol)}
                      className={`${styles.uKanbanCol} ${isOver ? styles.uKanbanColOver : styles.uKanbanColDefault}`}
                    >
                      <div className={styles.uCardHeaderRow}>
                        <span className={styles.uCardTitleBare}>
                          <StatusIcon size={14} /> {statusCol}
                        </span>
                        <span className={styles.uCountPill}>{colTasks.length}</span>
                      </div>
                      <div className={styles.uColumnBody}>
                        {colTasks.map(t => { const TypeIcon = TYPE_ICON[t.type] || MdOutlineDescription; return (
                          <div
                            key={t.id}
                            draggable={hasPermission("tasks.edit")}
                            onDragStart={() => { setDragId(t.id); setDragType("task") }}
                            onDragEnd={() => { setDragId(null); setDragType(null) }}
                            onClick={() => openEditTask(t)}
                            className={styles.uDraggableCard}
                          >
                            <div className={styles.uRowBetween}>
                              <span className={pageStyles.uPriorityBadge} style={{
                                background: t.priority === "CRITICAL" ? "rgba(239,68,68,0.15)" : t.priority === "HIGH" ? "rgba(245,158,11,0.15)" : t.priority === "MEDIUM" ? "rgba(59,130,246,0.15)" : "var(--bg-hover)",
                                color: t.priority === "CRITICAL" ? "var(--status-red)" : t.priority === "HIGH" ? "var(--status-yellow)" : t.priority === "MEDIUM" ? "var(--brand-blue)" : "var(--text-secondary)"
                              }}>
                                {t.priority || "MEDIUM"}
                              </span>
                              <span className={styles.uDueDateSm}>{formatDate(t.dueDate)}</span>
                            </div>
                            <h5 className={styles.uCardTitle}>{t.title}</h5>
                            {t.related && <p className={styles.uRelatedText}>{t.related}</p>}
                            <div className={styles.uCardFooter}>
                              <span className={styles.uMutedSm}><TypeIcon size={12} /> {t.type}</span>
                              <Avatar name={t.owner?.name} color={t.owner?.color} size={16} />
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.uCardWrap}>
                <table className={styles.uTable}>
                  <thead>
                    <tr className={styles.uTheadRow}>
                      <th className={styles.uThHead}>Task Title</th>
                      <th className={styles.uThHead}>Type</th>
                      <th className={styles.uThHead}>Related Lead/Deal</th>
                      <th className={styles.uThHead}>Priority</th>
                      <th className={styles.uThHead}>Due Date</th>
                      <th className={styles.uThHead}>Status</th>
                      <th className={styles.uThHead}>Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.uEmptyCell}>No tasks pending for this event.</td>
                      </tr>
                    ) : (
                      filteredTasks.map(t => { const TypeIcon = TYPE_ICON[t.type] || MdOutlineDescription; return (
                        <tr
                          key={t.id}
                          onClick={() => openEditTask(t)}
                          className={styles.uHoverRow}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <td className={styles.uCellPadMd}>{t.title}</td>
                          <td className={styles.uCellPadMd}><TypeIcon size={13} /> {t.type}</td>
                          <td className={styles.uCellPadMd}>{t.related || "—"}</td>
                          <td className={styles.uCellPad}>
                            <span className={pageStyles.uPriorityBadge} style={{
                              background: t.priority === "CRITICAL" ? "rgba(239,68,68,0.15)" : t.priority === "HIGH" ? "rgba(245,158,11,0.15)" : t.priority === "MEDIUM" ? "rgba(59,130,246,0.15)" : "var(--bg-hover)",
                              color: t.priority === "CRITICAL" ? "var(--status-red)" : t.priority === "HIGH" ? "var(--status-yellow)" : t.priority === "MEDIUM" ? "var(--brand-blue)" : "var(--text-secondary)"
                            }}>
                              {t.priority}
                            </span>
                          </td>
                          <td className={styles.uCellPadMono}>{formatDate(t.dueDate)}</td>
                          <td className={styles.uCellPad}>
                            <Badge tone={/done/i.test(t.status) ? "won" : /progress/i.test(t.status) ? "progress" : /block/i.test(t.status) ? "lost" : "neutral"}>
                              {t.status}
                            </Badge>
                          </td>
                          <td className={styles.uCellPad}>
                            <div className={styles.uInlineFlex}>
                              <Avatar name={t.owner?.name} color={t.owner?.color} size={18} />
                              <span>{t.owner?.name}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    }))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: EVENT ROI & OVERVIEW */}
        {pageTab === "overview" && (
          <div className={pageStyles.overviewSection}>
            <div className={pageStyles.overviewCardsGrid}>
              <div className={pageStyles.overviewCard}>
                <h4 className={pageStyles.overviewCardTitle}>
                  <MdOutlineEvent size={18} /> Event Project Details
                </h4>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Event Name</span>
                  <span className={pageStyles.overviewValue}>{event.name}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Location / Venue</span>
                  <span className={pageStyles.overviewValue}>{event.location || "Online"}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Event Date</span>
                  <span className={pageStyles.overviewValue}>{formatDate(event.date)}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Project Description</span>
                  <span className={pageStyles.overviewValue}>{event.description || "No description provided."}</span>
                </div>
              </div>

              <div className={pageStyles.overviewCard}>
                <h4 className={pageStyles.overviewCardTitle}>
                  <MdOutlineAttachMoney size={18} /> Financial & Revenue Summary
                </h4>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Open Deals Pipeline</span>
                  <span className={pageStyles.overviewValue} style={{ color: "var(--primary)" }}>{formatCurrency(pipelineVal)}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Closed Won Revenue</span>
                  <span className={pageStyles.overviewValue} style={{ color: "var(--success)" }}>{formatCurrency(wonVal)}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Total Generated Value</span>
                  <span className={pageStyles.overviewValue}>{formatCurrency(pipelineVal + wonVal)}</span>
                </div>
                <div className={pageStyles.overviewRow}>
                  <span className={pageStyles.overviewLabel}>Pending Action Items</span>
                  <span className={pageStyles.overviewValue}>{pendingTasksCount} tasks</span>
                </div>
              </div>
            </div>

            <div className={pageStyles.overviewCard}>
              <h4 className={pageStyles.overviewCardTitle}>
                <MdOutlineEmojiEvents size={18} /> Event Lead Conversion Funnel
              </h4>
              <div className={pageStyles.funnelGrid}>
                <div className={pageStyles.funnelStep}>
                  <span className={pageStyles.funnelStepValue}>{leads.length}</span>
                  <span className={pageStyles.funnelStepLabel}>1. Captured Leads</span>
                </div>
                <div className={pageStyles.funnelStep}>
                  <span className={pageStyles.funnelStepValue}>{leads.filter(l => l.status === "QUALIFYING" || l.status === "CONVERTED").length}</span>
                  <span className={pageStyles.funnelStepLabel}>2. Qualified Leads</span>
                </div>
                <div className={pageStyles.funnelStep}>
                  <span className={pageStyles.funnelStepValue}>{deals.length}</span>
                  <span className={pageStyles.funnelStepLabel}>3. Deals Pipeline</span>
                </div>
                <div className={pageStyles.funnelStep}>
                  <span className={pageStyles.funnelStepValue}>{deals.filter(d => d.status === "WON").length}</span>
                  <span className={pageStyles.funnelStepLabel}>4. Won Deals</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LEAD DETAILS DRAWER MODAL */}
      <LeadDetail
        leadId={detailLeadId}
        clientTypes={clientTypes}
        products={products}
        events={[event]}
        customFields={customFields.filter(f => f.entityType === "LEAD")}
        onClose={() => setDetailLeadId(null)}
        onChanged={loadAll}
      />

      {/* DEAL DETAILS DRAWER MODAL */}
      <DealDetail
        dealId={detailDealId}
        pipeline={{ id: "main-pipeline", stages }}
        clientTypes={clientTypes}
        products={products}
        events={[event]}
        customFields={customFields.filter(f => f.entityType === "DEAL")}
        onClose={() => setDetailDealId(null)}
        onChanged={loadAll}
      />

      {/* TASK EDIT MODAL */}
      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Edit Task Notes">
        <form onSubmit={handleTaskSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={modalStyles.field}>
            <label>Task Title</label>
            <input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Due Date</label>
              <input required type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            </div>
            <div className={modalStyles.field}>
              <label>Type</label>
              <SearchableSelect
                options={[
                  { id: "TASK", name: "Task" },
                  { id: "CALL", name: "Call" },
                  { id: "EMAIL", name: "Email" },
                  { id: "MEETING", name: "Meeting" },
                ]}
                value={taskForm.type}
                onChange={(v) => setTaskForm({ ...taskForm, type: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>Related to</label>
            <input value={taskForm.related} onChange={(e) => setTaskForm({ ...taskForm, related: e.target.value })} placeholder="e.g. Sonal Gupta" />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>Status</label>
              <SearchableSelect
                options={taskStatuses}
                value={taskForm.status}
                onChange={(v) => setTaskForm({ ...taskForm, status: v })}
                labelKey="name"
                valueKey="name"
              />
            </div>
            <div className={modalStyles.field}>
              <label>Priority</label>
              <SearchableSelect
                options={[
                  { id: "LOW", name: "Low" },
                  { id: "MEDIUM", name: "Medium" },
                  { id: "HIGH", name: "High" },
                  { id: "CRITICAL", name: "Critical" },
                ]}
                value={taskForm.priority}
                onChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                labelKey="name"
                valueKey="id"
              />
            </div>
          </div>
          <div className={modalStyles.field}>
            <label>Description</label>
            <textarea
              value={taskForm.description || ""}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className={modalStyles.field}>
            <label>Assignee</label>
            <SearchableSelect
              options={taskUsers}
              value={taskForm.ownerId}
              onChange={(v) => setTaskForm({ ...taskForm, ownerId: v })}
              labelKey="name"
              valueKey="id"
            />
          </div>
          {taskError && <p className={modalStyles.error}>{taskError}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setTaskModalOpen(false)}>Cancel</button>
            {hasPermission("tasks.edit") && <button type="submit" className={modalStyles.submitBtn}>Save changes</button>}
          </div>
        </form>
      </Modal>
    </>
  )
}

/* SUB-COMPONENTS COPIED FROM LEADS AND DEALS PAGES TO MAINTAIN PERFECT PAGE ISOLATION */

function LeadDetail({ leadId, clientTypes, products, events, customFields, onClose, onChanged }) {
  const { hasPermission } = useAuth()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("details")
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState(null)
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", role: "" })
  const [contactError, setContactError] = useState("")
  const [linkContactId, setLinkContactId] = useState("")
  const [linkContactLabel, setLinkContactLabel] = useState("")

  async function handleLinkContact() {
    if (!linkContactId) return
    try {
      await api.post(`/leads/${leadId}/link-contact`, { contactId: linkContactId })
      setLinkContactId("")
      setLinkContactLabel("")
      loadLead()
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleUnlinkContact(contactId) {
    if (!confirm("Unlink this contact from the lead?")) return
    try {
      await api.delete(`/leads/${leadId}/link-contact/${contactId}`)
      loadLead()
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "Web Form",
    status: "NEW",
    clientTypeId: "",
    productId: "",
    eventId: "",
    customFields: {}
  })

  const leadCustomFields = customFields.filter(f => f.entityType === "LEAD")

  function loadLead() {
    setLoading(true)
    api.get(`/leads/${leadId}`)
      .then((data) => {
        setLead(data)
        setEditForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          company: data.company || "",
          source: data.source || "Web Form",
          status: data.status || "NEW",
          clientTypeId: data.clientTypeId || "",
          productId: data.productId || "",
          eventId: data.eventId || "",
          customFields: data.customFields || {}
        })
      })
      .catch((err) => console.error("Error loading lead", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (leadId) {
      loadLead()
      setActiveTab("details")
      setShowContactForm(false)
    } else {
      setLead(null)
    }
  }, [leadId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await api.patch(`/leads/${leadId}`, {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        company: editForm.company || null,
        source: editForm.source || null,
        status: editForm.status,
        clientTypeId: editForm.clientTypeId || null,
        productId: editForm.productId || null,
        eventId: editForm.eventId || null,
        customFields: editForm.customFields || {}
      })
      await loadLead()
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddContact(e) {
    e.preventDefault()
    setContactError("")
    try {
      if (editingContactId) {
        await api.patch(`/leads/${leadId}/contacts/${editingContactId}`, contactForm)
      } else {
        await api.post(`/leads/${leadId}/contacts`, contactForm)
      }
      setContactForm({ name: "", email: "", phone: "", role: "" })
      setEditingContactId(null)
      setShowContactForm(false)
      loadLead()
      onChanged()
    } catch (err) {
      setContactError(err.message)
    }
  }

  async function handleDeleteContact(contactId) {
    if (!confirm("Are you sure you want to delete this contact person?")) return
    try {
      await api.delete(`/leads/${leadId}/contacts/${contactId}`)
      loadLead()
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  function startEditContact(c) {
    setEditingContactId(c.id)
    setContactForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      role: c.role || "",
    })
    setShowContactForm(true)
  }

  if (!leadId) return null

  return (
    <SliderDialog open={!!leadId} onClose={onClose} title={lead ? `Lead: ${lead.firstName} ${lead.lastName}` : "Lead Details"} width="min(34rem, 100vw)">
      {loading || !lead ? (
        <p className={styles.uLoadingP2}>Loading details…</p>
      ) : (
        <div className={`${modalStyles.body} ${styles.uModalBodyCol}`}>
          <div className={styles.uRowWrap}>
            <Badge tone={LEAD_STATUS_TONE[lead.status] || "neutral"}>{lead.status}</Badge>
            {lead.clientType && <Badge tone="neutral">{lead.clientType.name}</Badge>}
            {(lead.products || []).length > 0
              ? lead.products.map((lp) => <Badge key={lp.id} tone="neutral">{lp.product?.name}</Badge>)
              : lead.product && <Badge tone="neutral">{lead.product.name}</Badge>}
          </div>

          <div className={styles.uTabRow}>
            <button
              onClick={() => setActiveTab("details")}
              className={`${styles.uTabBtn} ${activeTab === "details" ? styles.uTabBtnActive : ""}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`${styles.uTabBtn} ${activeTab === "contacts" ? styles.uTabBtnActive : ""}`}
            >
              Contact Persons ({lead.contacts?.length || 0})
            </button>
          </div>

          {activeTab === "details" && (
            <form onSubmit={handleSave} className={styles.uColGap1}>
              <div className={styles.uGrid2}>
                <div className={modalStyles.field}>
                  <label>Lead Name</label>
                  <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Company</label>
                  <input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Phone</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Client Type</label>
                  <SearchableSelect
                    options={clientTypes}
                    value={editForm.clientTypeId}
                    onChange={(v) => setEditForm({ ...editForm, clientTypeId: v })}
                    labelKey="name"
                    valueKey="id"
                    placeholder="Select Client Type"
                  />
                </div>
                <div className={modalStyles.field}>
                  <label>Product Interest</label>
                  <SearchableSelect
                    options={products}
                    value={editForm.productId}
                    onChange={(v) => setEditForm({ ...editForm, productId: v })}
                    labelKey="name"
                    valueKey="id"
                    placeholder="Select Product"
                  />
                </div>
              </div>

              {leadCustomFields.length > 0 && (
                <div className={styles.uCustomAttrsWrap}>
                  <h5 className={styles.uSectionTitleSm2}>Custom Attributes</h5>
                  <div className={styles.uGrid2Tight}>
                    {leadCustomFields.map((f) => {
                      let parsedOptions = []
                      try {
                        if (f.options) parsedOptions = JSON.parse(f.options)
                      } catch (e) {}

                      return (
                        <div key={f.id} className={modalStyles.field}>
                          <label>{f.label} {f.required && <span className={styles.uDanger}>*</span>}</label>
                          {f.type === "SELECT" ? (
                            <SearchableSelect
                              options={parsedOptions.map(opt => ({ id: opt, name: opt }))}
                              value={editForm.customFields?.[f.id] || ""}
                              onChange={(v) => setEditForm({
                                ...editForm,
                                customFields: { ...editForm.customFields, [f.id]: v }
                              })}
                              labelKey="name"
                              valueKey="id"
                              placeholder="Select Option"
                            />
                          ) : (
                            <input
                              required={f.required}
                              type={f.type === "NUMBER" ? "number" : "text"}
                              value={editForm.customFields?.[f.id] || ""}
                              onChange={(e) => setEditForm({
                                ...editForm,
                                customFields: { ...editForm.customFields, [f.id]: e.target.value }
                              })}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {error && <div className={styles.uErrorText}>{error}</div>}
              
              <div className={styles.uActionsEnd}>
                {hasPermission("leads.edit") && (
                  <button type="submit" className={modalStyles.submitBtn} disabled={saving}>
                    {saving ? "Saving…" : "Save Details"}
                  </button>
                )}
              </div>
            </form>
          )}

          {activeTab === "contacts" && (
            <div className={styles.uColGap1}>
              <div>
                <h5 className={styles.uSectionTitleSm2}>Linked CRM Contacts ({lead.contactLinks?.length || 0})</h5>
                {hasPermission("leads.edit") && (
                  <div className={styles.uLinkRow}>
                    <div className={styles.uFlex1}>
                      <AsyncSelect
                        fetchOptions={fetchContactOptions}
                        value={linkContactId}
                        selectedLabel={linkContactLabel}
                        onChange={(opt) => { setLinkContactId(opt.value); setLinkContactLabel(opt.label) }}
                        placeholder="Link an existing contact…"
                      />
                    </div>
                    <button
                      onClick={handleLinkContact}
                      disabled={!linkContactId}
                      className={styles.uBtnAccentSm}
                    >
                      Link
                    </button>
                  </div>
                )}
                <div className={styles.uColGapSm}>
                  {(lead.contactLinks || []).length === 0 ? (
                    <p className={styles.uEmptyTextSm}>No linked CRM contacts yet.</p>
                  ) : (
                    lead.contactLinks.map((l) => (
                      <div key={l.id} className={styles.uContactRow}>
                        <div>
                          <div className={styles.uCardTitleBare}>
                            {l.contact.firstName} {l.contact.lastName} {l.isPrimary && <span className={styles.uPrimaryTag}>(primary)</span>}
                          </div>
                          <div className={styles.uMutedSm}>{l.contact.email}</div>
                        </div>
                        {hasPermission("leads.edit") && <button onClick={() => handleUnlinkContact(l.contactId)} className={styles.uDangerLink}>Unlink</button>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`${styles.uRowBetween} ${styles.uBorderTopPad}`}>
                <h5 className={styles.uHeadingSm}>Additional Contact Persons</h5>
                {!showContactForm && hasPermission("leads.edit") && (
                  <button
                    onClick={() => { setContactForm({ name: "", email: "", phone: "", role: "" }); setEditingContactId(null); setShowContactForm(true) }}
                    className={styles.uLinkBtn}
                  >
                    + Add Person
                  </button>
                )}
              </div>

              {showContactForm && (
                <form onSubmit={handleAddContact} className={styles.uFormPanel}>
                  <div className={styles.uFormTitle}>{editingContactId ? "Edit Contact" : "Add Contact"}</div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input required placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Role" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  <div className={`${modalStyles.row} ${styles.uGap2}`}>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className={styles.uInputSm} />
                    </div>
                    <div className={`${modalStyles.field} ${styles.uM0}`}>
                      <input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className={styles.uInputSm} />
                    </div>
                  </div>
                  {contactError && <div className={styles.uErrorTextSm}>{contactError}</div>}
                  <div className={styles.uActionsEndSm}>
                    <button type="button" onClick={() => setShowContactForm(false)} className={styles.uBtnGhostSm}>Cancel</button>
                    <button type="submit" className={styles.uBtnAccentXs}>Save</button>
                  </div>
                </form>
              )}

              <div className={styles.uScrollListSm}>
                {(lead.contacts || []).map((c) => (
                  <div key={c.id} className={styles.uContactRowBg}>
                    <div>
                      <div className={styles.uCardTitleBare}>{c.name} {c.role && <span className={styles.uRoleTag}>({c.role})</span>}</div>
                      <div className={styles.uMutedSm}>{c.email} {c.phone && `· ${c.phone}`}</div>
                    </div>
                    {hasPermission("leads.edit") && (
                      <div className={styles.uRowGap25}>
                        <button onClick={() => startEditContact(c)} className={styles.uEditBtn}>Edit</button>
                        <button onClick={() => handleDeleteContact(c.id)} className={styles.uDangerLink}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SliderDialog>
  )
}

function DealDetail({ dealId, pipeline, clientTypes, products, events, customFields, onClose, onChanged }) {
  const { hasPermission } = useAuth()
  const [deal, setDeal] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", value: "", expectedCloseDate: "", clientTypeId: "", productId: "", eventId: "", customFields: {} })
  const [activityForm, setActivityForm] = useState({ type: "NOTE", notes: "" })
  const [lostReason, setLostReason] = useState("")
  const [showLostForm, setShowLostForm] = useState(false)
  const [detailTab, setDetailTab] = useState("details")

  useEffect(() => {
    if (!dealId) {
      setDeal(null)
      return
    }
    setDetailTab("details")
    setError("")
    api.get(`/deals/${dealId}`).then((d) => {
      setDeal(d)
      setEditForm({
        name: d.name,
        value: d.value,
        expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "",
        clientTypeId: d.clientTypeId || "",
        productId: d.productId || "",
        eventId: d.eventId || "",
        customFields: d.customFields || {},
      })
    })
  }, [dealId])

  async function refreshDeal() {
    const d = await api.get(`/deals/${dealId}`)
    setDeal(d)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await api.patch(`/deals/${dealId}`, {
        name: editForm.name,
        value: Number(editForm.value) || 0,
        expectedCloseDate: editForm.expectedCloseDate || undefined,
        clientTypeId: editForm.clientTypeId || null,
        productId: editForm.productId || null,
        eventId: editForm.eventId || null,
        customFields: editForm.customFields || {},
      })
      await refreshDeal()
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClose(status) {
    if (status === "LOST" && !showLostForm) {
      setShowLostForm(true)
      return
    }
    setSaving(true)
    setError("")
    try {
      await api.patch(`/deals/${dealId}/close`, { status, lostReason: status === "LOST" ? lostReason : undefined })
      if (status === "WON") {
        const wonStage = pipeline.stages.find((s) => s.name === "Won")
        if (wonStage && wonStage.id !== deal.stageId) {
          await api.patch(`/deals/${dealId}/stage`, { stageId: wonStage.id })
        }
      }
      await refreshDeal()
      await onChanged()
      setShowLostForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete deal "${deal.name}"? This can't be undone.`)) return
    await api.delete(`/deals/${dealId}`)
    await onChanged()
    onClose()
  }

  async function handleLogActivity(e) {
    e.preventDefault()
    if (!activityForm.notes.trim()) return
    setSaving(true)
    setError("")
    try {
      await api.post("/activities", { ...activityForm, dealId })
      setActivityForm({ type: "NOTE", notes: "" })
      await refreshDeal()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SliderDialog open={!!dealId} onClose={onClose} title={deal?.name || "Deal Details"} width="min(34rem, 100vw)">
      {!deal ? (
        <p>Loading…</p>
      ) : (
        <div className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={styles.uRowWrap}>
            <span className={pageStyles.uDealStatusBadge} style={{ background: deal.status === "WON" ? "var(--emerald-100)" : deal.status === "LOST" ? "var(--coral-100)" : "var(--gold-100)", color: deal.status === "WON" ? "var(--emerald-700)" : deal.status === "LOST" ? "var(--coral-600)" : "var(--gold-600)" }}>
              {deal.status}
            </span>
            {deal.clientType && <Badge tone="neutral">{deal.clientType.name}</Badge>}
            {(deal.products || []).length > 0
              ? deal.products.map((dp) => <Badge key={dp.id} tone="neutral">{dp.product?.name}</Badge>)
              : deal.product && <Badge tone="neutral">{deal.product.name}</Badge>}
          </div>

          <div className={styles.pageTabs}>
            <button type="button" className={`${styles.pageTabBtn} ${detailTab === "details" ? styles.pageTabActive : ""}`} onClick={() => setDetailTab("details")}>Details</button>
            <button type="button" className={`${styles.pageTabBtn} ${detailTab === "activity" ? styles.pageTabActive : ""}`} onClick={() => setDetailTab("activity")}>Activity ({deal.activities?.length || 0})</button>
          </div>

          {detailTab === "details" && (
          <form onSubmit={handleSave} className={`${modalStyles.body} ${styles.uModalFormTop}`}>
            <div className={modalStyles.field}>
              <label>Deal name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Value (₹)</label>
                <input type="number" min="0" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} />
              </div>
              <div className={modalStyles.field}>
                <label>Expected close</label>
                <input type="date" value={editForm.expectedCloseDate} onChange={(e) => setEditForm({ ...editForm, expectedCloseDate: e.target.value })} />
              </div>
            </div>
            {customFields.filter(f => f.entityType === "DEAL").length > 0 && (
              <div className={styles.uCustomAttrsWrapLg}>
                <h4 className={styles.uHeadingSmMb}>Custom Attributes</h4>
                <div className={styles.uColGap75}>
                  {customFields.filter(f => f.entityType === "DEAL").map((f) => {
                    let parsedOptions = []
                    try {
                      if (f.options) parsedOptions = JSON.parse(f.options)
                    } catch (e) {}

                    return (
                      <div key={f.id} className={modalStyles.field}>
                        <label>{f.label} {f.required && <span className={styles.uDanger}>*</span>}</label>
                        {f.type === "SELECT" ? (
                          <SearchableSelect
                            options={parsedOptions.map(opt => ({ id: opt, name: opt }))}
                            value={editForm.customFields?.[f.id] || ""}
                            onChange={(v) => setEditForm({
                              ...editForm,
                              customFields: { ...editForm.customFields, [f.id]: v }
                            })}
                            labelKey="name"
                            valueKey="id"
                            placeholder="Select Option"
                          />
                        ) : (
                          <input
                            required={f.required}
                            type={f.type === "NUMBER" ? "number" : "text"}
                            value={editForm.customFields?.[f.id] || ""}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              customFields: { ...editForm.customFields, [f.id]: e.target.value }
                            })}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className={`${modalStyles.actions} ${styles.uJustifyBetween}`}>
              {hasPermission("deals.delete") && (
                <button type="button" className={`${modalStyles.rowActionBtnDanger || modalStyles.cancelBtn} ${styles.uDanger}`} onClick={handleDelete}>
                  Delete deal
                </button>
              )}
              {hasPermission("deals.edit") && <button type="submit" className={modalStyles.submitBtn} disabled={saving}>Save</button>}
            </div>
          </form>
          )}

          {detailTab === "details" && deal.status === "OPEN" && hasPermission("deals.close") && (
            <div className={styles.uWonLostRow}>
              <button type="button" className={`${modalStyles.submitBtn} ${styles.uBtnAccentFlex}`} onClick={() => handleClose("WON")} disabled={saving}>
                Mark Won
              </button>
              <button type="button" className={`${modalStyles.cancelBtn} ${styles.uBtnDangerFlex}`} onClick={() => handleClose("LOST")} disabled={saving}>
                Mark Lost
              </button>
            </div>
          )}

          {detailTab === "details" && showLostForm && (
            <div className={modalStyles.field}>
              <label>Lost reason</label>
              <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Went with a competitor" />
              <button type="button" className={`${modalStyles.submitBtn} ${styles.uMt2}`} onClick={() => handleClose("LOST")} disabled={saving}>
                Confirm lost
              </button>
            </div>
          )}

          {detailTab === "activity" && (
          <div className={`${styles.uMt4} ${styles.tabPanelFill}`}>
            {hasPermission("activities.create") && (
              <form onSubmit={handleLogActivity} className={styles.activityLogCard}>
                <div className={styles.activityTypeSegment}>
                  {Object.entries({ NOTE: "Note", CALL: "Call", EMAIL: "Email", MEETING: "Meeting" }).map(([key, label]) => {
                    const Icon = ACTIVITY_TYPE_ICON[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.activityTypeBtn} ${activityForm.type === key ? styles.activityTypeBtnActive : ""}`}
                        onClick={() => setActivityForm({ ...activityForm, type: key })}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    )
                  })}
                </div>
                <div className={styles.activityInputRow}>
                  <input className={styles.activityInput} placeholder="Log an update…" value={activityForm.notes} onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })} />
                  <button type="submit" className={modalStyles.submitBtn} disabled={saving}>Log</button>
                </div>
              </form>
            )}

            {deal.activities?.length === 0 ? (
              <EmptyState type="activity" title="No activity yet" hint="Calls, emails, notes logged on this deal will show up here." className={styles.emptyFill} />
            ) : (
            <ul className={styles.uActivityList}>
              {deal.activities?.map((a) => { const ActivityIcon = ACTIVITY_TYPE_ICON[a.type]; return (
                <li key={a.id} className={styles.uActivityItem}>
                  <span className={styles.activityIconBadge}>{ActivityIcon ? <ActivityIcon size={14} /> : "•"}</span>
                  <div>
                    <p className={styles.uM0}>{a.notes}</p>
                    <span className={styles.uMutedSm}>{a.owner?.name} · {formatDate(a.createdAt)}</span>
                  </div>
                </li>
              )})}
            </ul>
            )}
          </div>
          )}
        </div>
      )}
    </SliderDialog>
  )
}
