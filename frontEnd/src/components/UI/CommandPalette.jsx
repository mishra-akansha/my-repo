import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  MdOutlineSearch,
  MdOutlinePersonOutline,
  MdOutlineBusinessCenter,
  MdOutlineApartment,
  MdOutlineContacts,
  MdOutlineChecklist,
  MdAdd,
} from "react-icons/md"
import { api } from "../../api/client.js"
import styles from "./CommandPalette.module.css"

const QUICK_ACTIONS = [
  { id: "new-lead", label: "New Lead", to: "/leads?new=1", icon: MdAdd },
  { id: "new-deal", label: "New Deal", to: "/deals?new=1", icon: MdAdd },
  { id: "new-task", label: "New Task", to: "/tasks?new=1", icon: MdAdd },
]

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState({ leads: [], deals: [], contacts: [], accounts: [], tasks: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debouncedQuery = useDebounced(query, 250)

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") setOpen(false)
    }
    function handleOpenEvent() {
      setOpen(true)
    }
    window.addEventListener("keydown", handleKey)
    window.addEventListener("open-command-palette", handleOpenEvent)
    return () => {
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("open-command-palette", handleOpenEvent)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
    } else {
      setQuery("")
      setResults({ leads: [], deals: [], contacts: [], accounts: [], tasks: [] })
    }
  }, [open])

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults({ leads: [], deals: [], contacts: [], accounts: [], tasks: [] })
      return
    }
    setLoading(true)
    try {
      const params = `search=${encodeURIComponent(q)}&page=1&limit=5`
      const [leads, deals, contacts, accounts, tasks] = await Promise.all([
        api.get(`/leads?${params}`),
        api.get(`/deals?${params}`),
        api.get(`/contacts?${params}`),
        api.get(`/accounts?${params}`),
        api.get(`/tasks?${params}`),
      ])
      setResults({
        leads: leads.data || leads,
        deals: deals.data || deals,
        contacts: contacts.data || contacts,
        accounts: accounts.data || accounts,
        tasks: tasks.data || tasks,
      })
    } catch (err) {
      console.error("Command palette search failed:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  const hasResults = Object.values(results).some((list) => list.length > 0)

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
      >
        <motion.div
          className={styles.palette}
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.searchRow}>
            <MdOutlineSearch size={18} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads, deals, contacts, accounts, tasks…"
            />
            <kbd className={styles.escHint}>Esc</kbd>
          </div>

          <div className={styles.resultsScroll}>
            {!query.trim() ? (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Quick actions</div>
                {QUICK_ACTIONS.map((a) => (
                  <button key={a.id} className={styles.resultRow} onClick={() => go(a.to)}>
                    <a.icon size={15} />
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            ) : loading ? (
              <div className={styles.empty}>Searching…</div>
            ) : !hasResults ? (
              <div className={styles.empty}>No matches for "{query}"</div>
            ) : (
              <>
                {results.leads.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Leads</div>
                    {results.leads.map((l) => (
                      <button key={l.id} className={styles.resultRow} onClick={() => go("/leads")}>
                        <MdOutlinePersonOutline size={15} />
                        <span>{l.firstName} {l.lastName}</span>
                        {l.company && <span className={styles.resultSub}>{l.company}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {results.deals.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Deals</div>
                    {results.deals.map((d) => (
                      <button key={d.id} className={styles.resultRow} onClick={() => go("/deals")}>
                        <MdOutlineBusinessCenter size={15} />
                        <span>{d.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.contacts.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Contacts</div>
                    {results.contacts.map((c) => (
                      <button key={c.id} className={styles.resultRow} onClick={() => go("/contacts")}>
                        <MdOutlineContacts size={15} />
                        <span>{c.firstName} {c.lastName}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.accounts.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Accounts</div>
                    {results.accounts.map((a) => (
                      <button key={a.id} className={styles.resultRow} onClick={() => go("/accounts")}>
                        <MdOutlineApartment size={15} />
                        <span>{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.tasks.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Tasks</div>
                    {results.tasks.map((t) => (
                      <button key={t.id} className={styles.resultRow} onClick={() => go("/tasks")}>
                        <MdOutlineChecklist size={15} />
                        <span>{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
