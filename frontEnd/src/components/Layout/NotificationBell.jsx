import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdOutlineNotifications } from "react-icons/md"
import { api } from "../../api/client.js"
import { formatDate } from "../../lib/format.js"
import styles from "./Topbar.module.css"

const ENTITY_PATH = { TASK: "/tasks", DEAL: "/deals" }

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api.get("/notifications").then((res) => {
      setNotifications(res.notifications)
      setUnreadCount(res.unreadCount)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [open])

  async function handleClickNotification(n) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount((c) => Math.max(0, c - 1))
      api.patch(`/notifications/${n.id}/read`).catch(() => {})
    }
    setOpen(false)
    if (n.entityType && ENTITY_PATH[n.entityType]) navigate(ENTITY_PATH[n.entityType])
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    api.patch("/notifications/read-all").catch(() => {})
  }

  return (
    <div className={styles.avatarContainer} ref={wrapRef}>
      <motion.button
        className={styles.iconBtn}
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.06 }}
      >
        <MdOutlineNotifications size={19} />
        {unreadCount > 0 && <span className={styles.dot} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.notificationDropdown}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.notificationHeader}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button className={styles.markAllBtn} onClick={markAllRead}>Mark all read</button>
              )}
            </div>
            <div className={styles.notificationList}>
              {notifications.length === 0 ? (
                <p className={styles.notificationEmpty}>No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`${styles.notificationItem} ${n.read ? "" : styles.notificationUnread}`}
                    onClick={() => handleClickNotification(n)}
                  >
                    <span className={styles.notificationMsg}>{n.message}</span>
                    <span className={styles.notificationDate}>{formatDate(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
