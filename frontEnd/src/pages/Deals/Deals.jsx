import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdOutlineCall, MdOutlineMail, MdOutlineEvent, MdOutlineDescription, MdOutlineEmojiEvents, MdOutlineViewKanban, MdOutlineViewList, MdDeleteOutline, MdMic, MdKeyboardArrowDown } from "react-icons/md"
import Topbar from "../../components/Layout/Topbar.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api, fileUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatCurrency, formatDate } from "../../lib/format.js"
import { PipelineSkeleton } from "../../components/UI/Skeleton.jsx"
import Badge from "../../components/UI/Badge.jsx"
import MultiSelect from "../../components/UI/MultiSelect.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import FilterDrawer, { FilterButton } from "../../components/UI/FilterDrawer.jsx"
import SliderDialog from "../../components/UI/SliderDialog.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import InvoicePreviewModal from "../Invoices/InvoicePreviewModal.jsx"
import useDebounce from "../../hooks/useDebounce.js"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import styles from "./Deals.module.css"

async function fetchAccountOptions(term) {
  const res = await api.get(`/accounts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res?.data || [])
  return list.map((a) => ({ value: a.id, label: a.name }))
}

async function fetchContactOptions(term) {
  const res = await api.get(`/contacts?search=${encodeURIComponent(term)}&page=1&limit=10`).catch(() => ({ data: [] }))
  const list = Array.isArray(res) ? res : (res?.data || [])
  return list.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.account ? ` — ${c.account.name}` : ""}` }))
}
import { fixAudioDuration, recordVoiceNote } from "../../lib/audio.js"

const STAGE_DOT_CLASS = { New: "dot_new", Qualified: "dot_qualified", Proposal: "dot_proposal", Negotiation: "dot_negotiation", Won: "dot_won" }
const EMPTY_FORM = { name: "", accountId: "", contactId: "", stageId: "", value: "", expectedCloseDate: "", clientTypeId: "", productId: "", productIds: [], eventId: "", customFields: {} }
const ACTIVITY_TYPE_ICON = { CALL: MdOutlineCall, EMAIL: MdOutlineMail, MEETING: MdOutlineEvent, NOTE: MdOutlineDescription, DEAL: MdOutlineEmojiEvents }

const DEFAULT_DEAL_VIEWS = [
  { id: "deal-pipeline-board", name: "Pipeline Board", layout: "BOARD", filters: { minVal: "", clientTypeId: "", productId: "", eventId: "" } },
  { id: "deal-list-table", name: "All Deals List", layout: "TABLE", filters: { minVal: "", clientTypeId: "", productId: "", eventId: "" } }
]

