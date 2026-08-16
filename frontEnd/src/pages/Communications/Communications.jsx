import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MdCheckCircle,
  MdCancel,
  MdOutlineMailOutline,
  MdArrowBack,
  MdOutlineAttachFile,
  MdStar,
  MdStarBorder,
  MdSend,
  MdSync,
  MdAdd,
  MdOutlineSearch,
  MdDoneAll,
  MdReply,
  MdLink,
  MdOutlineForwardToInbox
} from "react-icons/md"
import Topbar from "../../components/Layout/Topbar.jsx"
import AsyncSelect from "../../components/UI/AsyncSelect.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import EmailBody from "../../components/UI/EmailBody.jsx"
import { api, fileUrl } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import { fillTemplate, findMissingTags, hasUnfilledTags } from "../../lib/emailTemplate.js"
import TemplateMissingFields from "../../components/UI/TemplateMissingFields.jsx"
import styles from "./Communications.module.css"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DRAFT_KEY = "ridgeline-email-draft"

function formatFileSize(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getInitials(name = "") {
  const parts = name.trim().split(" ").filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getAvatarColor(str = "") {
  const colors = [
    "linear-gradient(135deg, #4f46e5, #7c3aed)",
    "linear-gradient(135deg, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #2563eb, #38bdf8)",
    "linear-gradient(135deg, #059669, #10b981)",
    "linear-gradient(135deg, #d97706, #f59e0b)",
    "linear-gradient(135deg, #7c3aed, #c084fc)",
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

async function fetchClientOptions(term) {
  const [leadsRes, contactsRes] = await Promise.all([
    api.get(`/leads?search=${encodeURIComponent(term)}&page=1&limit=8`).catch(() => ({ data: [] })),
    api.get(`/contacts?search=${encodeURIComponent(term)}&page=1&limit=8`).catch(() => ({ data: [] })),
  ])
  const leadsList = Array.isArray(leadsRes) ? leadsRes : (leadsRes?.data || [])
  const contactsList = Array.isArray(contactsRes) ? contactsRes : (contactsRes?.data || [])
  const leads = leadsList.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, tag: "Lead", email: l.email, type: "lead" }))
  const contacts = contactsList.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, tag: "Contact", email: c.email, type: "contact" }))
  return [...leads, ...contacts].map((c) => ({ value: `${c.type}:${c.id}`, label: `${c.name} (${c.tag}) - ${c.email}`, raw: c }))
}

async function fetchTemplateOptions(term) {
  const res = await api.get(`/email-templates?search=${encodeURIComponent(term)}`).catch(() => [])
  return (res || []).map((t) => ({ value: t.id, label: t.name, raw: t }))
}

function conversationKey({ threadId, leadId, contactId, counterpartyEmail }) {
  if (threadId) return `thread:${threadId}`
  if (leadId) return `lead:${leadId}`
  if (contactId) return `contact:${contactId}`
  if (counterpartyEmail) return `email:${counterpartyEmail.toLowerCase()}`
  return "unlinked"
}

