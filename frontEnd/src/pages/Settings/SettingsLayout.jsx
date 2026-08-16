import { Outlet, NavLink, useLocation, Navigate, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { MdChevronRight, MdArrowBack } from "react-icons/md"
import { useAuth } from "../../context/AuthContext.jsx"
import { SETTINGS_TABS } from "../../lib/navigation.js"
import styles from "./SettingsLayout.module.css"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function SettingsLayout() {
  const { hasPermission, hasModule, impersonating } = useAuth()
  const location = useLocation()
  const isMobile = useIsMobile()

  const visibleTabs = SETTINGS_TABS.filter(t => (!t.permission || hasPermission(t.permission)) && (!t.module || hasModule(t.module)))
  const isExactSettings = location.pathname === "/settings" || location.pathname === "/settings/"

  // On desktop, if on /settings, redirect to customization
  if (!isMobile && isExactSettings) {
    return <Navigate to="/settings/customization" replace />
  }

  // On mobile, if on exactly /settings, render the launcher menu grid
  if (isMobile && isExactSettings) {
    return (
      <div className={styles.mobileIndex}>
        <div className={styles.mobileHeader}>
          <h2>Settings</h2>
          <p>Control Center & Preferences</p>
        </div>
        <div className={styles.grid}>
          {visibleTabs.map(t => (
            <Link key={t.to} to={t.to} className={styles.gridCard}>
              <span className={styles.cardIcon}><t.icon size={20} /></span>
              <div className={styles.cardInfo}>
                <strong>{t.label}</strong>
                <p>{t.desc}</p>
              </div>
              <span className={styles.cardArrow}><MdChevronRight size={20} /></span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${impersonating ? styles.impersonating : ""}`}>
      {/* Secondary Settings Sidebar (Visible on Desktop) */}
      {!isMobile && (
        <aside className={styles.subSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Control Center</h3>
            <p>Workspace Preferences</p>
          </div>
          <nav className={styles.nav}>
            {visibleTabs.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <span className={styles.navIcon}><t.icon size={17} /></span>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      {/* Main Settings View Area */}
      <div className={styles.contentArea}>
        {/* On mobile, show a nice back button header when inside a subpage */}
        {isMobile && !isExactSettings && (
          <div className={styles.mobileBackHeader}>
            <Link to="/settings" className={styles.backLink}>
              <MdArrowBack size={15} /> Back to Settings
            </Link>
          </div>
        )}
        <div className={styles.childContent}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