export default function Deals() {
  const { hasPermission } = useAuth()
  const [showFilters, setShowFilters] = useState(false)
  const [pipeline, setPipeline] = useState(null)
  const [clientTypes, setClientTypes] = useState([])
  const [products, setProducts] = useState([])
  const [events, setEvents] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dealFormTab, setDealFormTab] = useState("details")
  const [form, setForm] = useState(EMPTY_FORM)
  const [accountLabel, setAccountLabel] = useState("")
  const [contactLabel, setContactLabel] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [detailDealId, setDetailDealId] = useState(null)

  // Query state
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)

  // Custom views manager state
  const [views, setViews] = useState(() => {
    const saved = localStorage.getItem("sales_crm_deal_views")
    return saved ? JSON.parse(saved) : DEFAULT_DEAL_VIEWS
  })
  const [activeViewId, setActiveViewId] = useState(() => {
    const saved = localStorage.getItem("sales_crm_deal_active_view")
    return saved || DEFAULT_DEAL_VIEWS[0].id
  })

  const [editingTabId, setEditingTabId] = useState(null)
  const [tabRenameVal, setTabRenameVal] = useState("")
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [menuPos, setMenuPos] = useState(null)

  useEffect(() => {
    if (!activeMenuId) return
    function handleOutside() {
      setActiveMenuId(null)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [activeMenuId])

  function openTabMenu(e, viewId) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setActiveMenuId(activeMenuId === viewId ? null : viewId)
  }

  useEffect(() => {
    localStorage.setItem("sales_crm_deal_views", JSON.stringify(views))
  }, [views])

  useEffect(() => {
    localStorage.setItem("sales_crm_deal_active_view", activeViewId)
  }, [activeViewId])

  const activeView = views.find(v => v.id === activeViewId) || views[0] || DEFAULT_DEAL_VIEWS[0]

  const extraParams = useMemo(() => {
    const params = {}
    if (debouncedQuery) params.search = debouncedQuery
    if (activeView.filters.clientTypeId) params.clientTypeId = activeView.filters.clientTypeId
    if (activeView.filters.productId) params.productId = activeView.filters.productId
    if (activeView.filters.eventId) params.eventId = activeView.filters.eventId
    if (activeView.filters.minVal) params.minVal = activeView.filters.minVal
    return params
  }, [debouncedQuery, activeView.filters])

  const {
    data: deals,
    loading: dealsLoading,
    hasMore,
    lastElementRef,
    reload: reloadDeals,
    setData: setDeals,
    totalCount
  } = useInfiniteScroll("/deals", 30, extraParams)

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") === "1" && pipeline) {
      setForm({ ...EMPTY_FORM, stageId: pipeline.stages[0]?.id || "", customFields: {} })
      setAccountLabel("")
      setContactLabel("")
      setDealFormTab("details")
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline])

  function reloadMeta() {
    return Promise.all([
      api.get("/deals/pipelines"),
      api.get("/client-types").catch(() => []),
      api.get("/products").catch(() => []),
      api.get("/events").catch(() => []),
      api.get("/custom-fields").catch(() => []),
    ]).then(
      ([pipelines, ctList, pList, eList, cfList]) => {
        const p = pipelines[0]
        setPipeline(p)
        setClientTypes(ctList)
        setProducts(pList)
        setEvents(eList)
        setCustomFields(cfList.filter(f => f.entityType === "DEAL"))
        if (p && !form.stageId) setForm((f) => ({ ...f, stageId: p.stages[0]?.id || "" }))
      }
    )
  }

  function reload() {
    return Promise.all([
      reloadMeta(),
      reloadDeals(),
    ])
  }

  useEffect(() => {
    reloadMeta().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDrop(stageId) {
    if (!dragId) return
    const dealId = dragId
    setDragId(null)
    setOverStage(null)

    const prev = deals
    setDeals((cur) => cur.map((d) => (d.id === dealId ? { ...d, stageId, stage: pipeline.stages.find((s) => s.id === stageId) } : d)))
    try {
      await api.patch(`/deals/${dealId}/stage`, { stageId })
    } catch (err) {
      setDeals(prev)
      setError(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await api.post("/deals", {
        ...form,
        pipelineId: pipeline.id,
        value: Number(form.value) || 0,
        accountId: form.accountId || undefined,
        contactId: form.contactId || undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        clientTypeId: form.clientTypeId || undefined,
        productId: form.productId || undefined,
        products: (form.productIds || []).map((productId) => ({ productId })),
        eventId: form.eventId || undefined,
        customFields: form.customFields || {},
      })
      setForm({ ...EMPTY_FORM, stageId: pipeline.stages[0]?.id || "" })
      setAccountLabel("")
      setContactLabel("")
      setModalOpen(false)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Views Manager Handlers
  function handleAddView() {
    const newId = `view-${Date.now()}`
    const boardCount = views.filter((v) => v.layout === "BOARD").length
    const newView = {
      id: newId,
      name: `Board ${boardCount + 1}`,
      layout: "BOARD",
      filters: { minVal: "", clientTypeId: "", productId: "", eventId: "" }
    }
    setViews([...views, newView])
    setActiveViewId(newId)
    setActiveMenuId(newId)
  }

  function startRename(v) {
    setEditingTabId(v.id)
    setTabRenameVal(v.name)
  }

  function saveRename(id) {
    setViews(prev => prev.map(v => v.id === id ? { ...v, name: tabRenameVal } : v))
    setEditingTabId(null)
  }

  function updateLayout(viewId, layout) {
    setViews(prev => prev.map(v => v.id === viewId ? { ...v, layout } : v))
    setActiveMenuId(null)
  }

  function deleteView(viewId) {
    if (views.length <= 1) return
    const nextViews = views.filter(v => v.id !== viewId)
    setViews(nextViews)
    if (activeViewId === viewId) {
      setActiveViewId(nextViews[0].id)
    }
    setActiveMenuId(null)
  }

  function updateFilter(key, value) {
    setViews(prev => prev.map(v => {
      if (v.id === activeView.id) {
        return {
          ...v,
          filters: { ...v.filters, [key]: value }
        }
      }
      return v
    }))
  }

  function clearFilters() {
    setViews(prev => prev.map(v => {
      if (v.id === activeView.id) {
        return {
          ...v,
          filters: { minVal: "", clientTypeId: "", productId: "", eventId: "" }
        }
      }
      return v
    }))
    setQuery("")
  }

  // Client side filtering for maximum speed & reactivity
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      // Search query filter
      if (debouncedQuery) {
        const term = debouncedQuery.toLowerCase()
        const nameMatch = d.name.toLowerCase().includes(term)
        const accountMatch = d.account?.name?.toLowerCase().includes(term)
        const contactMatch = d.contact ? `${d.contact.firstName} ${d.contact.lastName}`.toLowerCase().includes(term) : false
        if (!nameMatch && !accountMatch && !contactMatch) return false
      }
      // Client type filter
      if (activeView.filters.clientTypeId && d.clientTypeId !== activeView.filters.clientTypeId) return false
      // Product filter
      if (activeView.filters.productId && d.productId !== activeView.filters.productId) return false
      // Event filter
      if (activeView.filters.eventId && d.eventId !== activeView.filters.eventId) return false
      // Min Value filter
      if (activeView.filters.minVal) {
        const val = Number(activeView.filters.minVal)
        if (d.value < val) return false
      }
      return true
    })
  }, [deals, debouncedQuery, activeView])

  if (loading || !pipeline) {
    return (
      <>
        <Topbar title="Pipeline" />
        <div className={styles.page}>
          <PipelineSkeleton />
        </div>
      </>
    )
  }

  const openDeals = filteredDeals.filter((d) => d.status === "OPEN")
  const totalValue = openDeals.reduce((s, d) => s + d.value, 0)
  const hasActiveFilters = activeView.filters.minVal || activeView.filters.clientTypeId || activeView.filters.productId || activeView.filters.eventId || query
  const activeFilterCount = ["minVal", "clientTypeId", "productId", "eventId"].filter((k) => activeView.filters[k]).length

  return (
    <>
      <Topbar
        title="Pipeline"
        subtitle={`${filteredDeals.length} deals · ${formatCurrency(totalValue)} in active filter`}
        action={hasPermission("deals.create") ? <button className={styles.addBtn} onClick={() => { setForm({ ...EMPTY_FORM, stageId: pipeline.stages[0]?.id || "", customFields: {} }); setAccountLabel(""); setContactLabel(""); setDealFormTab("details"); setModalOpen(true) }}>+ New Deal</button> : null}
      />

      {/* GITHUB PROJECTS STYLE TABS BAR */}
      <div className={styles.tabsBarOuter}>
        {views.map((v) => {
          const isActive = activeViewId === v.id
          const isEditing = editingTabId === v.id
          return (
            <div
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`${styles.tabItemDeals} ${isActive ? styles.tabItemDealsActive : ""}`}
            >
              <span className={styles.tabIconWrap}>{v.layout === "BOARD" ? <MdOutlineViewKanban size={14} /> : <MdOutlineViewList size={14} />}</span>
              {isEditing ? (
                <input
                  value={tabRenameVal}
                  onChange={(e) => setTabRenameVal(e.target.value)}
                  onBlur={() => saveRename(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(v.id)
                    if (e.key === "Escape") setEditingTabId(null)
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  className={styles.tabRenameInput}
                />
              ) : (
                <span onDoubleClick={(e) => { e.stopPropagation(); startRename(v) }}>{v.name}</span>
              )}

              <button
                onClick={(e) => openTabMenu(e, v.id)}
                className={styles.tabMenuTrigger}
              >
                <MdKeyboardArrowDown size={14} />
              </button>

              {activeMenuId === v.id && menuPos && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ top: menuPos.top, left: menuPos.left }}
                  className={styles.tabDropdown}
                >
                  <button
                    onClick={() => { startRename(v); setActiveMenuId(null) }}
                    className={styles.tabMenuItem}
                  >
                    Rename view
                  </button>
                  <div className={styles.uHairline} />
                  <div className={styles.tabMenuLabel}>Layout</div>
                  <button
                    onClick={() => updateLayout(v.id, "BOARD")}
                    className={`${styles.tabMenuItem} ${v.layout === "BOARD" ? styles.tabMenuItemActive : ""}`}
                  >
                    <MdOutlineViewKanban size={14} /> Kanban Board
                  </button>
                  <button
                    onClick={() => updateLayout(v.id, "TABLE")}
                    className={`${styles.tabMenuItem} ${v.layout === "TABLE" ? styles.tabMenuItemActive : ""}`}
                  >
                    <MdOutlineViewList size={14} /> List Table
                  </button>
                  {views.length > 1 && (
                    <>
                      <div className={styles.uHairline} />
                      <button
                        onClick={() => deleteView(v.id)}
                        className={`${styles.tabMenuItem} ${styles.tabMenuItemDanger}`}
                      >
                        <MdDeleteOutline size={14} /> Delete View
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={handleAddView}
          className={styles.addViewBtn}
        >
          + New view
        </button>
      </div>

      <div className={styles.page}>

        <FilterButton open={showFilters} onClick={() => setShowFilters(true)} activeCount={activeFilterCount} />

        <div className={styles.bodyRow}>
          <div className={styles.leftColumn}>
        {activeView.layout === "BOARD" ? (
          /* PIPELINE KANBAN BOARD */
          <motion.div
            className={styles.board}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          >
            {pipeline.stages.map((stage) => {
              const stageDeals = filteredDeals.filter((d) => d.stageId === stage.id && d.status !== "LOST")
              const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0)
              const isOver = overStage === stage.id

              return (
                <motion.div
                  key={stage.id}
                  className={`${styles.column} ${isOver ? styles.columnOver : ""}`}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
                  animate={isOver ? { scale: 1.015 } : { scale: 1 }}
                  transition={{ duration: 0.18 }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverStage(stage.id)
                  }}
                  onDragLeave={() => setOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.cardHeaderRow}>
                      <span className={`${styles.stageDot} ${styles[STAGE_DOT_CLASS[stage.name] || "dot_default"]}`} />
                      <span className={styles.cardStageName}>{stage.name}</span>
                      <span className={styles.columnCount}>{stageDeals.length}</span>
                    </div>
                  </div>

                  <div className={styles.columnTotal}>{formatCurrency(stageTotal)}</div>

                  <div className={styles.columnBody}>
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable={hasPermission("deals.edit")}
                        onDragStart={() => setDragId(deal.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setDetailDealId(deal.id)}
                        className={styles.dealCard}
                      >
                        <h4 className={styles.dealName}>{deal.name}</h4>
                        <div className={styles.dealMeta}>
                          <span className={styles.dealContact}>{deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : deal.account?.name || "—"}</span>
                          <span className={styles.dealDate}>{formatDate(deal.expectedCloseDate)}</span>
                        </div>
                        {(deal.clientType || deal.product || (deal.products || []).length || deal.event) && (
                          <div className={styles.cardTagsRow}>
                            {deal.clientType && <span className={styles.tagNeutral}>{deal.clientType.name}</span>}
                            {(deal.products || []).length > 0 ? (
                              <>
                                {deal.products.slice(0, 2).map((dp) => (
                                  <span key={dp.id} className={styles.tagAccent}>{dp.product?.name}</span>
                                ))}
                                {deal.products.length > 2 && (
                                  <span className={styles.tagNeutral} title={deal.products.slice(2).map((dp) => dp.product?.name).join(", ")}>+{deal.products.length - 2} more</span>
                                )}
                              </>
                            ) : (
                              deal.product && <span className={styles.tagAccent}>{deal.product.name}</span>
                            )}
                            {deal.event && <span className={styles.tagAccentSoft}>Event: {deal.event.name}</span>}
                          </div>
                        )}
                        <div className={styles.dealFooter}>
                          <span className={styles.dealValue}>{formatCurrency(deal.value)}</span>
                          <Avatar name={deal.owner?.name} color={deal.owner?.color} size={20} />
                        </div>
                      </div>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className={styles.emptyCol}>Drag deals here</div>
                    )}
                  </div>
                </motion.div>
              )
            })}
            {hasMore && (
              <div ref={lastElementRef} className={styles.boardSentinel}>
                <span className={styles.boardLoadingText}>Loading more deals...</span>
              </div>
            )}
          </motion.div>
        ) : (
          /* DEALS LIST TABLE VIEW */
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.uThHead}>Deal Name</th>
                  <th className={styles.uThHead}>Company</th>
                  <th className={styles.uThHead}>Contact</th>
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
                    <td colSpan={8} className={styles.emptyTableCell}>
                      No deals match this view's filter.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((d, index) => (
                    <tr
                      key={d.id}
                      ref={index === filteredDeals.length - 1 ? lastElementRef : null}
                      onClick={() => setDetailDealId(d.id)}
                      className={styles.tableRow}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td className={styles.cellName}>{d.name}</td>
                      <td className={styles.uCellPadMd}>{d.account?.name || "—"}</td>
                      <td className={styles.uCellPadMd}>{d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "—"}</td>
                      <td className={styles.cellValue}>{formatCurrency(d.value)}</td>
                      <td className={styles.uCellPad}>
                        <span className={styles.stageCellInline}>
                          <span className={`${styles.stageDot} ${styles[STAGE_DOT_CLASS[d.stage.name] || "dot_default"]} ${styles.stageDotSm}`} />
                          {d.stage.name}
                        </span>
                      </td>
                      <td className={styles.cellMono}>{formatDate(d.expectedCloseDate)}</td>
                      <td className={styles.uCellPad}>
                        <div className={styles.badgesWrap}>
                          {d.clientType && <Badge tone="neutral">{d.clientType.name}</Badge>}
                          {(d.products || []).length > 0 ? (
                            <>
                              {d.products.slice(0, 3).map((dp) => (
                                <Badge key={dp.id} tone="progress">{dp.product?.name}</Badge>
                              ))}
                              {d.products.length > 3 && <Badge tone="neutral" title={d.products.slice(3).map((dp) => dp.product?.name).join(", ")}>+{d.products.length - 3} more</Badge>}
                            </>
                          ) : (
                            d.product && <Badge tone="progress">{d.product.name}</Badge>
                          )}
                          {d.event && <Badge tone="new">{d.event.name}</Badge>}
                        </div>
                      </td>
                      <td className={styles.uCellPad}>
                        <div className={styles.ownerCell}>
                          <Avatar name={d.owner?.name} color={d.owner?.color} size={18} />
                          <span>{d.owner?.name}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {hasMore && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                      Loading more deals...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
          </div>

        <FilterDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filter deals"
          activeCount={activeFilterCount}
          onClear={clearFilters}
        >
          <div className={styles.drawerField}>
            <label>Search</label>
            <input
              className={styles.searchInput}
              placeholder="Search deals by name, company..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className={styles.drawerField}>
            <label>Client type</label>
            <SearchableSelect
              options={[{ id: "", name: "All Client Types" }, ...clientTypes]}
              value={activeView.filters.clientTypeId || ""}
              onChange={(v) => updateFilter("clientTypeId", v)}
              labelKey="name"
              valueKey="id"
              placeholder="All Client Types"
            />
          </div>

          <div className={styles.drawerField}>
            <label>Product</label>
            <SearchableSelect
              options={[{ id: "", name: "All Products" }, ...products]}
              value={activeView.filters.productId || ""}
              onChange={(v) => updateFilter("productId", v)}
              labelKey="name"
              valueKey="id"
              placeholder="All Products"
            />
          </div>

          <div className={styles.drawerField}>
            <label>Event</label>
            <SearchableSelect
              options={[{ id: "", name: "All Events" }, ...events]}
              value={activeView.filters.eventId || ""}
              onChange={(v) => updateFilter("eventId", v)}
              labelKey="name"
              valueKey="id"
              placeholder="All Events"
            />
          </div>

          <div className={styles.drawerField}>
            <label>Minimum value</label>
            <SearchableSelect
              options={[
                { id: "", name: "Any Value" },
                { id: "100000", name: "≥ ₹1 Lakh" },
                { id: "500000", name: "≥ ₹5 Lakhs" },
                { id: "1000000", name: "≥ ₹10 Lakhs" },
                { id: "2000000", name: "≥ ₹20 Lakhs" },
              ]}
              value={activeView.filters.minVal || ""}
              onChange={(v) => updateFilter("minVal", v)}
              labelKey="name"
              valueKey="id"
              placeholder="Any Value"
            />
          </div>
        </FilterDrawer>
        </div>

      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New deal">
        <div className={styles.modalTabs}>
          <button type="button" className={`${styles.modalTabBtn} ${dealFormTab === "details" ? styles.modalTabActive : ""}`} onClick={() => setDealFormTab("details")}>Details</button>
          <button type="button" className={`${styles.modalTabBtn} ${dealFormTab === "classify" ? styles.modalTabActive : ""}`} onClick={() => setDealFormTab("classify")}>Classification{customFields.length > 0 ? " & Fields" : ""}</button>
        </div>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${styles.uP0}`}>
          {dealFormTab === "details" && (
            <>
              <div className={modalStyles.field}>
                <label>Deal name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp — 500 Simulation Licenses" />
              </div>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Account (Company)</label>
                  <AsyncSelect
                    fetchOptions={fetchAccountOptions}
                    value={form.accountId}
                    selectedLabel={accountLabel}
                    onChange={(opt) => { setForm({ ...form, accountId: opt.value, contactId: "" }); setAccountLabel(opt.label); setContactLabel("") }}
                    placeholder="Select Account"
                  />
                </div>
                <div className={modalStyles.field}>
                  <label>Primary Contact</label>
                  <AsyncSelect
                    fetchOptions={fetchContactOptions}
                    value={form.contactId}
                    selectedLabel={contactLabel}
                    onChange={(opt) => { setForm({ ...form, contactId: opt.value }); setContactLabel(opt.label) }}
                    placeholder="Select Contact"
                  />
                </div>
              </div>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Value (₹)</label>
                  <input required type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                </div>
                <div className={modalStyles.field}>
                  <label>Expected close</label>
                  <input required type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {dealFormTab === "classify" && (
            <>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>Client Type</label>
                  <SearchableSelect
                    options={clientTypes}
                    value={form.clientTypeId || ""}
                    onChange={(v) => setForm({ ...form, clientTypeId: v })}
                    labelKey="name"
                    valueKey="id"
                    placeholder="Select Client Type"
                  />
                </div>
                <div className={modalStyles.field}>
                  <label>Product(s)</label>
                  <MultiSelect
                    options={products.map((p) => ({ label: p.name, value: p.id }))}
                    values={form.productIds || []}
                    onChange={(vals) => setForm({ ...form, productIds: vals, productId: vals[0] || "" })}
                    placeholder="Select products…"
                  />
                </div>
              </div>
              <div className={modalStyles.field}>
                <label>Marketing Event</label>
                <SearchableSelect
                  options={events.map((ev) => ({ id: ev.id, name: `${ev.name} (${formatDate(ev.date)})` }))}
                  value={form.eventId || ""}
                  onChange={(v) => setForm({ ...form, eventId: v })}
                  labelKey="name"
                  valueKey="id"
                  placeholder="Select Event"
                />
              </div>

              {customFields.length > 0 && (
                <div className={styles.uColGap75}>
                  <h4 className={styles.uSectionTitle}>Custom Attributes</h4>
                  {customFields.map((f) => {
                    let parsedOptions = []
                    try {
                      if (f.options) parsedOptions = JSON.parse(f.options)
                    } catch (e) {}

                    return (
                      <div key={f.id} className={modalStyles.field}>
                        <label>{f.label} {f.required && <span className={styles.uDanger}>*</span>}</label>
                        {f.type === "SELECT" ? (
                          <SearchableSelect
                            options={parsedOptions.map((opt) => ({ id: opt, name: opt }))}
                            value={form.customFields?.[f.id] || ""}
                            onChange={(v) => setForm({
                              ...form,
                              customFields: { ...form.customFields, [f.id]: v }
                            })}
                            labelKey="name"
                            valueKey="id"
                            placeholder="Select Option"
                          />
                        ) : (
                          <input
                            required={f.required}
                            type={f.type === "NUMBER" ? "number" : "text"}
                            value={form.customFields?.[f.id] || ""}
                            onChange={(e) => setForm({
                              ...form,
                              customFields: { ...form.customFields, [f.id]: e.target.value }
                            })}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving…" : "Create deal"}
            </button>
          </div>
        </form>
      </Modal>

      <DealDetail
        dealId={detailDealId}
        pipeline={pipeline}
        clientTypes={clientTypes}
        products={products}
        events={events}
        customFields={customFields}
        onClose={() => setDetailDealId(null)}
        onChanged={reload}
      />
    </>
  )
}

function DealDetail({ dealId, pipeline, clientTypes, products, events, customFields, onClose, onChanged }) {
  const { hasPermission } = useAuth()
  const [deal, setDeal] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", value: "", expectedCloseDate: "", clientTypeId: "", productId: "", productIds: [], eventId: "", customFields: {} })
  const [activityForm, setActivityForm] = useState({ type: "NOTE", notes: "" })
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordError, setRecordError] = useState("")
  const mediaRecorderRef = useRef(null)
  const recordTimerRef = useRef(null)
  const [lostReason, setLostReason] = useState("")
  const [showLostForm, setShowLostForm] = useState(false)
  const [detailTab, setDetailTab] = useState("details")
  const [dealInvoices, setDealInvoices] = useState([])
  const [previewInvoice, setPreviewInvoice] = useState(null)

  useEffect(() => {
    if (!dealId) {
      setDeal(null)
      return
    }
    setDetailTab("details")
    setError("")
    api.get(`/invoices?dealId=${dealId}`).then((res) => setDealInvoices(res.data || res)).catch(() => setDealInvoices([]))
    api.get(`/deals/${dealId}`).then((d) => {
      setDeal(d)
      setEditForm({
        name: d.name,
        value: d.value,
        expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "",
        clientTypeId: d.clientTypeId || "",
        productId: d.productId || "",
        productIds: (d.products || []).map((dp) => dp.productId).length
          ? (d.products || []).map((dp) => dp.productId)
          : (d.productId ? [d.productId] : []),
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
        products: (editForm.productIds || []).map((productId) => ({ productId })),
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

  function startActivityRecording() {
    setRecordError("")
    recordVoiceNote({
      onStart: (recorder) => {
        mediaRecorderRef.current = recorder
        setRecording(true)
        setRecordSeconds(0)
        recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
      },
      onDone: async (file) => {
        clearInterval(recordTimerRef.current)
        setSaving(true)
        try {
          const activity = await api.post("/activities", { type: "NOTE", notes: "", dealId })
          await api.upload(`/activities/${activity.id}/voice-note`, file)
          await refreshDeal()
        } catch (err) {
          setRecordError(err.message)
        } finally {
          setSaving(false)
        }
      },
      onError: () => setRecordError("Microphone access denied or unavailable."),
    })
  }

  function stopActivityRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <>
    <SliderDialog
      open={!!dealId}
      onClose={onClose}
      title={deal?.name || "Deal"}
      width="min(36rem, 100vw)"
      headerActions={deal?.hasCustomTemplate && (
        <a
          className={styles.docDownloadLink}
          href={fileUrl(`/deals/${deal.id}/generate-docx`)}
          target="_blank"
          rel="noopener noreferrer"
          title="Download document"
        >
          <MdOutlineDescription size={16} />
        </a>
      )}
    >
      {!deal ? (
        <p>Loading…</p>
      ) : (
        <div className={`${modalStyles.body} ${styles.uP0}`}>
          <div className={styles.detailBadgesRow}>
            <StatusPill status={deal.status} />
            {deal.clientType && <Badge tone="neutral">{deal.clientType.name}</Badge>}
            {(deal.products || []).length > 0
              ? deal.products.map((dp) => <Badge key={dp.id} tone="neutral">{dp.product?.name}</Badge>)
              : deal.product && <Badge tone="neutral">{deal.product.name}</Badge>}
            {deal.event && <Badge tone="new">Event: {deal.event.name}</Badge>}
            <span className={styles.detailSubText}>
              {deal.account?.name || "No account"} {deal.contact ? `· ${deal.contact.firstName} ${deal.contact.lastName}` : ""}
            </span>
          </div>

          <div className={styles.modalTabs}>
            <button type="button" className={`${styles.modalTabBtn} ${detailTab === "details" ? styles.modalTabActive : ""}`} onClick={() => setDetailTab("details")}>Details</button>
            <button type="button" className={`${styles.modalTabBtn} ${detailTab === "activity" ? styles.modalTabActive : ""}`} onClick={() => setDetailTab("activity")}>Activity ({deal.activities?.length || 0})</button>
            <button type="button" className={`${styles.modalTabBtn} ${detailTab === "invoices" ? styles.modalTabActive : ""}`} onClick={() => setDetailTab("invoices")}>Invoices ({dealInvoices.length})</button>
          </div>

          {detailTab === "details" && (
          <form onSubmit={handleSave} className={`${modalStyles.body} ${styles.uP0}`}>
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
            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label>Client Type</label>
                <SearchableSelect
                  options={clientTypes}
                  value={editForm.clientTypeId || ""}
                  onChange={(v) => setEditForm({ ...editForm, clientTypeId: v })}
                  labelKey="name"
                  valueKey="id"
                  placeholder="Select Client Type"
                />
              </div>
              <div className={modalStyles.field}>
                <label>Product(s)</label>
                <MultiSelect
                  options={products.map((p) => ({ label: p.name, value: p.id }))}
                  values={editForm.productIds || []}
                  onChange={(vals) => setEditForm({ ...editForm, productIds: vals, productId: vals[0] || "" })}
                  placeholder="Select products…"
                />
              </div>
            </div>
            <div className={modalStyles.field}>
              <label>Marketing Event</label>
              <SearchableSelect
                options={events.map((ev) => ({ id: ev.id, name: `${ev.name} (${formatDate(ev.date)})` }))}
                value={editForm.eventId || ""}
                onChange={(v) => setEditForm({ ...editForm, eventId: v })}
                labelKey="name"
                valueKey="id"
                placeholder="Select Event"
              />
            </div>

            {customFields.length > 0 && (
              <div className={styles.uDividerTop}>
                <h4 className={styles.uSectionTitle}>Custom Attributes</h4>
                <div className={styles.uColGap75}>
                  {customFields.map((f) => {
                    let parsedOptions = []
                    try {
                      if (f.options) parsedOptions = JSON.parse(f.options)
                    } catch (e) {}

                    return (
                      <div key={f.id} className={modalStyles.field}>
                        <label>{f.label} {f.required && <span className={styles.uDanger}>*</span>}</label>
                        {f.type === "SELECT" ? (
                          <SearchableSelect
                            options={parsedOptions.map((opt) => ({ id: opt, name: opt }))}
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
            <div className={`${modalStyles.actions} ${styles.actionsBetween}`}>
              {hasPermission("deals.delete") && (
                <button type="button" className={`${modalStyles.rowActionBtnDanger || modalStyles.cancelBtn} ${styles.uDanger}`} onClick={handleDelete}>
                  Delete deal
                </button>
              )}
              <button type="submit" className={modalStyles.submitBtn} disabled={saving}>Save</button>
            </div>
          </form>
          )}

          {detailTab === "details" && deal.status === "OPEN" && hasPermission("deals.close") && (
            <div className={styles.wonLostRow}>
              <button type="button" className={`${modalStyles.submitBtn} ${styles.btnWonFlex}`} onClick={() => handleClose("WON")} disabled={saving}>
                Mark Won
              </button>
              <button type="button" className={`${modalStyles.cancelBtn} ${styles.btnLostFlex}`} onClick={() => handleClose("LOST")} disabled={saving}>
                Mark Lost
              </button>
            </div>
          )}

          {detailTab === "details" && showLostForm && (
            <div className={modalStyles.field}>
              <label>Lost reason</label>
              <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Went with a competitor" />
              <button type="button" className={`${modalStyles.submitBtn} ${styles.mtSm}`} onClick={() => handleClose("LOST")} disabled={saving}>
                Confirm lost
              </button>
            </div>
          )}

          {detailTab === "details" && deal.status !== "OPEN" && (
            <p className={styles.uMutedSm}>
              Closed as <strong>{deal.status}</strong>{deal.lostReason ? ` — ${deal.lostReason}` : ""}
            </p>
          )}

          {error && <p className={modalStyles.error}>{error}</p>}

          {detailTab === "activity" && (
          <div className={`${modalStyles.body} ${styles.uP0} ${styles.tabPanelFill}`}>
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
                  <button type="submit" className={`${modalStyles.submitBtn} ${styles.btnFlexNone}`} disabled={saving}>Log</button>
                </div>
                <div className={styles.activityRecordRow}>
                  {recording ? (
                    <button type="button" className={styles.recordingBtn} onClick={stopActivityRecording}>
                      <MdMic size={14} /> Stop recording · {recordSeconds}s
                    </button>
                  ) : (
                    <button type="button" className={styles.voiceNoteBtn} onClick={startActivityRecording} disabled={saving}>
                      <MdMic size={14} /> Record voice note
                    </button>
                  )}
                </div>
              </form>
            )}
            {recordError && <p className={modalStyles.error}>{recordError}</p>}

            {deal.activities?.length === 0 ? (
              <EmptyState type="activity" title="No activity yet" hint="Calls, emails, notes, and voice memos logged on this deal will show up here." className={styles.emptyFill} />
            ) : (
            <ul className={styles.activityList}>
              {deal.activities?.map((a) => (
                <li key={a.id} className={styles.activityItem}>
                  <span className={styles.activityIconBadge}>{(() => { const Icon = ACTIVITY_TYPE_ICON[a.type]; return Icon ? <Icon size={14} /> : "•" })()}</span>
                  <div>
                    {a.notes && <p className={styles.activityNotes}>{a.notes}</p>}
                    {a.voiceNoteStorageKey && (
                      <audio
                        controls
                        preload="metadata"
                        src={fileUrl(`/activities/${a.id}/voice-note/file`)}
                        className={styles.activityAudio}
                        onLoadedMetadata={(ev) => fixAudioDuration(ev.currentTarget)}
                        onDurationChange={(ev) => fixAudioDuration(ev.currentTarget)}
                      />
                    )}
                    <span className={styles.activityMeta}>{a.owner?.name} · {formatDate(a.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>
          )}

          {detailTab === "invoices" && (
          <div className={`${modalStyles.body} ${styles.uP0} ${styles.tabPanelFill}`}>
            {dealInvoices.length === 0 ? (
              <EmptyState type="generic" title="No invoices yet" hint="Invoices linked to this deal will show up here — create one from the Invoices page." className={styles.emptyFill} />
            ) : (
              <ul className={styles.activityList}>
                {dealInvoices.map((inv) => (
                  <li key={inv.id} className={`${styles.activityItem} ${styles.activityItemClickable}`} onClick={() => setPreviewInvoice(inv)}>
                    <span className={styles.activityIconBadge}><MdOutlineDescription size={14} /></span>
                    <div>
                      <p className={styles.activityNotes}>{inv.invoiceNumber} — {formatCurrency(inv.amount)}</p>
                      <span className={styles.activityMeta}>{inv.status} · due {formatDate(inv.dueDate)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </div>
      )}
    </SliderDialog>

    <InvoicePreviewModal
      open={!!previewInvoice}
      onClose={() => setPreviewInvoice(null)}
      invoice={previewInvoice}
      onStatusUpdated={() => {
        api.get(`/invoices?dealId=${dealId}`).then((res) => setDealInvoices(res.data || res)).catch(() => {})
      }}
    />
    </>
  )
}

function StatusPill({ status }) {
  const tone = status === "WON" ? { bg: "var(--emerald-100)", color: "var(--emerald-700)" } : status === "LOST" ? { bg: "var(--coral-100)", color: "var(--coral-600)" } : { bg: "var(--gold-100)", color: "var(--gold-600)" }
  return (
    <span className={styles.statusPill} style={{ background: tone.bg, color: tone.color }}>
      {status}
    </span>
  )
}