export default function Communications() {
  const { user } = useAuth()
  const threadEndRef = useRef(null)
  const quickReplyInputRef = useRef(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [mode, setMode] = useState("thread") // "thread" | "compose"
  const [selectedKey, setSelectedKey] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewFilter, setViewFilter] = useState("all") // "all" | "sent" | "received" | "starred"
  const PAGE_SIZE = 50
  const syncedOffsetRef = useRef(0)
  const legacyRef = useRef([])
  const listScrollRef = useRef(null)
  const sentinelRef = useRef(null)

  // Full composer state
  const [selectedClient, setSelectedClient] = useState(null)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [replyContext, setReplyContext] = useState(null)
  const [linkingBusy, setLinkingBusy] = useState(false)
  const [rawEmail, setRawEmail] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [missingTags, setMissingTags] = useState([])
  const [manualValues, setManualValues] = useState({})
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const [toast, setToast] = useState(null)

  // Quick inline reply state
  const [inlineReplyText, setInlineReplyText] = useState("")
  const [inlineAttachedFiles, setInlineAttachedFiles] = useState([])
  const [inlineSending, setInlineSending] = useState(false)

  function normalizeLegacy(a) {
    const isReply = a.notes.startsWith("[Client Reply]") || a.notes.startsWith("[Inbound Reply]") || a.notes.startsWith("[Incoming Email]")
    const clean = a.notes.replace(/^\[Sent Email\]\s*|^\[Client Reply\]\s*|^\[Inbound Reply\]\s*|^\[Incoming Email\]\s*/, "")
    const match = clean.match(/Subject: (.*?)\n\n([\s\S]*)/)
    const regarding = a.lead ? `${a.lead.firstName} ${a.lead.lastName}` : a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : null
    const counterpartyEmail = a.lead?.email || a.contact?.email || null
    return {
      id: `activity:${a.id}`,
      dbId: null,
      key: conversationKey({ leadId: a.leadId, contactId: a.contactId, counterpartyEmail }),
      date: a.createdAt,
      direction: isReply ? "inbound" : "outbound",
      from: isReply ? (regarding || "Client") : "You",
      subject: match ? match[1] : "Re: CRM inquiry",
      body: match ? match[2] : clean,
      bodyHtml: null,
      regarding,
      counterpartyEmail,
      read: true,
      starred: false,
      dbGmailMessageId: null,
      attachments: [],
    }
  }

  function normalizeSynced(m) {
    const regarding = m.lead ? `${m.lead.firstName} ${m.lead.lastName}` : m.contact ? `${m.contact.firstName} ${m.contact.lastName}` : null
    const counterpartyEmail = (m.direction === "outbound" ? m.toEmail : m.fromEmail) || null
    return {
      id: `gmail:${m.id}`,
      dbId: m.id,
      key: conversationKey({ threadId: m.gmailThreadId, leadId: m.leadId, contactId: m.contactId, counterpartyEmail }),
      date: m.sentAt,
      direction: m.direction,
      from: m.direction === "outbound" ? (m.user?.name || "You") : (m.fromName || m.fromEmail),
      subject: m.subject || "(no subject)",
      body: m.bodyText || m.snippet || "(no preview available)",
      bodyHtml: m.bodyHtml || null,
      regarding,
      counterpartyEmail,
      read: !!m.read,
      starred: !!m.starred,
      dbGmailMessageId: m.gmailMessageId,
      ccEmails: m.ccEmails || null,
      messageIdHeader: m.messageIdHeader || null,
      gmailThreadId: m.gmailThreadId || null,
      attachments: (() => { try { return m.attachments ? JSON.parse(m.attachments) : [] } catch { return [] } })(),
    }
  }

  async function loadData(skipInitialSync = false) {
    setLoading(true)
    try {
      if (!skipInitialSync) {
        await api.post("/email-messages/sync", {}).catch(() => {})
      }
      const [actsRes, msgsRes] = await Promise.all([
        api.get("/activities").catch(() => []),
        api.get(`/email-messages?limit=${PAGE_SIZE}&offset=0`).catch(() => []),
      ])

      const legacy = (actsRes || []).filter((a) => a.type === "EMAIL").map(normalizeLegacy)
      const syncedList = Array.isArray(msgsRes) ? msgsRes : []
      const synced = syncedList.map(normalizeSynced)

      legacyRef.current = legacy
      syncedOffsetRef.current = syncedList.length
      setHasMoreMessages(syncedList.length === PAGE_SIZE)

      const merged = [...legacy, ...synced].sort((a, b) => new Date(a.date) - new Date(b.date))
      setActivities(merged)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleManualSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await api.post("/email-messages/sync", {}).catch((e) => { throw e })
      await loadData(true)
      showToast("success", res?.synced ? `Synced ${res.synced} new emails` : "Inbox is up to date.")
    } catch (err) {
      showToast("error", err.message || "Failed to sync emails.")
    } finally {
      setSyncing(false)
    }
  }

  async function loadMoreMessages() {
    if (loadingMore || !hasMoreMessages) return
    setLoadingMore(true)
    try {
      const msgsRes = await api.get(`/email-messages?limit=${PAGE_SIZE}&offset=${syncedOffsetRef.current}`).catch(() => [])
      const syncedList = Array.isArray(msgsRes) ? msgsRes : []
      syncedOffsetRef.current += syncedList.length
      setHasMoreMessages(syncedList.length === PAGE_SIZE)
      const newSynced = syncedList.map(normalizeSynced)
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id))
        const merged = [...prev, ...newSynced.filter((m) => !existingIds.has(m.id))]
        return merged.sort((a, b) => new Date(a.date) - new Date(b.date))
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const root = listScrollRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasMoreMessages) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreMessages() },
      { root, rootMargin: "200px" }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMoreMessages, loadingMore, activities.length])

  const conversations = useMemo(() => {
    const map = new Map()
    for (const a of activities) {
      if (!map.has(a.key)) {
        map.set(a.key, {
          key: a.key,
          name: a.regarding || a.counterpartyEmail || "Unlinked address",
          email: a.counterpartyEmail,
          messages: [],
        })
      }
      map.get(a.key).messages.push(a)
    }
    const list = Array.from(map.values()).map((c) => {
      const last = c.messages[c.messages.length - 1]
      const hasUnread = c.messages.some((m) => m.direction === "inbound" && !m.read)
      const hasStarred = c.messages.some((m) => m.starred)
      const isLead = c.key.startsWith("lead:")
      const isContact = c.key.startsWith("contact:")
      const crmType = isLead ? "Lead" : isContact ? "Contact" : "Unlinked"
      return {
        ...c,
        lastDate: last.date,
        lastSubject: last.subject,
        lastSnippet: last.body.replace(/\s+/g, " ").slice(0, 90),
        lastFromMe: last.direction === "outbound",
        hasUnread,
        hasStarred,
        crmType
      }
    })
    list.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
    return list
  }, [activities])

  const counts = useMemo(() => {
    let sent = 0
    let received = 0
    let starred = 0
    for (const c of conversations) {
      if (c.messages.some((m) => m.direction === "outbound")) sent++
      if (c.messages.some((m) => m.direction === "inbound")) received++
      if (c.hasStarred) starred++
    }
    return { all: conversations.length, sent, received, starred }
  }, [conversations])

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return conversations.filter((c) => {
      if (viewFilter === "sent" && !c.messages.some((m) => m.direction === "outbound")) return false
      if (viewFilter === "received" && !c.messages.some((m) => m.direction === "inbound")) return false
      if (viewFilter === "starred" && !c.hasStarred) return false
      if (!q) return true
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.lastSubject || "").toLowerCase().includes(q) ||
        (c.lastSnippet || "").toLowerCase().includes(q)
      )
    })
  }, [conversations, searchQuery, viewFilter])

  const selectedConversation = conversations.find((c) => c.key === selectedKey) || null

  useEffect(() => {
    if (loading) return
    if (mode !== "thread") return
    if (selectedKey && conversations.some((c) => c.key === selectedKey)) return
    setSelectedKey(conversations[0]?.key || null)
  }, [loading, conversations, mode, selectedKey])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setShowLinkPicker(false)
  }, [selectedConversation?.key, selectedConversation?.messages.length])

  useEffect(() => {
    if (!selectedConversation?.hasUnread) return
    const unreadIds = selectedConversation.messages.filter((m) => m.direction === "inbound" && !m.read && m.dbId).map((m) => m.dbId)
    if (!unreadIds.length) return
    const key = selectedConversation.key
    setActivities((prev) => prev.map((a) => (a.key === key && unreadIds.includes(a.dbId) ? { ...a, read: true } : a)))
    api.post("/email-messages/mark-read", { ids: unreadIds }).catch(() => {})
  }, [selectedConversation?.key])

  const totalUnread = conversations.filter((c) => c.hasUnread).length

  function markAllRead() {
    const unreadIds = activities.filter((a) => a.direction === "inbound" && !a.read && a.dbId).map((a) => a.dbId)
    if (!unreadIds.length) return
    setActivities((prev) => prev.map((a) => (unreadIds.includes(a.dbId) ? { ...a, read: true } : a)))
    api.post("/email-messages/mark-read", { ids: unreadIds }).catch(() => {})
    showToast("success", "All conversations marked as read.")
  }

  function toggleStar(msg, e) {
    e?.stopPropagation()
    if (!msg?.dbId) return
    const next = !msg.starred
    setActivities((prev) => prev.map((a) => (a.id === msg.id ? { ...a, starred: next } : a)))
    api.post(`/email-messages/${msg.dbId}/star`, { starred: next }).catch(() => {
      setActivities((prev) => prev.map((a) => (a.id === msg.id ? { ...a, starred: !next } : a)))
    })
  }

  async function linkConversationTo(picked) {
    if (!selectedConversation || !picked) return
    setLinkingBusy(true)
    try {
      const ids = selectedConversation.messages.filter((m) => m.dbId).map((m) => m.dbId)
      if (ids.length) {
        await api.post("/email-messages/link-conversation", {
          ids,
          leadId: picked.type === "lead" ? picked.id : null,
          contactId: picked.type === "contact" ? picked.id : null,
        })
      }
      setShowLinkPicker(false)
      await loadData(true)
      setSelectedKey(picked.type === "lead" ? `lead:${picked.id}` : `contact:${picked.id}`)
      showToast("success", `Conversation linked to ${picked.name}.`)
    } catch (err) {
      showToast("error", err.message || "Failed to link conversation.")
    } finally {
      setLinkingBusy(false)
    }
  }

  function templateAutoData(recipientOverride) {
    const recipient = recipientOverride ?? selectedClient
    return {
      first_name: recipient?.name?.split(" ")[0] || "",
      company_name: user?.organization?.name || "",
      owner_name: user?.name || "",
      owner_email: user?.email || "",
    }
  }

  function applyTemplate(t, recipientOverride) {
    setTemplateId(t ? t.id : "")
    if (!t) { setActiveTemplate(null); setMissingTags([]); setManualValues({}); return }
    const autoData = templateAutoData(recipientOverride)
    setActiveTemplate(t)
    setMissingTags(findMissingTags(t, autoData))
    setManualValues({})
    setSubject(fillTemplate(t, autoData).subject)
    setBody(fillTemplate(t, autoData).body)
  }

  function updateManualValue(tag, value) {
    const nextValues = { ...manualValues, [tag]: value }
    setManualValues(nextValues)
    if (!activeTemplate) return
    const filled = fillTemplate(activeTemplate, { ...templateAutoData(), ...nextValues })
    setSubject(filled.subject)
    setBody(filled.body)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (mode !== "compose" || replyContext) return
    const t = setTimeout(() => {
      if (subject || body || rawEmail) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ rawEmail, subject, body }))
      } else {
        localStorage.removeItem(DRAFT_KEY)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [mode, replyContext, subject, body, rawEmail])

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function openCompose(prefill) {
    setMode("compose")
    setReplyContext(prefill?.inReplyTo || prefill?.gmailThreadId ? { inReplyTo: prefill.inReplyTo, gmailThreadId: prefill.gmailThreadId } : null)
    if (prefill) {
      setSelectedClient(null)
      setRawEmail(prefill.email || "")
      setSubject(prefill.subject || "")
      setBody("")
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null")
        if (saved) {
          setRawEmail(saved.rawEmail || "")
          setSubject(saved.subject || "")
          setBody(saved.body || "")
        }
      } catch {}
    }
  }

  function handleFocusQuickReply() {
    quickReplyInputRef.current?.focus()
    quickReplyInputRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function handleSendQuickReply(e) {
    e.preventDefault()
    if (!selectedConversation || !selectedConversation.email) {
      showToast("error", "No recipient email address found in this thread.")
      return
    }
    if (!inlineReplyText.trim()) {
      showToast("error", "Please enter your reply message.")
      return
    }
    setInlineSending(true)
    try {
      const last = selectedConversation.messages[selectedConversation.messages.length - 1]
      const isLead = selectedConversation.key.startsWith("lead:")
      const isContact = selectedConversation.key.startsWith("contact:")
      const leadId = isLead ? selectedConversation.key.replace("lead:", "") : null
      const contactId = isContact ? selectedConversation.key.replace("contact:", "") : null

      const fields = {
        toEmail: selectedConversation.email,
        subject: last?.subject?.startsWith("Re:") ? last.subject : `Re: ${last?.subject || "CRM Inquiry"}`,
        body: inlineReplyText.trim(),
        leadId: leadId ? parseInt(leadId) : null,
        contactId: contactId ? parseInt(contactId) : null,
        inReplyTo: last?.messageIdHeader || null,
        gmailThreadId: last?.gmailThreadId || null,
      }

      if (inlineAttachedFiles.length) {
        await api.uploadMultiple("/activities/send-email", inlineAttachedFiles, fields)
      } else {
        await api.post("/activities/send-email", fields)
      }

      showToast("success", `Reply sent to ${selectedConversation.email}`)
      setInlineReplyText("")
      setInlineAttachedFiles([])
      await loadData(true)
    } catch (err) {
      showToast("error", err.message || "Failed to send reply.")
    } finally {
      setInlineSending(false)
    }
  }

  const toAddress = selectedClient?.email || rawEmail.trim()

  async function handleSend(e) {
    e.preventDefault()
    if (!toAddress || !EMAIL_RE.test(toAddress)) {
      showToast("error", "Enter a valid recipient email address.")
      return
    }
    if (!subject || !body) {
      showToast("error", "Please fill in subject and message before sending.")
      return
    }
    if (hasUnfilledTags(subject) || hasUnfilledTags(body)) {
      showToast("error", "Fill in the highlighted template fields before sending.")
      return
    }
    setSending(true)
    try {
      const fields = {
        toEmail: toAddress,
        subject,
        body,
        leadId: selectedClient?.type === "lead" ? selectedClient.id : null,
        contactId: selectedClient?.type === "contact" ? selectedClient.id : null,
        inReplyTo: replyContext?.inReplyTo || null,
        gmailThreadId: replyContext?.gmailThreadId || null,
        fromEmail: activeTemplate?.fromEmail || null,
        fromName: activeTemplate?.fromName || null,
      }
      if (attachedFiles.length) {
        await api.uploadMultiple("/activities/send-email", attachedFiles, fields)
      } else {
        await api.post("/activities/send-email", fields)
      }
      showToast("success", `Sent to ${toAddress}`)
      localStorage.removeItem(DRAFT_KEY)
      setSubject("")
      setBody("")
      setSelectedClient(null)
      setRawEmail("")
      setActiveTemplate(null)
      setMissingTags([])
      setManualValues({})
      setTemplateId("")
      setReplyContext(null)
      setAttachedFiles([])
      setMode("thread")
      await loadData(true)
    } catch (err) {
      showToast("error", err.message || "Failed to send. Try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Topbar
        title="Inbox"
        subtitle="Manage incoming and outgoing customer emails seamlessly"
      />

      <div className={styles.page}>
        <div className={styles.workspace}>
          {/* ---- Left: Conversation List Panel ---- */}
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <div className={styles.listHeaderTop}>
                <button type="button" className={styles.composeBtn} onClick={() => openCompose(null)}>
                  <MdAdd size={18} />
                  <span>Compose</span>
                </button>
                <button
                  type="button"
                  className={`${styles.syncBtn} ${syncing ? styles.syncBtnSpinning : ""}`}
                  title="Sync with Gmail"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  <MdSync size={18} />
                </button>
              </div>

              <div className={styles.searchWrap}>
                <MdOutlineSearch className={styles.searchIcon} size={18} />
                <input
                  type="text"
                  className={styles.convoSearch}
                  placeholder="Search conversations, emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className={styles.viewTabs}>
                <button
                  type="button"
                  className={`${styles.viewTab} ${viewFilter === "all" ? styles.viewTabActive : ""}`}
                  onClick={() => setViewFilter("all")}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  className={`${styles.viewTab} ${viewFilter === "received" ? styles.viewTabActive : ""}`}
                  onClick={() => setViewFilter("received")}
                >
                  Received ({counts.received})
                </button>
                <button
                  type="button"
                  className={`${styles.viewTab} ${viewFilter === "sent" ? styles.viewTabActive : ""}`}
                  onClick={() => setViewFilter("sent")}
                >
                  Sent ({counts.sent})
                </button>
                <button
                  type="button"
                  className={`${styles.viewTab} ${viewFilter === "starred" ? styles.viewTabActive : ""}`}
                  onClick={() => setViewFilter("starred")}
                >
                  Starred ({counts.starred})
                </button>
              </div>

              {totalUnread > 0 && (
                <button type="button" className={styles.markAllReadBtn} onClick={markAllRead}>
                  <MdDoneAll size={14} />
                  <span>Mark all read ({totalUnread})</span>
                </button>
              )}
            </div>

            <div className={styles.listScroll} ref={listScrollRef}>
              {loading ? (
                <div className={styles.listLoading}>
                  <div className={styles.loaderSpinner} />
                  <span>Loading conversations...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className={styles.listEmpty}>
                  <EmptyState type="mail" title="No emails yet" hint="Once you start sending or receiving emails, they'll appear here." compact />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className={styles.listNoMatch}>No emails match this filter or search query.</div>
              ) : (
                <>
                  {filteredConversations.map((c) => {
                    const initials = getInitials(c.name)
                    const avatarBg = getAvatarColor(c.name)
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        key={c.key}
                        className={`${styles.convoRow} ${mode === "thread" && selectedKey === c.key ? styles.convoRowActive : ""} ${c.hasUnread ? styles.convoRowUnread : ""}`}
                        onClick={() => { setMode("thread"); setSelectedKey(c.key) }}
                        onKeyDown={(e) => { if (e.key === "Enter") { setMode("thread"); setSelectedKey(c.key) } }}
                      >
                        <div className={styles.avatarWrap} style={{ background: avatarBg }}>
                          {initials}
                        </div>

                        <div className={styles.convoBody}>
                          <div className={styles.convoRowLine1}>
                            <span className={styles.convoName}>{c.name}</span>
                            <span className={`${styles.crmTag} ${styles[`crmTag_${c.crmType.toLowerCase()}`]}`}>
                              {c.crmType}
                            </span>
                            <span className={styles.convoDate}>{formatDate(c.lastDate)}</span>
                          </div>

                          <div className={styles.convoRowLine2}>
                            <span className={styles.convoSnippet}>
                              {c.lastFromMe && <strong className={styles.youPrefix}>You: </strong>}
                              {c.lastSnippet}
                            </span>
                          </div>
                        </div>

                        <div className={styles.convoRowActions}>
                          {c.hasUnread && <span className={styles.unreadDot} title="Unread" />}
                          <button
                            type="button"
                            className={`${styles.starBtn} ${c.hasStarred ? styles.starBtnActive : ""}`}
                            aria-label={c.hasStarred ? "Unstar conversation" : "Star conversation"}
                            onClick={(e) => toggleStar(c.messages[c.messages.length - 1], e)}
                          >
                            {c.hasStarred ? <MdStar size={16} /> : <MdStarBorder size={16} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={sentinelRef} className={styles.listSentinel}>
                    {loadingMore ? "Loading more messages..." : hasMoreMessages ? "" : filteredConversations.length > 0 ? "All messages loaded" : ""}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---- Right Pane: Thread View OR Full Composer ---- */}
          {mode === "compose" ? (
            <div className={styles.composerPanel}>
              <div className={styles.composerHeader}>
                {conversations.length > 0 && (
                  <button type="button" className={styles.backBtn} onClick={() => setMode("thread")} aria-label="Back to conversations">
                    <MdArrowBack size={18} />
                  </button>
                )}
                <div className={styles.composerIconWrap}>
                  <MdOutlineForwardToInbox size={20} />
                </div>
                <div>
                  <div className={styles.composerTitle}>New Email</div>
                  <div className={styles.composerSub}>Sent directly via your connected Gmail or organizational SMTP</div>
                </div>
              </div>

              <form onSubmit={handleSend} className={styles.composerBody}>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label>Recipient - Search CRM contact or lead</label>
                    <AsyncSelect
                      fetchOptions={fetchClientOptions}
                      value={selectedClient ? `${selectedClient.type}:${selectedClient.id}` : ""}
                      selectedLabel={selectedClient ? `${selectedClient.name} (${selectedClient.tag}) - ${selectedClient.email}` : ""}
                      onChange={(opt) => {
                        setSelectedClient(opt.raw)
                        setRawEmail("")
                        if (activeTemplate) applyTemplate(activeTemplate, opt.raw)
                      }}
                      placeholder="Search by name, company, or email..."
                    />
                  </div>

                  <div className={styles.formField}>
                    <label>...Or type custom email</label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={rawEmail}
                      onChange={(e) => { setRawEmail(e.target.value); if (e.target.value) setSelectedClient(null) }}
                      disabled={!!selectedClient}
                    />
                  </div>
                </div>

                {toAddress && (
                  <div className={styles.recipientPreview}>
                    <MdOutlineMailOutline size={14} />
                    <span>Delivering to: <strong>{toAddress}</strong></span>
                  </div>
                )}

                <div className={styles.formField}>
                  <label>Template (optional)</label>
                  <AsyncSelect
                    fetchOptions={fetchTemplateOptions}
                    value={templateId}
                    selectedLabel={activeTemplate?.name || ""}
                    onChange={(opt) => applyTemplate(opt ? opt.raw : null)}
                    placeholder="Select email template..."
                  />
                </div>

                <div className={styles.formField}>
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Next Steps regarding your proposal"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className={`${styles.formField} ${styles.messageField}`}>
                  <label>Message Content</label>
                  <textarea
                    placeholder="Write your email content here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formField}>
                  <label>Attachments</label>
                  <label
                    className={styles.attachPicker}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        e.currentTarget.querySelector("input[type=file]")?.click()
                      }
                    }}
                  >
                    <MdOutlineAttachFile size={16} />
                    <span>Attach files (up to 5)</span>
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || [])
                        setAttachedFiles((prev) => [...prev, ...picked].slice(0, 5))
                        e.target.value = ""
                      }}
                    />
                  </label>
                  {attachedFiles.length > 0 && (
                    <div className={styles.attachedList}>
                      {attachedFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className={styles.attachedChip}>
                          <span className={styles.attachedName}>{f.name}</span>
                          <span className={styles.attachmentSize}>{formatFileSize(f.size)}</span>
                          <button type="button" onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <TemplateMissingFields tags={missingTags} values={manualValues} onChange={updateManualValue} />
              </form>

              <div className={styles.composerFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setMode("thread")}>
                  Cancel
                </button>
                <button type="submit" className={styles.sendBtn} disabled={sending} onClick={handleSend}>
                  {sending ? "Sending..." : (
                    <>
                      <MdSend size={15} />
                      <span>Send Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.threadPanel}>
              {loading ? (
                <div className={styles.emptyFeed}>
                  <div className={styles.loaderSpinner} />
                  <span className={styles.loadingText}>Loading conversations...</span>
                </div>
              ) : !selectedConversation ? (
                <div className={styles.emptyFeed}>
                  <EmptyState type="mail" title="No email selected" hint="Select a conversation from the left rail to view message history, or compose a new email." />
                </div>
              ) : (
                <>
                  {/* ---- Thread Header ---- */}
                  <div className={styles.threadHeader}>
                    <div className={styles.threadHeaderLeft}>
                      <div className={styles.avatarWrapLg} style={{ background: getAvatarColor(selectedConversation.name) }}>
                        {getInitials(selectedConversation.name)}
                      </div>
                      <div className={styles.threadHeaderTextGroup}>
                        <div className={styles.threadHeaderTitleRow}>
                          <h2 className={styles.threadHeaderName}>{selectedConversation.name}</h2>
                          <span className={`${styles.crmTag} ${styles[`crmTag_${selectedConversation.crmType.toLowerCase()}`]}`}>
                            {selectedConversation.crmType}
                          </span>
                        </div>
                        {selectedConversation.email && (
                          <div className={styles.threadHeaderEmail} title={selectedConversation.email}>
                            {selectedConversation.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.threadHeaderActions}>
                      <button
                        type="button"
                        className={`${styles.starBtnHeader} ${selectedConversation.hasStarred ? styles.starBtnActive : ""}`}
                        aria-label={selectedConversation.hasStarred ? "Unstar conversation" : "Star conversation"}
                        onClick={(e) => toggleStar(selectedConversation.messages[selectedConversation.messages.length - 1], e)}
                      >
                        {selectedConversation.hasStarred ? <MdStar size={18} /> : <MdStarBorder size={18} />}
                      </button>

                      {!selectedConversation.key.startsWith("lead:") && !selectedConversation.key.startsWith("contact:") && (
                        <button type="button" className={styles.linkCrmBtn} onClick={() => setShowLinkPicker((v) => !v)}>
                          <MdLink size={15} />
                          <span>Link to CRM</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.replyHeaderBtn}
                        onClick={handleFocusQuickReply}
                      >
                        <MdReply size={16} />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>

                  {showLinkPicker && (
                    <div className={styles.linkPickerRow}>
                      <AsyncSelect
                        fetchOptions={fetchClientOptions}
                        value=""
                        selectedLabel=""
                        onChange={(opt) => linkConversationTo(opt.raw)}
                        placeholder={linkingBusy ? "Linking..." : "Search a lead or contact to link this address to..."}
                      />
                      <button type="button" className={styles.linkPickerCancel} onClick={() => setShowLinkPicker(false)}>Cancel</button>
                    </div>
                  )}

                  {/* ---- Messages Scroll View ---- */}
                  <div className={styles.threadScroll}>
                    {selectedConversation.messages.map((a) => {
                      const isReply = a.direction === "inbound"
                      return (
                        <div
                          key={a.id}
                          className={`${styles.messageCard} ${isReply ? styles.receivedMessage : styles.sentMessage} ${a.bodyHtml ? styles.htmlMessage : ""}`}
                        >
                          <div className={styles.messageMeta}>
                            <div className={styles.senderInfo}>
                              <span className={styles.senderBadge}>
                                {isReply ? (a.from || "Client") : "You"}
                              </span>
                              {a.ccEmails && <span className={styles.messageCc}>Cc: {a.ccEmails}</span>}
                            </div>
                            <span className={styles.messageDate}>{formatDate(a.date)}</span>
                          </div>

                          <div className={styles.messageBody}>
                            {a.subject && <div className={styles.subjectLine}>{a.subject}</div>}
                            <EmailBody bodyHtml={a.bodyHtml} bodyText={a.body} />

                            {a.attachments?.length > 0 && (
                              <div className={styles.attachmentRow}>
                                {a.attachments.map((att) => (
                                  <a
                                    key={att.attachmentId}
                                    className={styles.attachmentChip}
                                    href={fileUrl(`/email-messages/${a.dbId}/attachments/${att.attachmentId}`)}
                                    download={att.filename}
                                  >
                                    <MdOutlineAttachFile size={14} />
                                    <span className={styles.attachmentFileName}>{att.filename}</span>
                                    <span className={styles.attachmentFileSize}>{formatFileSize(att.size)}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* ---- Quick Inline Reply Dock ---- */}
                    <div className={styles.inlineReplyDock}>
                      <div className={styles.inlineReplyHeader}>
                        <div className={styles.inlineReplyLabel}>
                          <MdReply size={15} />
                          <span>Reply to <strong>{selectedConversation.name}</strong></span>
                        </div>
                        <button
                          type="button"
                          className={styles.fullComposerBtn}
                          onClick={() => {
                            const last = selectedConversation.messages[selectedConversation.messages.length - 1]
                            openCompose({
                              email: selectedConversation.email,
                              subject: `Re: ${last?.subject || ""}`,
                              inReplyTo: last?.messageIdHeader || null,
                              gmailThreadId: last?.gmailThreadId || null,
                            })
                          }}
                        >
                          Open in Full Composer
                        </button>
                      </div>

                      <form onSubmit={handleSendQuickReply} className={styles.inlineReplyForm}>
                        <textarea
                          ref={quickReplyInputRef}
                          className={styles.inlineReplyTextarea}
                          placeholder="Type your reply here... (Shift+Enter for new line)"
                          value={inlineReplyText}
                          onChange={(e) => setInlineReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !inlineSending) {
                              e.preventDefault()
                              handleSendQuickReply(e)
                            }
                          }}
                        />

                        {inlineAttachedFiles.length > 0 && (
                          <div className={styles.inlineAttachedList}>
                            {inlineAttachedFiles.map((f, i) => (
                              <div key={`${f.name}-${i}`} className={styles.inlineAttachedChip}>
                                <span>{f.name} ({formatFileSize(f.size)})</span>
                                <button type="button" onClick={() => setInlineAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.inlineReplyActions}>
                          <label className={styles.inlineAttachBtn} title="Attach files">
                            <MdOutlineAttachFile size={16} />
                            <span>Attach</span>
                            <input
                              type="file"
                              multiple
                              hidden
                              onChange={(e) => {
                                const picked = Array.from(e.target.files || [])
                                setInlineAttachedFiles((prev) => [...prev, ...picked].slice(0, 5))
                                e.target.value = ""
                              }}
                            />
                          </label>

                          <button
                            type="submit"
                            className={styles.inlineSendBtn}
                            disabled={inlineSending || !inlineReplyText.trim()}
                          >
                            {inlineSending ? "Sending..." : (
                              <>
                                <MdSend size={14} />
                                <span>Send</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div ref={threadEndRef} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {toast.type === "success" ? <MdCheckCircle size={15} /> : <MdCancel size={15} />} {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
