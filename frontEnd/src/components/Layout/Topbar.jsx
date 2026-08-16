import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MdSearch } from "react-icons/md"
import Avatar from "../UI/Avatar.jsx"
import Modal from "../UI/Modal.jsx"
import modalStyles from "../UI/Modal.module.css"
import NotificationBell from "./NotificationBell.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { useTheme } from "../../context/ThemeContext.jsx"
import { initialsOf } from "../../lib/format.js"
import { api } from "../../api/client.js"
import styles from "./Topbar.module.css"

export default function Topbar({ title, subtitle, action }) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handlePasswordChange(e) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword !== confirmPassword) {
      return setError("New passwords do not match")
    }

    setSubmitting(true)
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword })
      setSuccess("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError(err.message || "Failed to change password")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.header
      className={styles.topbar}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.search}
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <MdSearch size={16} />
          <span className={styles.searchPlaceholder}>Search leads, deals, contacts…</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>

        {action}

        <motion.button
          className={styles.iconBtn}
          aria-label="Toggle theme"
          onClick={toggleTheme}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === "light" ? (
              <motion.svg
                key="moon"
                width="17" height="17" viewBox="0 0 24 24" fill="none"
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </motion.svg>
            ) : (
              <motion.svg
                key="sun"
                width="17" height="17" viewBox="0 0 24 24" fill="none"
                initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        <NotificationBell />

        {user && (
          <div className={styles.avatarContainer}>
            <motion.button
              className={styles.iconBtn}
              aria-label="User menu"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.06 }}
            >
              <Avatar name={user.name} initials={initialsOf(user.name)} color={user.color} size={30} />
            </motion.button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  className={styles.dropdown}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setSettingsOpen(true)
                      setDropdownOpen(false)
                      setError("")
                      setSuccess("")
                    }}
                  >
                    Profile Settings
                  </button>
                  <button
                    className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                    onClick={() => {
                      logout()
                      setDropdownOpen(false)
                    }}
                  >
                    Log out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.header>

    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Profile Settings">
      <div className={`${modalStyles.body} ${styles.modalBodyFlush}`}>
        <div className={styles.profileInfo}>
          <p className={styles.profileInfoRow}><strong>Name:</strong> {user?.name}</p>
          <p className={styles.profileInfoRow}><strong>Email:</strong> {user?.email}</p>
          <p className={styles.profileInfoRow}><strong>Role:</strong> {user?.roleName || user?.role?.name}</p>
          <p className={styles.profileInfoRow}><strong>Organization:</strong> {user?.organization?.name} ({user?.plan} plan)</p>
        </div>

        <form onSubmit={handlePasswordChange} className={`${modalStyles.body} ${styles.passwordForm}`}>
          <h4 className={styles.passwordFormTitle}>Change Password</h4>
          
          <div className={modalStyles.field}>
            <label>Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label>New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className={modalStyles.field}>
              <label>Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className={modalStyles.error}>{error}</p>}
          {success && <p className={styles.successMsg}>{success}</p>}

          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setSettingsOpen(false)}>Close</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  </>
)
}