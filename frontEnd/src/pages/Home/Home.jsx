import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  MdOutlineSecurity,
  MdOutlineBolt,
  MdCheckCircle,
  MdOutlineArrowForward,
  MdExpandMore,
  MdMenu,
  MdClose,
  MdAutoAwesome,
  MdPlayArrow,
  MdOutlineEventNote,
  MdOutlineScore,
  MdOutlineTune,
} from "react-icons/md"
import { useTheme } from "../../context/ThemeContext.jsx"
import { api } from "../../api/client.js"
import { PLAN_DETAILS as fallbackPlans } from "../../lib/plans.js"
import logo from "../../assets/UniLead-logo.svg"
import logoWhite from "../../assets/UniLead-logo-white.svg"
import {
  PipelineIcon,
  SecurityIcon,
  CommsIcon,
  PlatformFlowIllustration,
  FloatingParticles,
  CountUpNumber,
  LogoTicker,
  SectionDivider,
  Sparkle,
  TestimonialCarousel,
  KanbanScene,
  EventScene,
  LeadScoreScene,
  CommsScene,
  CustomizationScene,
  SecurityScene,
} from "./illustrations.jsx"
import styles from "./Home.module.css"

/* ---- Navigation Links ---- */
const NAV_LINKS = [
  { href: "#features", label: "Capabilities" },
  { href: "#modules", label: "CRM Modules" },
  { href: "#workflow", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

/* ---- Platform Modules (with scene illustrations) ---- */
const PLATFORM_MODULES = [
  {
    icon: PipelineIcon,
    tag: "Core Workspace",
    title: "Kanban Deal Pipeline",
    text: "Drag & drop deals across custom sales stages. Instant revenue forecasting, stage probability calculation, and win rate analytics — all in a visual board.",
    Scene: KanbanScene,
  },
  {
    icon: MdOutlineEventNote,
    tag: "Operations Workspace",
    title: "Event & Project Manager",
    text: "Manage event projects, client budgets, vendor coordination, and task milestones within an integrated project control room.",
    Scene: EventScene,
  },
  {
    icon: MdOutlineScore,
    tag: "Automation Engine",
    title: "Lead Scoring & Rules",
    text: "Set automated scoring rules for incoming leads based on intent, deal size, engagement signals, and company demographics.",
    Scene: LeadScoreScene,
  },
  {
    icon: CommsIcon,
    tag: "Customer 360",
    title: "Unified Communications",
    text: "Centralize email threads, call logs, activity notes, and client communication histories on a single synchronized timeline.",
    Scene: CommsScene,
  },
  {
    icon: MdOutlineTune,
    tag: "Admin Controls",
    title: "Customization Studio",
    text: "Add custom fields to any entity, build reusable PDF invoice templates, manage client types, and configure organization settings.",
    Scene: CustomizationScene,
  },
  {
    icon: SecurityIcon,
    tag: "Tenant Security",
    title: "Role Security & Audit Logs",
    text: "Prisma-enforced tenant isolation, granular role permissions, and full activity audit logging out of the box.",
    Scene: SecurityScene,
  },
]

/* ---- Stats with counting animation ---- */
const STATS = [
  { value: "3.4", suffix: "x", label: "Faster Deal Closure" },
  { value: "48", suffix: "%", label: "Higher Lead Conversion" },
  { value: "99.99", suffix: "%", label: "Platform Uptime SLA" },
  { value: "5", prefix: "< ", suffix: " min", label: "Setup Time" },
]

/* ---- How it works ---- */
const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Import & Onboard",
    text: "Import your existing leads, contacts, and account databases seamlessly with guided field mapping.",
  },
  {
    step: "02",
    title: "Configure Pipelines & Roles",
    text: "Customize deal stages, assign team roles, and set automated lead scoring criteria.",
  },
  {
    step: "03",
    title: "Sell & Scale",
    text: "Execute sales motions, log customer activity automatically, and monitor live revenue dashboards.",
  },
]

