import { useState, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  MdOutlineViewKanban,
  MdOutlineSecurity,
  MdOutlineFactCheck,
  MdVisibility,
  MdVisibilityOff,
  MdArrowForward,
} from "react-icons/md"
import {
  FaGoogle,
  FaApple,
  FaGithub,
  FaMicrosoft,
} from "react-icons/fa"
import { useAuth } from "../../context/AuthContext.jsx"
import { useTheme } from "../../context/ThemeContext.jsx"
import { googleSignInUrl } from "../../api/client.js"
import logo from "../../assets/UniLead-logo.svg"
import logoWhite from "../../assets/UniLead-logo-white.svg"
import styles from "./Login.module.css"

const HIGHLIGHTS = [
  { icon: MdOutlineViewKanban, title: "Pipeline that moves", text: "Drag deals across custom stages and watch win rate update live." },
  { icon: MdOutlineSecurity, title: "Role-based security", text: "Every seat gets exactly the access it needs, nothing more." },
  { icon: MdOutlineFactCheck, title: "Full audit trail", text: "Every login, edit and role change is logged automatically." },
]

const TYPEWRITER_PHRASES = [
  "Build high-converting pipelines",
  "Automate your sales workflow",
  "Empower your revenue team",
  "Close deals faster with AI"
]

export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Typewriter effect state
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [currentText, setCurrentText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fullText = TYPEWRITER_PHRASES[phraseIndex]
    const timeoutSpeed = isDeleting ? 40 : 80

    const timer = setTimeout(() => {
      if (!isDeleting) {
        setCurrentText(fullText.substring(0, currentText.length + 1))
        if (currentText.length + 1 === fullText.length) {
          setTimeout(() => setIsDeleting(true), 2000)
        }
      } else {
        setCurrentText(fullText.substring(0, currentText.length - 1))
        if (currentText.length === 0) {
          setIsDeleting(false)
          setPhraseIndex((prev) => (prev + 1) % TYPEWRITER_PHRASES.length)
        }
      }
    }, timeoutSpeed)

    return () => clearTimeout(timer)
  }, [currentText, isDeleting, phraseIndex])

  useEffect(() => {
    const googleParam = new URLSearchParams(location.search).get("google")
    const GOOGLE_ERRORS = {
      denied: "Google sign-in was cancelled.",
      error: "Google sign-in failed. Please try again or use your email & password.",
      suspended: "This organization has been suspended. Contact support.",
      inactive: "This account has been deactivated.",
    }
    if (googleParam && GOOGLE_ERRORS[googleParam]) setError(GOOGLE_ERRORS[googleParam])
  }, [location.search])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, password)
      const from = location.state?.from?.pathname || "/dashboard"
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Animated ambient background */}
      <div className={styles.meshBg} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className={styles.noiseOverlay} aria-hidden="true" />

      {/* Fixed Theme Toggle Button */}
      <button
        type="button"
        className={styles.themeToggle}
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === "light" ? (
            <motion.svg
              key="moon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <path
                d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="sun"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </button>

      {/* 2-Panel Split Grid Container */}
      <div className={styles.shell}>
        {/* Left Brand Showcase Panel */}
        <motion.div
          className={styles.brandPanel}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.brandPanelInner}>
            <Link to="/" className={styles.brandLogoLink}>
              <img className={styles.brandLogoWhite} src={logoWhite} alt="UniLead" />
            </Link>

            <div className={styles.brandCopy}>
              <span className={styles.brandBadge}>Next-Gen Sales Workspace</span>
              <h2 className={styles.brandTitle}>Sell smarter. Scale faster.</h2>
              <p className={styles.brandSubtitle}>
                A modern, multi-tenant CRM built for high-performance teams to close deals in record time.
              </p>
            </div>

            <ul className={styles.highlightList}>
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className={styles.highlightItem}>
                  <span className={styles.highlightIcon}><Icon size={20} /></span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className={styles.brandFooter}>Trusted by revenue teams to run their entire sales motion.</p>
          </div>
        </motion.div>

        {/* Right Form Panel */}
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

            <div className={styles.titleBlock}>
              <h1 className={styles.title}>
                Welcome <span className={styles.titleGradient}>back</span>
              </h1>
              <p className={styles.subtitle}>
                {currentText}<span style={{ opacity: 0.75 }}>|</span>
              </p>
            </div>

            {/* Social choices */}
            <div className={styles.socialButtons}>
              <a
                href={googleSignInUrl()}
                className={styles.socialBtn}
              >
                <span className={styles.socialBtnIcon}>
                  <FaGoogle size={16} />
                </span>
                <span>Continue with Google</span>
              </a>

              <div className={styles.comingSoonWrap} title="Coming soon">
                <span className={styles.comingSoonBadge}>Coming soon</span>
                <div className={styles.comingSoonBlocker} title="Coming soon" aria-hidden="true" />
                <div className={styles.socialSecondary}>
                  <button type="button" className={styles.socialBtnSmall} tabIndex={-1} disabled>
                    <span className={styles.socialBtnSmallIcon}><FaApple size={15} /></span> Apple
                  </button>
                  <button type="button" className={styles.socialBtnSmall} tabIndex={-1} disabled>
                    <span className={styles.socialBtnSmallIcon}><FaGithub size={15} /></span> GitHub
                  </button>
                  <button type="button" className={styles.socialBtnSmall} tabIndex={-1} disabled>
                    <span className={styles.socialBtnSmallIcon}><FaMicrosoft size={14} /></span> Microsoft
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.divider}>
              <span className={styles.dividerText}>or work email</span>
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

              <div className={styles.field}>
                <div className={styles.fieldLabelRow}>
                  <label htmlFor="password">Password</label>
                  <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
                </div>
                <div className={styles.passwordWrap}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
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

              <AnimatePresence>
                {error && (
                  <motion.p
                    className={styles.error}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                className={styles.submitBtn}
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <>
                    Sign in to Workspace <MdArrowForward size={17} />
                  </>
                )}
              </motion.button>
            </form>

            <p className={styles.hint}>
              Don't have an account yet? <Link to="/signup">Create your organization</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
