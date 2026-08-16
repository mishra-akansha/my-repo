import { useState, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { MdCheckCircle, MdVisibility, MdVisibilityOff, MdArrowForward, MdArrowBack } from "react-icons/md"
import { FaGoogle } from "react-icons/fa"
import { useAuth } from "../../context/AuthContext.jsx"
import { useTheme } from "../../context/ThemeContext.jsx"
import { PLAN_DETAILS as fallbackPlans } from "../../lib/plans.js"
import { api, googleSignInUrl } from "../../api/client.js"
import logo from "../../assets/UniLead-logo.svg"
import logoWhite from "../../assets/UniLead-logo-white.svg"
import styles from "./Signup.module.css"
import loginStyles from "../Login/Login.module.css"

export default function Signup() {
  const { signup, signupWithGoogle } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const googleToken = searchParams.get("googleToken")

  const [step, setStep] = useState(1)
  const [plan, setPlan] = useState("pro")
  const [organizationName, setOrganizationName] = useState("")
  const [name, setName] = useState(searchParams.get("name") || "")
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Dynamic plans loaded from API
  const [plans, setPlans] = useState(fallbackPlans)

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await api.get("/public/plans")
        if (data && Array.isArray(data) && data.length > 0) {
          setPlans(data)
        }
      } catch (err) {
        console.warn("Could not load plans from database, falling back to static list", err)
      }
    }
    loadPlans()
  }, [])

  const selectedPlan = plans.find((p) => p.id === plan) || plans[0]

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (googleToken) {
        await signupWithGoogle(googleToken, organizationName, plan)
      } else {
        await signup(name, email, password, organizationName, plan)
      }
      navigate("/", { replace: true })
    } catch (err) {
      setError(err.message || "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={loginStyles.wrap}>
      <div className={loginStyles.meshBg} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <button
        type="button"
        className={loginStyles.themeToggle}
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === "light" ? (
            <motion.svg
              key="moon" width="18" height="18" viewBox="0 0 24 24" fill="none"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </motion.svg>
          ) : (
            <motion.svg
              key="sun" width="18" height="18" viewBox="0 0 24 24" fill="none"
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
      </button>

      <div className={`${loginStyles.shell} ${step === 1 ? styles.shellWide : ""}`}>
        <motion.div
          className={loginStyles.brandPanel}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={loginStyles.brandPanelInner}>
            <Link to="/" className={loginStyles.brandLogoLink}>
              <img className={loginStyles.brandLogoWhite} src={logoWhite} alt="UniLead" />
            </Link>

            <div className={loginStyles.brandCopy}>
              <span className={loginStyles.brandBadge}>Start free, upgrade anytime</span>
              <h2 className={loginStyles.brandTitle}>Set up your workspace in minutes.</h2>
              <p className={loginStyles.brandSubtitle}>
                Pick a plan, name your organization, and start working your pipeline — no credit card required.
              </p>
            </div>

            <ul className={styles.stepList}>
              <li className={step >= 1 ? styles.stepDone : ""}>
                <span className={styles.stepDot}>{step > 1 ? <MdCheckCircle size={16} /> : "1"}</span>
                Choose a plan
              </li>
              <li className={step >= 2 ? styles.stepDone : ""}>
                <span className={styles.stepDot}>2</span>
                Create your account
              </li>
            </ul>

            <p className={loginStyles.brandFooter}>Trusted by revenue teams to run their entire sales motion.</p>
          </div>
        </motion.div>

        <motion.div
          className={loginStyles.formPanel}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <div className={`${loginStyles.card} ${step === 1 ? styles.cardWide : ""}`}>
            <div className={styles.cardHeaderTop}>
              <div className={loginStyles.brand}>
                <img className={`${loginStyles.brandLogo} ${loginStyles.brandLogoLight}`} src={logo} alt="UniLead" />
                <img className={`${loginStyles.brandLogo} ${loginStyles.brandLogoDark}`} src={logoWhite} alt="UniLead" />
              </div>
              <div className={styles.mobileStepBadge}>
                Step {step} of 2
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className={loginStyles.titleBlock}>
                    <h1 className={loginStyles.title}>Pick a plan</h1>
                    <p className={loginStyles.subtitle}>You can upgrade later — this just sets your starting limits.</p>
                  </div>

                  <div className={styles.planGrid}>
                    {plans.map((p) => {
                      const isPopular = p.id === "pro"
                      const isSelected = plan === p.id
                      const hasSlash = p.price && typeof p.price === 'string' && p.price.includes("/")
                      const priceMain = hasSlash ? p.price.split("/")[0] : p.price
                      const pricePeriod = hasSlash ? `/${p.price.split("/")[1]}` : ""

                      return (
                        <motion.button
                          key={p.id}
                          type="button"
                          className={`${styles.planCard} ${isSelected ? styles.planCardActive : ""} ${isPopular ? styles.planCardPopular : ""}`}
                          onClick={() => setPlan(p.id)}
                          whileTap={{ scale: 0.98 }}
                        >
                          {isPopular && (
                            <div className={styles.popularBadgeWrap}>
                              <span className={styles.popularBadge}>Most Popular</span>
                            </div>
                          )}

                          <div className={styles.planCardHeader}>
                            <div className={styles.planTopRow}>
                              <span className={styles.planLabel}>{p.label}</span>
                              <div className={styles.planRadio}>
                                {isSelected ? (
                                  <MdCheckCircle className={styles.planRadioChecked} size={20} />
                                ) : (
                                  <span className={styles.planRadioUnchecked} />
                                )}
                              </div>
                            </div>
                            <div className={styles.planPriceWrap}>
                              <span className={styles.planPriceMain}>{priceMain}</span>
                              {pricePeriod && <span className={styles.planPricePeriod}>{pricePeriod}</span>}
                            </div>
                            <p className={styles.planBlurb}>{p.blurb}</p>
                          </div>

                          <div className={styles.planDivider} />

                          <ul className={styles.planFeatures}>
                            {p.features && p.features.map((f) => {
                              const isCross = typeof f === "string" && f.startsWith("✕")
                              const cleanText = typeof f === "string" ? f.replace(/^[✓✕]\s*/, "") : f
                              return (
                                <li key={f} className={isCross ? styles.featureDisabled : ""}>
                                  <span className={styles.featureIcon}>
                                    {isCross ? "✕" : "✓"}
                                  </span>
                                  <span>{cleanText}</span>
                                </li>
                              )
                            })}
                          </ul>
                        </motion.button>
                      )
                    })}
                  </div>

                  <motion.button
                    type="button"
                    className={loginStyles.submitBtn}
                    onClick={() => setStep(2)}
                    whileTap={{ scale: 0.98 }}
                  >
                    Continue with {selectedPlan?.label} <MdArrowForward size={17} />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button
                    type="button"
                    className={styles.topBackBtn}
                    onClick={() => setStep(1)}
                    aria-label="Back to plan selection"
                  >
                    <MdArrowBack size={16} />
                    <span>Back to plans</span>
                  </button>

                  <div className={loginStyles.titleBlock}>
                    <h1 className={loginStyles.title}>Create your workspace</h1>
                    <p className={loginStyles.subtitle}>
                      {selectedPlan?.label} plan — you'll be its Org Admin.{" "}
                      <button type="button" className={styles.changePlanBtn} onClick={() => setStep(1)}>Change plan</button>
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className={loginStyles.form} noValidate>
                    {googleToken ? (
                      <div className={styles.googleIdentity}>
                        <FaGoogle size={15} />
                        <span>Signed in as <strong>{email}</strong> via Google</span>
                      </div>
                    ) : (
                      <a href={googleSignInUrl()} className={loginStyles.socialBtn}>
                        <span className={loginStyles.socialBtnIcon}><FaGoogle size={16} /></span>
                        <span>Continue with Google</span>
                      </a>
                    )}

                    {!googleToken && (
                      <>
                        <div className={loginStyles.divider}>
                          <span className={loginStyles.dividerText}>or work email</span>
                        </div>
                        <div className={styles.comingSoonWrap} title="Coming soon">
                          <span className={styles.comingSoonBadge}>Coming soon</span>
                          <div className={styles.comingSoonBlocker} title="Coming soon" aria-hidden="true" />
                          <fieldset className={styles.comingSoonFields} disabled>
                            <div className={loginStyles.field}>
                              <label htmlFor="name">Your name</label>
                              <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className={loginStyles.field}>
                              <label htmlFor="email">Email</label>
                              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className={loginStyles.field}>
                              <label htmlFor="password">Password</label>
                              <div className={loginStyles.passwordWrap}>
                                <input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  minLength={8}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className={loginStyles.passwordToggle}
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                  onClick={() => setShowPassword((s) => !s)}
                                >
                                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                                </button>
                              </div>
                              <span className={styles.fieldHint}>At least 8 characters</span>
                            </div>
                          </fieldset>
                        </div>
                      </>
                    )}

                    {googleToken && (
                      <div className={loginStyles.field}>
                        <label htmlFor="orgName">Company / organization name</label>
                        <input id="orgName" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
                      </div>
                    )}

                    {!googleToken && (
                      <p className={styles.fieldHint}>
                        Email &amp; password signup is coming soon — use Google to create your workspace today.
                      </p>
                    )}

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          className={loginStyles.error}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {googleToken && (
                      <div className={styles.formActions}>
                        <motion.button className={loginStyles.submitBtn} type="submit" disabled={loading} whileTap={{ scale: 0.98 }}>
                          {loading ? <span className={loginStyles.spinner} aria-hidden="true" /> : <>Create workspace <MdArrowForward size={17} /></>}
                        </motion.button>
                      </div>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <p className={loginStyles.hint}>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