/* ---- Testimonials ---- */
const TESTIMONIALS = [
  {
    quote:
      "UniLead's visual pipeline and 2-panel login design blew our sales team away. The event project workspace alone saved us 15 hours a week.",
    name: "Rohan Varma",
    role: "VP Sales, NextGen Digital",
  },
  {
    quote:
      "The role-based security and immutable audit trails allowed us to pass SOC 2 compliance sign-off in record time.",
    name: "Sophia Martinez",
    role: "Head of Operations, Omnipresent SaaS",
  },
  {
    quote:
      "Lead scoring and custom field mapping work effortlessly. We scaled from 5 to 50 sales reps without any friction.",
    name: "Arjun Nambiar",
    role: "Managing Director, Solis Global",
  },
  {
    quote:
      "The unified communications timeline gave us a complete 360° view of every customer touchpoint. Game changer.",
    name: "Priya Desai",
    role: "CRO, Apex Ventures",
  },
  {
    quote:
      "We migrated from Salesforce in under a day. The Kanban pipeline is more intuitive and the team adoption rate was 100% on day one.",
    name: "James Liu",
    role: "Sales Director, Quantum Corp",
  },
]

/* ---- FAQs ---- */
const FAQS = [
  {
    q: "Is my organization's data completely isolated from other tenants?",
    a: "Yes. UniLead enforces strict database-level multi-tenant isolation through Prisma ORM scoping so each organization operates in its own protected workspace.",
  },
  {
    q: "Can I customize stages, roles, and invoice templates?",
    a: "Absolutely. Our Customization Studio lets you configure custom pipeline stages, role permissions, custom fields, and branded document templates.",
  },
  {
    q: "Is the app responsive on mobile devices and tablets?",
    a: "Yes, UniLead is engineered with fluid mobile-responsive breakpoints, touch-friendly navigation, and adaptive dark/light layouts.",
  },
  {
    q: "How does the Free plan work?",
    a: "Every new organization receives full core CRM capabilities on the Free plan forever with zero time limits and no credit card required.",
  },
  {
    q: "Can I integrate UniLead with my existing email and calendar?",
    a: "Yes. UniLead supports Gmail sync, calendar integrations, and webhook-based automation triggers to connect with your existing stack.",
  },
]

/* ---- Typewriter taglines ---- */
const TAGLINES = [
  "Control your entire sales motion.",
  "Automate your revenue pipeline.",
  "Scale from startup to enterprise.",
  "Close deals faster than ever.",
]

/* ---- Framer Motion Variants ---- */
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

/* ---- Reveal wrapper ---- */
function Reveal({ as = "div", className, children, ...props }) {
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={staggerContainer}
      {...props}
    >
      {children}
    </MotionTag>
  )
}

/* ---- Theme Toggle Button ---- */
function ThemeToggleButton({ theme, toggleTheme, className }) {
  return (
    <button
      type="button"
      className={className}
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
            <circle
              cx="12"
              cy="12"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
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
  )
}

/* ---- Typewriter Hook ---- */
function useTypewriter(words, typingSpeed = 80, deletingSpeed = 50, pauseDuration = 2500) {
  const [text, setText] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentWord = words[wordIndex]

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentWord.substring(0, text.length + 1))
          if (text.length + 1 === currentWord.length) {
            setTimeout(() => setIsDeleting(true), pauseDuration)
          }
        } else {
          setText(currentWord.substring(0, text.length - 1))
          if (text.length === 0) {
            setIsDeleting(false)
            setWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    )

    return () => clearTimeout(timeout)
  }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration])

  return text
}

/* ==========================================================================
   MAIN HOME COMPONENT
   ========================================================================== */
