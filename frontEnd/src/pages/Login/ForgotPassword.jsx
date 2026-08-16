import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdArrowForward, MdArrowBack } from "react-icons/md"
import { api } from "../../api/client.js"
import { useTheme } from "../../context/ThemeContext.jsx"
import logo from "../../assets/UniLead-logo.svg"
import logoWhite from "../../assets/UniLead-logo-white.svg"
import styles from "./Login.module.css"

export default function ForgotPassword() {
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.post("/auth/forgot-password", { email })
      setSent(true)
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.")
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

            {sent ? (
              <>
                <div className={styles.titleBlock}>
                  <h1 className={styles.title}>Check your <span className={styles.titleGradient}>email</span></h1>
                  <p className={styles.subtitle}>
                    If <strong>{email}</strong> is registered, a reset link is on its way. It expires in 30 minutes.
                  </p>
                </div>
                <Link to="/login" className={styles.submitBtn} style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                  <MdArrowBack size={16} /> Back to sign in
                </Link>
              </>
            ) : (
              <>
                <div className={styles.titleBlock}>
                  <h1 className={styles.title}>Forgot your <span className={styles.titleGradient}>password</span>?</h1>
                  <p className={styles.subtitle}>Enter your work email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                  <div className={styles.field}>
                    <label htmlFor="email">Work Email</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    {loading ? <span className={styles.spinner} aria-hidden="true" /> : <>Send reset link <MdArrowForward size={17} /></>}
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
