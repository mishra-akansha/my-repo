import { useEffect, useMemo, useState, useRef, forwardRef } from "react"
import { useSearchParams } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { MdOutlineViewKanban, MdOutlineViewList, MdOutlineCalendarMonth, MdMoreHoriz, MdAdd, MdOutlineEdit } from "react-icons/md"

const LAYOUT_ICON = { BOARD: MdOutlineViewKanban, TABLE: MdOutlineViewList, CALENDAR: MdOutlineCalendarMonth }

function taskRelatedLabel(task) {
  if (task.lead) return `Lead: ${task.lead.firstName} ${task.lead.lastName}`
  if (task.deal) return `Deal: ${task.deal.name}`
  if (task.account) return `Account: ${task.account.name}`
  return task.related || null
}

import Topbar from "../../components/Layout/Topbar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import TaskDetailModal from "../../components/UI/TaskDetailModal.jsx"
import { api } from "../../api/client.js"
import { formatDate } from "../../lib/format.js"
import { TasksSkeleton } from "../../components/UI/Skeleton.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import CalendarView from "./CalendarView.jsx"
import FilterDrawer, { FilterButton } from "../../components/UI/FilterDrawer.jsx"
import styles from "./Tasks.module.css"

const TYPE_LABEL = { EMAIL: "Email", CALL: "Call", TASK: "Task", MEETING: "Meeting" }
const EMPTY_FORM = { title: "", dueDate: "", type: "TASK", related: "", ownerId: "", status: "", priority: "MEDIUM", description: "", milestoneId: "", labelIds: [], relatedType: "", leadId: "", dealId: "", accountId: "", contactId: "", customFields: {} }

