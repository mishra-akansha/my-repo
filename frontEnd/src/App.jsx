import { lazy, Suspense } from "react"
import { Routes, Route, useLocation, Navigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import AppShell from "./components/Layout/AppShell.jsx"
import PageFallback from "./components/UI/PageFallback.jsx"
import { useAuth } from "./context/AuthContext.jsx"
import { MODULE_ROUTE_GATES } from "./lib/navigation.js"
import styles from "./App.module.css"

const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard.jsx"))
const Leads = lazy(() => import("./pages/Leads/Leads.jsx"))
const Contacts = lazy(() => import("./pages/Contacts/Contacts.jsx"))
const Accounts = lazy(() => import("./pages/Accounts/Accounts.jsx"))
const Team = lazy(() => import("./pages/Settings/Team.jsx"))
const Teams = lazy(() => import("./pages/Settings/Teams.jsx"))
const ClientTypes = lazy(() => import("./pages/Settings/ClientTypes.jsx"))
const Products = lazy(() => import("./pages/Settings/Products.jsx"))
const SettingsEvents = lazy(() => import("./pages/Settings/Events.jsx"))
const CustomFields = lazy(() => import("./pages/Settings/CustomFields.jsx"))
const CustomizationStudio = lazy(() => import("./pages/Settings/CustomizationStudio.jsx"))
const CompanyProfile = lazy(() => import("./pages/Settings/CompanyProfile.jsx"))
const OnboardingEmail = lazy(() => import("./pages/Settings/OnboardingEmail.jsx"))
const MyAccount = lazy(() => import("./pages/Settings/MyAccount.jsx"))
const DocumentTemplates = lazy(() => import("./pages/Settings/DocumentTemplates.jsx"))
const SettingsLayout = lazy(() => import("./pages/Settings/SettingsLayout.jsx"))
const Roles = lazy(() => import("./pages/Settings/Roles.jsx"))
const Plans = lazy(() => import("./pages/Settings/Plans.jsx"))
const AuditLog = lazy(() => import("./pages/Settings/AuditLog.jsx"))
const LeadScoring = lazy(() => import("./pages/Settings/LeadScoring.jsx"))
const Automations = lazy(() => import("./pages/Settings/Automations.jsx"))
const EmailTemplates = lazy(() => import("./pages/Settings/EmailTemplates.jsx"))
const TaskBoards = lazy(() => import("./pages/Settings/TaskBoards.jsx"))
const Events = lazy(() => import("./pages/Events/Events.jsx"))
const EventDetailProject = lazy(() => import("./pages/Events/EventDetailProject.jsx"))
const Platform = lazy(() => import("./pages/Platform/Platform.jsx"))
const Deals = lazy(() => import("./pages/Deals/Deals.jsx"))
const Tasks = lazy(() => import("./pages/Tasks/Tasks.jsx"))
const Login = lazy(() => import("./pages/Login/Login.jsx"))
const GoogleCallback = lazy(() => import("./pages/Login/GoogleCallback.jsx"))
const ForgotPassword = lazy(() => import("./pages/Login/ForgotPassword.jsx"))
const ResetPassword = lazy(() => import("./pages/Login/ResetPassword.jsx"))
const Signup = lazy(() => import("./pages/Signup/Signup.jsx"))
const Home = lazy(() => import("./pages/Home/Home.jsx"))
const Communications = lazy(() => import("./pages/Communications/Communications.jsx"))
const Reports = lazy(() => import("./pages/Reports/Reports.jsx"))
const Analytics = lazy(() => import("./pages/Analytics/Analytics.jsx"))
const Invoices = lazy(() => import("./pages/Invoices/Invoices.jsx"))

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

function AnimatedPage({ children }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={styles.pageTransition}
    >
      {children}
    </motion.div>
  )
}

