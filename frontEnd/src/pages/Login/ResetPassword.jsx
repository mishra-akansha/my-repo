import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdArrowForward, MdVisibility, MdVisibilityOff } from "react-icons/md"
import { api } from "../../api/client.js"
import { useTheme } from "../../context/ThemeContext.jsx"
import logo from "../../assets/UniLead-logo.svg"
import logoWhite from "../../assets/UniLead-logo-white.svg"
import styles from "./Login.module.css"

export default function ResetPassword() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const token = new URLSearchParams(location.search).get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/reset-password", { token, password })
      setDone(true)
      setTimeout(() => navigate("/login", { replace: true }), 2500)
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.meshBg} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.noiseOverlay} aria-hidden="true" />

      <button type="button" className={styles.themeToggle} aria-label="Toggle theme" onClick={toggleTheme}>
        <AnimatePresence mode="wait" initial={false}>
          {theme === "light" ? (
            <motion.svg key="moon" width="18" height="18" viewBox="0 0 24 24" fill="none"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </motion.svg>
          ) : (
            <motion.svg key="sun" width="18" height="18" viewBox="0 0 24 24" fill="none"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: -90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </button>

      <div className={styles.shell} style={{ gridTemplateColumns: "1fr" }}>
        <motion.div
          className={styles.formPanel}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <div className={styles.card}>
            <div className={styles.brand}>
              <Link to="/">
                <img className={`${styles.brandLogo} ${styles.brandLogoLight}`} src={logo} alt="UniLead" />
                <img className={`${styles.brandLogo} ${styles.brandLogoDark}`} src={logoWhite} alt="UniLead" />
              </Link>
            </div>

            {!token ? (
              <>
                <div className={styles.titleBlock}>
                  <h1 className={styles.title}>Invalid <span className={styles.titleGradient}>link</span></h1>
                  <p className={styles.subtitle}>This reset link is missing its token. Request a new one.</p>
                </div>
                <Link to="/forgot-password" className={styles.submitBtn} style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  Request a new link
                </Link>
              </>
            ) : done ? (
              <div className={styles.titleBlock}>
                <h1 className={styles.title}>Password <span className={styles.titleGradient}>updated</span></h1>
                <p className={styles.subtitle}>Redirecting you to sign in…</p>
              </div>
            ) : (
              <>
                <div className={styles.titleBlock}>
                  <h1 className={styles.title}>Set a new <span className={styles.titleGradient}>password</span></h1>
                  <p className={styles.subtitle}>Choose something you haven't used before.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                  <div className={styles.field}>
                    <label htmlFor="password">New password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((s) => !s)}
                      >
                        {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p className={styles.error} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button className={styles.submitBtn} type="submit" disabled={loading} whileTap={{ scale: 0.98 }}>
                    {loading ? <span className={styles.spinner} aria-hidden="true" /> : <>Update password <MdArrowForward size={17} /></>}
                  </motion.button>
                </form>
              </>
            )}

            <p className={styles.hint}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