const DEFAULT_VIEWS = [
  { id: "active-kanban", name: "Board", layout: "BOARD", filters: { status: "", priority: "", type: "", ownerId: "", milestoneId: "" } },
  { id: "all-tasks-list", name: "Table", layout: "TABLE", filters: { status: "", priority: "", type: "", ownerId: "", milestoneId: "" } },
  { id: "my-calendar", name: "Calendar", layout: "CALENDAR", filters: { status: "", priority: "", type: "", ownerId: "", milestoneId: "" } },
]

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function Tasks() {
  const { user, hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [milestones, setMilestones] = useState([])
  const [statuses, setStatuses] = useState([])
  const [labels, setLabels] = useState([])
  const [relatedLabel, setRelatedLabel] = useState("")
  const [contactLabel, setContactLabel] = useState("")
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [milestoneStats, setMilestoneStats] = useState(null)
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const debouncedQuery = useDebounce(query, 350)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  // false = opening the task itself — full detail with Discussion/Attachments.
  // true = the explicit "Edit" action — just the editable fields.
  const [editOnly, setEditOnly] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  // View tab definitions (Board/Table/Calendar layouts + filters) are stored server-side
  // per-user via /task-views — matches Salesforce/Zoho List Views persisting across devices
  // instead of living only in this browser's localStorage. Which tab is currently selected
  // stays in localStorage since that's just local UI state, not something worth syncing.
  const [views, setViews] = useState(DEFAULT_VIEWS)
  const [viewsLoaded, setViewsLoaded] = useState(false)
  const seedingViewsRef = useRef(false)
  const [activeViewId, setActiveViewId] = useState(() => localStorage.getItem("sales_crm_task_active_view") || DEFAULT_VIEWS[0].id)
  const [editingTabId, setEditingTabId] = useState(null)
  const [tabRenameVal, setTabRenameVal] = useState("")
  const [activeMenuId, setActiveMenuId] = useState(null)

  useEffect(() => {
    api.get("/task-views").then(async (serverViews) => {
      if (serverViews.length === 0) {
        // First time this user has opened Tasks — seed their default tabs server-side.
        // Guarded by a ref (not state) because React StrictMode double-invokes this effect
        // in dev, and both invocations would otherwise see an empty list and both POST the
        // 3 defaults before either finishes — the exact "duplicate view tabs" bug users hit.
        if (seedingViewsRef.current) return
        seedingViewsRef.current = true
        const created = await Promise.all(
          DEFAULT_VIEWS.map((v, i) => api.post("/task-views", { name: v.name, layout: v.layout, filters: v.filters, order: i }))
        )
        setViews(created)
        setActiveViewId(created[0].id)
      } else {
        setViews(serverViews)
        if (!serverViews.some((v) => v.id === activeViewId)) setActiveViewId(serverViews[0].id)
      }
      setViewsLoaded(true)
    }).catch((err) => {
      console.error("Failed to load task views, falling back to defaults", err)
      setViewsLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem("sales_crm_task_active_view", activeViewId)
  }, [activeViewId])

  useEffect(() => {
    api.get("/users").then(setUsers).catch(console.error)
    api.get("/milestones").then(setMilestones).catch(console.error)
    api.get("/labels").then(setLabels).catch(console.error)
    // Statuses are configured in Settings > Task Boards (TaskStatus model) — the Kanban
    // view below renders these directly instead of a hardcoded status list, so
    // renaming/adding/removing a status there actually shows up here.
    api.get("/task-statuses").then(setStatuses).catch(console.error)
    api.get("/custom-fields").then((list) => setCustomFieldDefs(list.filter((f) => f.entityType === "TASK"))).catch(() => {})
  }, [])

  useEffect(() => {
    function refetchStatuses() {
      api.get("/task-statuses").then(setStatuses).catch(console.error)
    }
    window.addEventListener("focus", refetchStatuses)
    return () => window.removeEventListener("focus", refetchStatuses)
  }, [])

  const activeView = views.find((view) => view.id === activeViewId) || views[0] || DEFAULT_VIEWS[0]

  const extraParams = useMemo(() => {
    const params = {}
    if (debouncedQuery) params.search = debouncedQuery
    if (activeView.filters.status) params.status = activeView.filters.status
    if (activeView.filters.priority) params.priority = activeView.filters.priority
    if (activeView.filters.type) params.type = activeView.filters.type
    if (activeView.filters.ownerId) params.ownerId = activeView.filters.ownerId
    if (activeView.filters.milestoneId) params.milestoneId = activeView.filters.milestoneId
    return params
  }, [debouncedQuery, activeView])

  const {
    data: tasks,
    loading,
    hasMore,
    reload,
    lastElementRef,
    setData: setTasks,
  } = useInfiniteScroll("/tasks", 50, extraParams)

  const pendingCount = tasks.filter((task) => !task.done).length
  const doneCount = tasks.filter((task) => task.done).length
  const hasActiveFilters = activeView.filters.status || activeView.filters.priority || activeView.filters.type || activeView.filters.ownerId || activeView.filters.milestoneId || query
  const activeFilterCount = ["status", "priority", "type", "ownerId", "milestoneId"].filter((k) => activeView.filters[k]).length

  async function quickUpdate(id, field, value) {
    const previous = tasks
    setTasks((current) => current.map((task) => task.id === id ? { ...task, [field]: value } : task))
    try {
      await api.patch(`/tasks/${id}`, { [field]: value })
    } catch (err) {
      setTasks(previous)
      setError(err.message)
    }
  }

  async function toggle(id, done) {
    setTasks((prev) => prev.map((task) => task.id === id ? { ...task, done: !done } : task))
    try {
      const updated = await api.patch(`/tasks/${id}`, { done: !done })
      setTasks((prev) => prev.map((task) => task.id === id ? updated : task))
    } catch {
      setTasks((prev) => prev.map((task) => task.id === id ? { ...task, done } : task))
    }
  }

  async function handleTaskDrop(statusName) {
    if (!dragId) return
    const taskId = dragId
    setDragId(null)
    setOverCol(null)
    const previous = tasks
    const isDoneStatus = /done/i.test(statusName)
    const siblingCount = tasks.filter((t) => t.status === statusName).length
    setTasks((current) => current.map((task) => task.id === taskId
      ? { ...task, status: statusName, done: isDoneStatus }
      : task))
    try {
      await api.patch(`/tasks/${taskId}/move`, { status: statusName, order: siblingCount })
    } catch (err) {
      setTasks(previous)
      setError(err.message)
    }
  }

  function openCreate() {
    setEditingId(null)
    setEditOnly(false)
    setForm({ ...EMPTY_FORM, ownerId: user.id, status: statuses[0]?.name || "" })
    setRelatedLabel("")
    setContactLabel("")
    setError("")
    setModalOpen(true)
  }

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateForDate(dateStr) {
    setEditingId(null)
    setEditOnly(false)
    setForm({ ...EMPTY_FORM, dueDate: dateStr, ownerId: user.id, status: statuses[0]?.name || "" })
    setRelatedLabel("")
    setContactLabel("")
    setError("")
    setModalOpen(true)
  }

  function openEdit(task, { editOnly: openAsEditOnly = false } = {}) {
    setEditingId(task.id)
    setEditOnly(openAsEditOnly)
    const relatedType = task.leadId ? "LEAD" : task.dealId ? "DEAL" : task.accountId ? "ACCOUNT" : ""
    setForm({
      title: task.title,
      dueDate: task.dueDate.slice(0, 10),
      type: task.type,
      related: task.related || "",
      ownerId: task.ownerId || task.owner?.id || user.id,
      status: task.status || statuses[0]?.name || "",
      priority: task.priority || "MEDIUM",
      description: task.description || "",
      milestoneId: task.milestoneId || "",
      labelIds: (task.labels || []).map((l) => l.labelId),
      relatedType,
      leadId: task.leadId || "",
      dealId: task.dealId || "",
      accountId: task.accountId || "",
      contactId: task.contactId || "",
      customFields: {},
    })
    setRelatedLabel(task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : task.deal?.name || task.account?.name || "")
    setContactLabel(task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : "")
    setError("")
    setModalOpen(true)
    api.get(`/tasks/${task.id}`).then((full) => {
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    }).catch((err) => console.error("Failed to load task custom fields", err))
  }

  async function handleDelete(task) {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return
    await api.delete(`/tasks/${task.id}`)
    setTasks((prev) => prev.filter((item) => item.id !== task.id))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        dueDate: form.dueDate,
        type: form.type,
        related: form.related,
        ownerId: form.ownerId || user.id,
        status: form.status,
        priority: form.priority,
        description: form.description,
        milestoneId: form.milestoneId || null,
        labelIds: form.labelIds || [],
        leadId: form.relatedType === "LEAD" ? (form.leadId || null) : null,
        dealId: form.relatedType === "DEAL" ? (form.dealId || null) : null,
        accountId: form.relatedType === "ACCOUNT" ? (form.accountId || null) : null,
        contactId: form.contactId || null,
        customFields: form.customFields || {},
      }
      if (editingId) {
        const updated = await api.patch(`/tasks/${editingId}`, payload)
        setTasks((prev) => prev.map((task) => task.id === editingId ? updated : task))
      } else {
        await api.post("/tasks", payload)
        await reload()
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddView() {
    const boardCount = views.filter((v) => v.layout === "BOARD").length
    const filters = { status: "", priority: "", type: "", ownerId: "", milestoneId: "" }
    const name = `Board ${boardCount + 1}`
    try {
      const created = await api.post("/task-views", { name, layout: "BOARD", filters, order: views.length })
      setViews((prev) => [...prev, created])
      setActiveViewId(created.id)
      setActiveMenuId(created.id)
    } catch (err) {
      setError(err.message)
    }
  }

  function startRename(view) {
    setEditingTabId(view.id)
    setTabRenameVal(view.name)
  }

  async function saveRename(id) {
    const name = tabRenameVal || views.find((v) => v.id === id)?.name
    setViews((prev) => prev.map((view) => view.id === id ? { ...view, name } : view))
    setEditingTabId(null)
    await api.patch(`/task-views/${id}`, { name }).catch((err) => setError(err.message))
  }

  async function updateLayout(viewId, layout) {
    setViews((prev) => prev.map((view) => view.id === viewId ? { ...view, layout } : view))
    setActiveMenuId(null)
    await api.patch(`/task-views/${viewId}`, { layout }).catch((err) => setError(err.message))
  }

  async function deleteView(viewId) {
    if (views.length <= 1) return
    const nextViews = views.filter((view) => view.id !== viewId)
    setViews(nextViews)
    if (activeViewId === viewId) setActiveViewId(nextViews[0].id)
    setActiveMenuId(null)
    await api.delete(`/task-views/${viewId}`).catch((err) => setError(err.message))
  }

  async function updateFilter(key, value) {
    const nextFilters = { ...activeView.filters, [key]: value }
    setViews((prev) => prev.map((view) => view.id === activeView.id ? { ...view, filters: nextFilters } : view))
    await api.patch(`/task-views/${activeView.id}`, { filters: nextFilters }).catch((err) => setError(err.message))
  }

  async function clearFilters() {
    const nextFilters = { status: "", priority: "", type: "", ownerId: "", milestoneId: "" }
    setViews((prev) => prev.map((view) => view.id === activeView.id ? { ...view, filters: nextFilters } : view))
    setQuery("")
    await api.patch(`/task-views/${activeView.id}`, { filters: nextFilters }).catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (!activeView.filters.milestoneId) {
      setMilestoneStats(null)
      return
    }
    api.get(`/milestones/${activeView.filters.milestoneId}/stats`).then(setMilestoneStats).catch(() => setMilestoneStats(null))
  }, [activeView.filters.milestoneId, tasks.length])

  return (
    <>
      <Topbar
        title="Tasks"
        subtitle={loading && tasks.length === 0 ? "Loading..." : `${pendingCount} open, ${doneCount} done`}
        action={
          hasPermission("tasks.create") ? (
            <motion.button className={styles.addBtn} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={openCreate}>
              New task
            </motion.button>
          ) : null
        }
      />

      <ViewTabs
        views={views}
        activeViewId={activeViewId}
        editingTabId={editingTabId}
        tabRenameVal={tabRenameVal}
        activeMenuId={activeMenuId}
        setActiveViewId={setActiveViewId}
        setActiveMenuId={setActiveMenuId}
        setTabRenameVal={setTabRenameVal}
        startRename={startRename}
        saveRename={saveRename}
        updateLayout={updateLayout}
        deleteView={deleteView}
        handleAddView={handleAddView}
      />

      <main className={styles.page}>
        <div className={styles.toolbar}>
          <FilterButton open={showFilters} onClick={() => setShowFilters(true)} activeCount={activeFilterCount} />
        </div>

        {milestoneStats && (
          <div className={styles.milestoneBanner}>
            <span className={styles.milestoneBannerTitle}>{milestoneStats.milestone.name}</span>
            <div className={styles.milestoneBannerBar}>
              <div className={styles.milestoneBannerFill} style={{ width: `${milestoneStats.percentComplete}%` }} />
            </div>
            <span className={styles.milestoneBannerStat}>{milestoneStats.done}/{milestoneStats.total} done · {milestoneStats.pending} pending · {milestoneStats.percentComplete}%</span>
          </div>
        )}

        <div className={styles.bodyRow}>
          <div className={styles.leftColumn}>
        {loading && tasks.length === 0 ? (
          <TasksSkeleton />
        ) : activeView.layout === "CALENDAR" ? (
          <CalendarView tasks={tasks} onToggle={toggle} onEdit={openEdit} onCreate={openCreateForDate} />
        ) : activeView.layout === "BOARD" ? (
          <BoardView
            tasks={tasks}
            statuses={statuses}
            overCol={overCol}
            setOverCol={setOverCol}
            setDragId={setDragId}
            handleTaskDrop={handleTaskDrop}
            openEdit={openEdit}
          />
        ) : (
          <div className={styles.list}>
            {tasks.length === 0 ? (
              <EmptyState type="tasks" title="No tasks match this view" hint="Try a different filter, or create a new task to get started." />
            ) : (
              tasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  onToggle={toggle}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onQuickUpdate={quickUpdate}
                  currentUserId={user.id}
                  ref={index === tasks.length - 1 ? lastElementRef : null}
                />
              ))
            )}
            {hasMore && tasks.length > 0 && activeView.layout !== "CALENDAR" && (
              <div ref={lastElementRef} className={styles.loadMore}>
                {loading ? "Loading more..." : "Scroll down to load more..."}
              </div>
            )}
          </div>
        )}
      </div>

          <TaskFilterPanel
            open={showFilters}
            onClose={() => setShowFilters(false)}
            query={query}
            setQuery={setQuery}
            activeView={activeView}
            users={users}
            user={user}
            milestones={milestones}
            statuses={statuses}
            updateFilter={updateFilter}
            clearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>
      </main>

      <TaskDetailModal
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        editingId={editingId}
        editOnly={editOnly}
        onEditOnly={() => setEditOnly(true)}
        form={form}
        setForm={setForm}
        users={users}
        user={user}
        milestones={milestones}
        statuses={statuses}
        labels={labels}
        relatedLabel={relatedLabel}
        setRelatedLabel={setRelatedLabel}
        contactLabel={contactLabel}
        setContactLabel={setContactLabel}
        customFieldDefs={customFieldDefs}
        error={error}
        submitting={submitting}
        handleSubmit={handleSubmit}
      />
    </>
  )
}

function ViewTabs(props) {
  const {
    views,
    activeViewId,
    editingTabId,
    tabRenameVal,
    activeMenuId,
    setActiveViewId,
    setActiveMenuId,
    setTabRenameVal,
    startRename,
    saveRename,
    updateLayout,
    deleteView,
    handleAddView,
  } = props

  const [menuPos, setMenuPos] = useState(null)

  useEffect(() => {
    if (!activeMenuId) return
    function handleOutside() {
      setActiveMenuId(null)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [activeMenuId, setActiveMenuId])

  function openMenu(event, viewId) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setActiveMenuId(activeMenuId === viewId ? null : viewId)
  }

  return (
    <div className={styles.tabsBar}>
      {views.map((view) => {
        const isActive = activeViewId === view.id
        const isEditing = editingTabId === view.id
        const LayoutIcon = LAYOUT_ICON[view.layout] || MdOutlineViewKanban
        return (
          <div key={view.id} className={`${styles.tabItem} ${isActive ? styles.tabActive : ""}`} onClick={() => setActiveViewId(view.id)}>
            <span className={styles.layoutMark}><LayoutIcon size={14} /></span>
            {isEditing ? (
              <input
                className={styles.tabInput}
                value={tabRenameVal}
                onChange={(event) => setTabRenameVal(event.target.value)}
                onBlur={() => saveRename(view.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveRename(view.id)
                  if (event.key === "Escape") saveRename(view.id)
                }}
                autoFocus
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className={styles.tabName} onDoubleClick={(event) => { event.stopPropagation(); startRename(view) }}>{view.name}</span>
            )}
            <button className={styles.tabMenuBtn} onClick={(event) => openMenu(event, view.id)}>
              <MdMoreHoriz size={15} />
            </button>
            {activeMenuId === view.id && menuPos && (
              <div
                className={styles.tabMenu}
                style={{ top: menuPos.top, left: menuPos.left }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button onClick={() => { startRename(view); setActiveMenuId(null) }}>Rename view</button>
                <div className={styles.menuDivider} />
                <span>Layout</span>
                <button className={view.layout === "BOARD" ? styles.menuActive : ""} onClick={() => updateLayout(view.id, "BOARD")}><MdOutlineViewKanban size={14} /> Board</button>
                <button className={view.layout === "TABLE" ? styles.menuActive : ""} onClick={() => updateLayout(view.id, "TABLE")}><MdOutlineViewList size={14} /> Table</button>
                <button className={view.layout === "CALENDAR" ? styles.menuActive : ""} onClick={() => updateLayout(view.id, "CALENDAR")}><MdOutlineCalendarMonth size={14} /> Calendar</button>
                {views.length > 1 && (
                  <>
                    <div className={styles.menuDivider} />
                    <button className={styles.menuDanger} onClick={() => deleteView(view.id)}>Delete view</button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
      <button className={styles.newViewBtn} onClick={handleAddView}><MdAdd size={15} /> New view</button>
    </div>
  )
}

function TaskFilterPanel({ open, onClose, query, setQuery, activeView, users, user, milestones, statuses, updateFilter, clearFilters, activeFilterCount }) {
  const statusOptions = [{ id: "", name: "All statuses" }, ...statuses.map((s) => ({ id: s.name, name: s.name }))]
  const priorityOptions = [
    { id: "", name: "All priorities" },
    { id: "LOW", name: "Low" },
    { id: "MEDIUM", name: "Medium" },
    { id: "HIGH", name: "High" },
    { id: "CRITICAL", name: "Critical" },
  ]
  const typeOptions = [
    { id: "", name: "All types" },
    { id: "TASK", name: "Task" },
    { id: "CALL", name: "Call" },
    { id: "EMAIL", name: "Email" },
    { id: "MEETING", name: "Meeting" },
  ]
  const assigneeOptions = [
    { id: "", name: "All assignees" },
    { id: user.id, name: "Assigned to me" },
    ...users.filter((item) => item.id !== user.id).map((item) => ({ id: item.id, name: item.name })),
  ]
  const milestoneOptions = [{ id: "", name: "All releases" }, ...milestones.map((m) => ({ id: m.id, name: m.name }))]

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      title="Filter tasks"
      activeCount={activeFilterCount}
      onClear={clearFilters}
    >
      <div className={styles.drawerField}>
        <label>Search</label>
        <input className={styles.searchInput} placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className={styles.drawerField}>
        <label>Status</label>
        <SearchableSelect options={statusOptions} value={activeView.filters.status || ""} onChange={(v) => updateFilter("status", v)} labelKey="name" valueKey="id" placeholder="All statuses" />
      </div>
      <div className={styles.drawerField}>
        <label>Priority</label>
        <SearchableSelect options={priorityOptions} value={activeView.filters.priority || ""} onChange={(v) => updateFilter("priority", v)} labelKey="name" valueKey="id" placeholder="All priorities" />
      </div>
      <div className={styles.drawerField}>
        <label>Type</label>
        <SearchableSelect options={typeOptions} value={activeView.filters.type || ""} onChange={(v) => updateFilter("type", v)} labelKey="name" valueKey="id" placeholder="All types" />
      </div>
      <div className={styles.drawerField}>
        <label>Assignee</label>
        <SearchableSelect options={assigneeOptions} value={activeView.filters.ownerId || ""} onChange={(v) => updateFilter("ownerId", v)} labelKey="name" valueKey="id" placeholder="All assignees" />
      </div>
      {milestones.length > 0 && (
        <div className={styles.drawerField}>
          <label>Release</label>
          <SearchableSelect options={milestoneOptions} value={activeView.filters.milestoneId || ""} onChange={(v) => updateFilter("milestoneId", v)} labelKey="name" valueKey="id" placeholder="All releases" />
        </div>
      )}
    </FilterDrawer>
  )
}

function BoardView({ tasks, statuses, overCol, setOverCol, setDragId, handleTaskDrop, openEdit }) {
  if (statuses.length === 0) {
    return <p className={styles.empty}>No statuses configured — add some in Settings → Task Boards.</p>
  }
  const knownNames = new Set(statuses.map((s) => s.name))
  const firstStatusName = statuses[0].name
  return (
    <div className={styles.board}>
      {statuses.map((status) => {
        // Tasks whose status doesn't match any configured status (renamed/deleted status,
        // or legacy data) fall back into the first column instead of silently vanishing.
        const colTasks = tasks.filter((task) => (knownNames.has(task.status) ? task.status : firstStatusName) === status.name)
        const isOver = overCol === status.name
        return (
          <section
            key={status.id}
            className={`${styles.column} ${isOver ? styles.columnOver : ""}`}
            onDragOver={(event) => { event.preventDefault(); setOverCol(status.name) }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => handleTaskDrop(status.name)}
          >
            <header className={styles.columnHeader}>
              <h4>{status.name}</h4>
              <span>{colTasks.length}</span>
            </header>
            <div className={styles.cardList}>
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} setDragId={setDragId} openEdit={openEdit} />
              ))}
              {colTasks.length === 0 && <div className={styles.emptyColumn}>No tasks</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TaskCard({ task, setDragId, openEdit }) {
  const { hasPermission } = useAuth()
  return (
    <article
      className={styles.taskCard}
      draggable={hasPermission("tasks.edit")}
      onDragStart={() => setDragId(task.id)}
      onDragEnd={() => setDragId(null)}
      onClick={() => openEdit(task)}
    >
      <div className={styles.cardTop}>
        <span className={`${styles.priority} ${styles[`priority${task.priority || "MEDIUM"}`]}`}>{task.priority || "MEDIUM"}</span>
        <time>{formatDate(task.dueDate)}</time>
      </div>
      <h5>{task.title}</h5>
      {taskRelatedLabel(task) && <p>{taskRelatedLabel(task)}</p>}
      {task.contact && <p>{task.contact.firstName} {task.contact.lastName}</p>}
      {task.labels?.length > 0 && (
        <div className={styles.labelChips}>
          {task.labels.map((tl) => (
            <span key={tl.labelId} className={styles.labelChip} style={{ background: tl.label.color }}>{tl.label.name}</span>
          ))}
        </div>
      )}
      <footer>
        <span>{TYPE_LABEL[task.type] || task.type}</span>
        <div className={styles.cardFooterActions}>
          {hasPermission("tasks.edit") && (
            <button
              type="button"
              className={styles.cardEditBtn}
              aria-label="Edit task"
              onClick={(e) => { e.stopPropagation(); openEdit(task, { editOnly: true }) }}
            >
              <MdOutlineEdit size={14} />
            </button>
          )}
          <Avatar name={task.owner?.name} color={task.owner?.color} size={18} />
        </div>
      </footer>
    </article>
  )
}

const TaskRow = forwardRef(function TaskRow({ task, statuses, onToggle, onEdit, onDelete, onQuickUpdate, currentUserId }, ref) {
  const { hasPermission } = useAuth()
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: task.done ? 0.56 : 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`${styles.row} ${task.done ? styles.rowDone : ""}`}
    >
      <motion.button className={`${styles.checkbox} ${task.done ? styles.checked : ""}`} onClick={() => hasPermission("tasks.edit") && onToggle(task.id, task.done)} whileTap={{ scale: 0.85 }}>
        <AnimatePresence>
          {task.done && (
            <motion.svg width="10" height="10" viewBox="0 0 24 24" fill="none" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>
      <span className={styles.typePill}>{TYPE_LABEL[task.type] || task.type}</span>
      <div className={styles.body}>
        <div className={styles.rowTitleLine}>
          <p className={styles.title} onClick={() => onEdit(task)}>{task.title}</p>
          <select
            className={`${styles.editSelect} ${styles.priority} ${styles[`priority${task.priority || "MEDIUM"}`]}`}
            value={task.priority || "MEDIUM"}
            disabled={!hasPermission("tasks.edit")}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onQuickUpdate(task.id, "priority", e.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select
            className={styles.editSelect}
            value={task.status}
            disabled={!hasPermission("tasks.edit")}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onQuickUpdate(task.id, "status", e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <p className={styles.meta}>
          {taskRelatedLabel(task) || "No relation"}
          {task.contact && <span> · {task.contact.firstName} {task.contact.lastName}</span>}
          {task.owner && task.owner.id !== currentUserId && <span> · {task.owner.name}</span>}
        </p>
      </div>
      <time className={styles.due}>{formatDate(task.dueDate)}</time>
      <div className={styles.rowActions}>
        {hasPermission("tasks.edit") && <button className={styles.rowActionBtn} onClick={() => onEdit(task, { editOnly: true })}>Edit</button>}
        {hasPermission("tasks.delete") && <button className={styles.rowActionBtnDanger} onClick={() => onDelete(task)}>Delete</button>}
      </div>
    </motion.div>
  )
})