export default function Home() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [promptText, setPromptText] = useState(
    "Generate an enterprise sales workspace with lead scoring & event management..."
  )

  // Dynamic plans loaded from DB
  const [plans, setPlans] = useState(fallbackPlans)

  // Typewriter effect
  const typewriterText = useTypewriter(TAGLINES)

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await api.get("/public/plans")
        if (data && Array.isArray(data) && data.length > 0) {
          setPlans(data)
        }
      } catch (err) {
        console.warn(
          "Could not load plans from database, falling back to static list",
          err
        )
      }
    }
    loadPlans()
  }, [])

  const handlePromptSubmit = useCallback(
    (e) => {
      e.preventDefault()
      navigate("/signup")
    },
    [navigate]
  )

  return (
    <div className={styles.container}>
      {/* ---- Background Orbs ---- */}
      <div className={styles.meshBg} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.noiseOverlay} aria-hidden="true" />

      {/* ---- Floating Particles ---- */}
      <FloatingParticles count={20} />

      {/* ---- Navbar ---- */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.brand}>
            <img
              className={`${styles.logoImg} ${styles.logoLight}`}
              src={logo}
              alt="UniLead"
            />
            <img
              className={`${styles.logoImg} ${styles.logoDark}`}
              src={logoWhite}
              alt="UniLead"
            />
          </Link>

          <nav className={styles.navLinks}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className={styles.navActions}>
            <ThemeToggleButton
              theme={theme}
              toggleTheme={toggleTheme}
              className={styles.themeToggle}
            />
            <Link to="/login" className={styles.loginBtn}>
              Sign In
            </Link>
            <Link to="/signup" className={styles.ctaBtnTiny}>
              Get Started Free
            </Link>
          </div>

          <button
            type="button"
            className={styles.mobileMenuBtn}
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <MdClose size={22} /> : <MdMenu size={22} />}
          </button>
        </div>
      </header>

      {/* ---- Mobile Drawer ---- */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className={styles.mobileMenu}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className={styles.mobileMenuActions}>
              <ThemeToggleButton
                theme={theme}
                toggleTheme={toggleTheme}
                className={styles.themeToggle}
              />
              <Link
                to="/login"
                className={styles.loginBtn}
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className={styles.ctaBtnTiny}
                onClick={() => setMobileOpen(false)}
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar stays fixed simply by sitting outside this scroll region —
          no position: sticky needed. */}
      <div className={styles.scrollArea}>

      {/* ==========================================================================
         HERO SECTION
         ========================================================================== */}
      <section className={styles.hero}>
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Sparkle decorations */}
          <Sparkle
            size={18}
            color="#c084fc"
            style={{ top: "-1rem", right: "15%", position: "absolute" }}
            delay={0}
          />
          <Sparkle
            size={14}
            color="#f472b6"
            style={{ bottom: "30%", left: "5%", position: "absolute" }}
            delay={1.2}
          />
          <Sparkle
            size={12}
            color="#a855f7"
            style={{ top: "20%", left: "12%", position: "absolute" }}
            delay={2.4}
          />

          <motion.div
            className={styles.badge}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4, type: "spring", stiffness: 300 }}
          >
            <MdAutoAwesome size={15} /> Next-Gen CRM Platform
          </motion.div>

          <h1 className={styles.title}>
            Sell Smarter. Scale Faster.
            <br />
            <span className={styles.gradientText}>
              <span className={styles.typewriterWrap}>
                {typewriterText}
                <span
                  style={{
                    display: "inline-block",
                    width: "2px",
                    height: "1em",
                    background: "#c084fc",
                    marginLeft: "2px",
                    verticalAlign: "text-bottom",
                    animation: "pulseGlow 1s step-end infinite",
                  }}
                />
              </span>
            </span>
          </h1>

          <p className={styles.subtitle}>
            UniLead is a modern, multi-tenant sales CRM with visual Kanban
            pipelines, lead scoring, event project management, and role-based
            tenant isolation — built for teams that move fast.
          </p>

          {/* Suno AI Creative Prompt Bar */}
          <form onSubmit={handlePromptSubmit} className={styles.sunoPromptBox}>
            <MdAutoAwesome className={styles.promptIcon} size={20} />
            <input
              type="text"
              className={styles.promptInput}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe your sales goal or workspace structure..."
            />
            <button type="submit" className={styles.promptBtn}>
              <MdPlayArrow size={18} /> Launch CRM
            </button>
          </form>

          <div className={styles.heroActions}>
            <Link to="/signup" className={styles.heroCta}>
              Start Free Trial <MdOutlineArrowForward size={18} />
            </Link>
            <a href="#modules" className={styles.heroSecondary}>
              Explore Modules <MdOutlineArrowForward size={14} />
            </a>
          </div>

          <p className={styles.heroNote}>
            No credit card required &middot; Free plan available forever &middot;
            Fully mobile responsive
          </p>
        </motion.div>

        {/* ---- Dashboard Mockup ---- */}
        <motion.div
          className={styles.mockupContainer}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.65 }}
        >
          <div className={styles.mockupGlass}>
            <div className={styles.mockupHeader}>
              <span className={styles.dotRed} />
              <span className={styles.dotYellow} />
              <span className={styles.dotGreen} />
              <div className={styles.mockupSearch}>
                UniLead.app/dashboard
              </div>
            </div>
            <div className={styles.mockupBody}>
              <div className={styles.mockupSidebar}>
                <div
                  className={`${styles.mockupSidebarLine} ${styles.mockupSidebarLineW60}`}
                />
                <div
                  className={`${styles.mockupSidebarLine} ${styles.mockupSidebarLineW45}`}
                />
                <div
                  className={`${styles.mockupSidebarLine} ${styles.mockupSidebarLineW50}`}
                />
                <div
                  className={`${styles.mockupSidebarLine} ${styles.mockupSidebarLineW40}`}
                />
              </div>
              <div className={styles.mockupContent}>
                <div className={styles.mockupCardsGrid}>
                  <motion.div
                    className={styles.mockupCard}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                  >
                    <div className={styles.mockupCardTitle}>Pipeline Value</div>
                    <div className={styles.mockupCardValue}>
                      $<CountUpNumber value="248500" duration={2} />
                    </div>
                  </motion.div>
                  <motion.div
                    className={styles.mockupCard}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    <div className={styles.mockupCardTitle}>Active Leads</div>
                    <div className={styles.mockupCardValue}>
                      <CountUpNumber value="124" duration={1.5} />
                    </div>
                  </motion.div>
                  <motion.div
                    className={styles.mockupCard}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                  >
                    <div className={styles.mockupCardTitle}>Win Rate</div>
                    <div className={styles.mockupCardValue}>
                      <CountUpNumber value="78" suffix="%" duration={1.5} />
                    </div>
                  </motion.div>
                </div>
                <div className={styles.mockupKanban}>
                  <motion.div
                    className={styles.mockupColumn}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8, duration: 0.4 }}
                  >
                    <div className={styles.mockupColumnTitle}>QUALIFIED</div>
                    <div className={styles.mockupItem} />
                    <div className={styles.mockupItem} />
                  </motion.div>
                  <motion.div
                    className={styles.mockupColumn}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                  >
                    <div className={styles.mockupColumnTitle}>PROPOSAL</div>
                    <div className={styles.mockupItem} />
                  </motion.div>
                  <motion.div
                    className={styles.mockupColumn}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0, duration: 0.4 }}
                  >
                    <div className={styles.mockupColumnTitle}>CLOSED WON</div>
                    <div className={styles.mockupItem} />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---- Trust Bar (Logo Ticker) ----
          Commented out for now — logos were placeholder company names, not
          real customers, so this read as a fake trust signal.
      <section className={styles.trustBar}>
        <motion.p
          className={styles.trustLabel}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          Trusted by fast-growing revenue teams worldwide
        </motion.p>
        <LogoTicker />
      </section>
      */}

      {/* ---- Section Divider ---- */}
      <div className={styles.sectionDividerWrap}>
        <SectionDivider />
      </div>

      {/* ---- Stats Bar with Count-Up ---- */}
      <Reveal as="section" className={styles.statsBar}>
        {STATS.map((s) => (
          <motion.div key={s.label} className={styles.statItem} variants={fadeUp}>
            <div className={styles.statValue}>
              <CountUpNumber
                value={s.value}
                suffix={s.suffix || ""}
                prefix={s.prefix || ""}
                duration={2}
              />
            </div>
            <div className={styles.statLabel}>{s.label}</div>
          </motion.div>
        ))}
      </Reveal>

      {/* ==========================================================================
         CRM MODULES — Feature Cards with Animated SVG Illustrations
         ========================================================================== */}
      <section id="modules" className={styles.features}>
        <Reveal className={styles.sectionHeader}>
          <motion.span className={styles.sectionEyebrow} variants={fadeUp}>
            Platform Capabilities
          </motion.span>
          <motion.h2 variants={fadeUp}>
            Built for Complete Sales Execution
          </motion.h2>
          <motion.p variants={fadeUp}>
            Explore the core modules engineered inside UniLead CRM — each one
            designed to accelerate your revenue pipeline.
          </motion.p>
        </Reveal>

        <Reveal className={styles.featuresGrid}>
          {PLATFORM_MODULES.map(
            ({ icon: Icon, tag, title, text, Scene }) => (
              <motion.div
                key={title}
                className={`${styles.featureCard} ${styles.featureCardBento}`}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
              >
                <span className={styles.featureTag}>{tag}</span>
                <span className={styles.featureIcon}>
                  <Icon width={22} height={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                {/* Animated SVG illustration */}
                <div className={styles.featureIllustration}>
                  <Scene />
                </div>
              </motion.div>
            )
          )}
        </Reveal>
      </section>

      {/* ---- Section Divider ---- */}
      <div className={styles.sectionDividerWrap}>
        <SectionDivider />
      </div>

      {/* ==========================================================================
         WORKFLOW SECTION
         ========================================================================== */}
      <section id="workflow" className={styles.workflow}>
        <Reveal className={styles.sectionHeader}>
          <motion.span className={styles.sectionEyebrow} variants={fadeUp}>
            How It Works
          </motion.span>
          <motion.h2 variants={fadeUp}>Go Live in 3 Simple Steps</motion.h2>
          <motion.p variants={fadeUp}>
            No implementation team required — most teams deploy the same day.
          </motion.p>
        </Reveal>

        <div className={styles.flowIllustrationWrap}>
          <PlatformFlowIllustration className={styles.flowIllustration} />
        </div>

        <Reveal className={styles.workflowGrid}>
          {WORKFLOW_STEPS.map((w) => (
            <motion.div
              key={w.step}
              className={styles.workflowCard}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
            >
              <div className={styles.workflowStep}>{w.step}</div>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </motion.div>
          ))}
        </Reveal>
      </section>

      {/* ==========================================================================
         MULTI-TENANT SECURITY BANNER
         ========================================================================== */}
      <Reveal as="section" className={styles.securityBand}>
        <motion.div className={styles.securityContent} variants={fadeUp}>
          <MdOutlineSecurity size={32} className={styles.securityIcon} />
          <div>
            <h3>Multi-Tenant Security & Audit Trails</h3>
            <p>
              Every organization operates on isolated data partitions with
              role-based policies, audit logging, and encrypted credentials.
            </p>
          </div>
        </motion.div>
        <motion.ul className={styles.securityList} variants={fadeUp}>
          <li>
            <MdCheckCircle size={17} /> Prisma tenant isolation
          </li>
          <li>
            <MdCheckCircle size={17} /> Role permissions & policies
          </li>
          <li>
            <MdCheckCircle size={17} /> Full activity audit history
          </li>
          <li>
            <MdCheckCircle size={17} /> Super Admin impersonation
          </li>
        </motion.ul>
      </Reveal>

      {/* ---- Section Divider ---- */}
      <div className={styles.sectionDividerWrap}>
        <SectionDivider />
      </div>

      {/* ==========================================================================
         TESTIMONIALS — Auto-Rotating Carousel
         ========================================================================== */}
      <section className={styles.testimonials}>
        <Reveal className={styles.sectionHeader}>
          <motion.span className={styles.sectionEyebrow} variants={fadeUp}>
            Customer Success
          </motion.span>
          <motion.h2 variants={fadeUp}>
            Loved by Growing Revenue Teams
          </motion.h2>
          <motion.p variants={fadeUp}>
            See what sales leaders say about switching to UniLead CRM.
          </motion.p>
        </Reveal>

        <TestimonialCarousel
          testimonials={TESTIMONIALS}
          cardClassName={styles.testimonialCarouselCard}
          quoteClassName={styles.testimonialQuote}
          authorClassName={styles.testimonialAuthor}
          avatarClassName={styles.testimonialAvatar}
        />
      </section>

      {/* ---- Section Divider ---- */}
      <div className={styles.sectionDividerWrap}>
        <SectionDivider />
      </div>

      {/* ==========================================================================
         PRICING (Dynamic from DB)
         ========================================================================== */}
      <section id="pricing" className={styles.pricing}>
        <Reveal className={styles.sectionHeader}>
          <motion.span className={styles.sectionEyebrow} variants={fadeUp}>
            Transparent Pricing
          </motion.span>
          <motion.h2 variants={fadeUp}>
            Choose Your Workspace Scale
          </motion.h2>
          <motion.p variants={fadeUp}>
            Select the plan that matches your pipeline's scale. Upgrade or
            downgrade at any time.
          </motion.p>
        </Reveal>

        <Reveal className={styles.pricingGrid}>
          {plans.map((p) => {
            const isFeatured = p.id === "pro"
            return (
              <motion.div
                key={p.id}
                className={`${styles.priceCard} ${
                  isFeatured ? styles.priceCardFeatured : ""
                }`}
                variants={fadeUp}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                {isFeatured && (
                  <span className={styles.featuredBadge}>Most Popular</span>
                )}
                <h3>{p.label}</h3>
                <div className={styles.priceValue}>{p.price}</div>
                <p className={styles.pricePeriod}>{p.blurb}</p>
                <ul className={styles.priceFeatures}>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={
                    isFeatured ? styles.priceCtaFeatured : styles.priceCta
                  }
                >
                  {p.id === "free"
                    ? "Start Free"
                    : p.id === "enterprise"
                    ? "Contact Sales"
                    : "Get Started Pro"}
                </Link>
              </motion.div>
            )
          })}
        </Reveal>
      </section>

      {/* ==========================================================================
         FAQ
         ========================================================================== */}
      <section id="faq" className={styles.faq}>
        <Reveal className={styles.sectionHeader}>
          <motion.span className={styles.sectionEyebrow} variants={fadeUp}>
            FAQ
          </motion.span>
          <motion.h2 variants={fadeUp}>Frequently Asked Questions</motion.h2>
        </Reveal>

        <Reveal className={styles.faqList}>
          {FAQS.map((item, i) => (
            <motion.div
              key={item.q}
              className={styles.faqItem}
              variants={fadeUp}
            >
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                aria-expanded={openFaq === i}
              >
                {item.q}
                <motion.span
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MdExpandMore size={20} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.p
                    className={styles.faqAnswer}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.a}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </Reveal>
      </section>

      {/* ==========================================================================
         FINAL CTA
         ========================================================================== */}
      <Reveal as="section" className={styles.finalCta}>
        <motion.div variants={fadeUp}>
          <MdOutlineBolt size={32} className={styles.finalCtaIcon} />
        </motion.div>
        <motion.h2 variants={fadeUp}>
          Ready to run your revenue on UniLead?
        </motion.h2>
        <motion.p variants={fadeUp}>
          Join high-velocity teams closing deals faster with a CRM built for
          speed, security, and scale.
        </motion.p>
        <motion.div variants={fadeUp} style={{ position: "relative" }}>
          <Sparkle
            size={16}
            color="#c084fc"
            style={{ top: "-1.5rem", right: "-1.5rem", position: "absolute" }}
            delay={0.5}
          />
          <Sparkle
            size={12}
            color="#f472b6"
            style={{ bottom: "-1rem", left: "-1.5rem", position: "absolute" }}
            delay={1.5}
          />
          <Link to="/signup" className={styles.heroCta}>
            Start Free Trial <MdOutlineArrowForward size={18} />
          </Link>
        </motion.div>
      </Reveal>

      {/* ==========================================================================
         FOOTER
         ========================================================================== */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link to="/" className={styles.brand}>
            <img
              className={`${styles.logoImg} ${styles.logoLight}`}
              src={logo}
              alt="UniLead"
            />
            <img
              className={`${styles.logoImg} ${styles.logoDark}`}
              src={logoWhite}
              alt="UniLead"
            />
          </Link>
          <div className={styles.footerLinks}>
            <a href="#features">Capabilities</a>
            <a href="#modules">Modules</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link to="/login">Sign In</Link>
          </div>
        </div>
        <p className={styles.footerCopy}>
          &copy; {new Date().getFullYear()} UniLead CRM. All rights reserved.
        </p>
      </footer>
      </div>
    </div>
  )
}