function ProtectedShell() {
  const { user, loading, hasModule } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // Super Admin operates the platform, not any single org's CRM data — confine them to
  // /platform even if they type a CRM url directly. Impersonation tokens carry
  // isSuperAdmin:false, so an impersonated session is unaffected by this guard.
  if (user.isSuperAdmin && location.pathname !== "/platform") {
    return <Navigate to="/platform" replace />
  }

  // An org admin can turn Events/Invoices/Lead Scoring/Task Boards off in
  // Customization Studio — block direct navigation to those routes too, not just
  // hide the nav links, so a disabled module is actually disabled everywhere.
  const requiredModule = Object.entries(MODULE_ROUTE_GATES).find(([path]) => location.pathname.startsWith(path))?.[1]
  if (requiredModule && !hasModule(requiredModule)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AppShell>
      <Suspense fallback={<PageFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/dashboard" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
            <Route path="/communications" element={<AnimatedPage><Communications /></AnimatedPage>} />
            <Route path="/leads" element={<AnimatedPage><Leads /></AnimatedPage>} />
            <Route path="/contacts" element={<AnimatedPage><Contacts /></AnimatedPage>} />
            <Route path="/accounts" element={<AnimatedPage><Accounts /></AnimatedPage>} />
            <Route path="/reports" element={<AnimatedPage><Reports /></AnimatedPage>} />
          <Route path="/analytics" element={<AnimatedPage><Analytics /></AnimatedPage>} />
            <Route path="/invoices" element={<AnimatedPage><Invoices /></AnimatedPage>} />
            {/* Event Projects Workspace Routes */}
            <Route path="/events" element={<AnimatedPage><Events /></AnimatedPage>} />
            <Route path="/events/:id" element={<AnimatedPage><EventDetailProject /></AnimatedPage>} />

            {/* Consolidated Settings Control Center Layout */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={null} />
              <Route path="configuration" element={<Navigate to="/settings/customization" replace />} />
              <Route path="lead-scoring" element={<AnimatedPage><LeadScoring /></AnimatedPage>} />
              <Route path="automations" element={<AnimatedPage><Automations /></AnimatedPage>} />
              <Route path="email-templates" element={<AnimatedPage><EmailTemplates /></AnimatedPage>} />
              <Route path="task-boards" element={<AnimatedPage><TaskBoards /></AnimatedPage>} />
              <Route path="customization" element={<AnimatedPage><CustomizationStudio /></AnimatedPage>} />
              <Route path="company-profile" element={<AnimatedPage><CompanyProfile /></AnimatedPage>} />
              <Route path="onboarding-email" element={<AnimatedPage><OnboardingEmail /></AnimatedPage>} />
              <Route path="my-account" element={<AnimatedPage><MyAccount /></AnimatedPage>} />
              <Route path="document-templates" element={<AnimatedPage><DocumentTemplates /></AnimatedPage>} />
              <Route path="custom-fields" element={<AnimatedPage><CustomFields /></AnimatedPage>} />
              <Route path="client-types" element={<AnimatedPage><ClientTypes /></AnimatedPage>} />
              <Route path="products" element={<AnimatedPage><Products /></AnimatedPage>} />
              <Route path="events" element={<AnimatedPage><SettingsEvents /></AnimatedPage>} />
              <Route path="teams" element={<AnimatedPage><Teams /></AnimatedPage>} />
              <Route path="team" element={<AnimatedPage><Team /></AnimatedPage>} />
              <Route path="roles" element={<Navigate to="/settings/team" replace />} />
              <Route path="plans" element={<AnimatedPage><Plans /></AnimatedPage>} />
              <Route path="audit-log" element={<AnimatedPage><AuditLog /></AnimatedPage>} />
            </Route>

            <Route path="/platform" element={<AnimatedPage><Platform /></AnimatedPage>} />
            <Route path="/deals" element={<AnimatedPage><Deals /></AnimatedPage>} />
            <Route path="/tasks" element={<AnimatedPage><Tasks /></AnimatedPage>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/"
          element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <Home />}
        />
        <Route
          path="/login"
          element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <Signup />}
        />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route
          path="/forgot-password"
          element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <ResetPassword />}
        />
        <Route path="/*" element={<ProtectedShell />} />
      </Routes>
    </Suspense>
  )
}
