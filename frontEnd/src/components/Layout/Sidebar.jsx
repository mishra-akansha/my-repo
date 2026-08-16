import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MdMenu } from 'react-icons/md'
import { useAuth } from '../../context/AuthContext.jsx'
import { publicUrl, api } from '../../api/client.js'
import { SIDEBAR_NAV_ITEMS, SUPER_ADMIN_NAV_ITEMS } from '../../lib/navigation.js'
import styles from './Sidebar.module.css'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function Sidebar() {
  const location = useLocation()
  const { hasPermission, hasModule, user } = useAuth()
  const isMobile = useIsMobile()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const res = await api.get("/email-messages/unread-count").catch(() => null)
      if (!cancelled && res) setUnreadCount(res.count || 0)
    }
    poll()
    const interval = setInterval(poll, 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const visibleItems = user?.isSuperAdmin
    ? SUPER_ADMIN_NAV_ITEMS
    : SIDEBAR_NAV_ITEMS.filter((item) => {
        if (item.superAdminOnly) return false
        if (item.permission && !hasPermission(item.permission)) return false
        if (item.module && !hasModule(item.module)) return false
        return true
      })

  // Close "More" popup when navigating
  useEffect(() => {
    setShowMoreMenu(false)
  }, [location.pathname])

  const primaryMobilePaths = ["/dashboard", "/leads", "/deals", "/tasks"]
  const mobilePrimaryItems = visibleItems.filter(item => primaryMobilePaths.includes(item.to))
  const mobileMoreItems = visibleItems.filter(item => !primaryMobilePaths.includes(item.to))

  const isMoreActive = mobileMoreItems.some(item => 
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )

  const showMobileBottomNav = isMobile && !user?.isSuperAdmin

  return (
    <aside className={styles.sidebar}>
      {!showMobileBottomNav && (
        <motion.div
          className={styles.brand}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {user?.organization?.hasLogo ? (
            <img
              className={styles.brandLogo}
              src={publicUrl(`/public/organizations/${user.organization.id}/logo`)}
              alt={user.organization.name}
            />
          ) : (
            <img className={styles.brandMark} src="/favicon.svg" alt="UniLead" />
          )}
          <span className={styles.brandName}>{user?.isSuperAdmin ? 'UniLead Ops' : (user?.organization?.name || 'UniLead')}</span>
        </motion.div>
      )}

      <nav className={styles.nav}>
        {!showMobileBottomNav ? (
          visibleItems.map(({ to, label, icon: Icon, end }, i) => {
            const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <motion.div
                key={to}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
              >
                <NavLink
                  to={to}
                  end={end}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-pill"
                      className={styles.activePill}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={styles.navIcon}><Icon /></span>
                  <span className={styles.navLabel}>{label}</span>
                  {to === '/communications' && unreadCount > 0 && (
                    <span className={styles.navBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </NavLink>
              </motion.div>
            )
          })
        ) : (
          <>
            {/* Primary mobile icons */}
            {mobilePrimaryItems.map(({ to, label, icon: Icon, end }) => {
              const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-pill"
                      className={styles.activePill}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={styles.navIcon}><Icon /></span>
                  <span className={styles.navLabel}>{label}</span>
                </NavLink>
              )
            })}
            
            {/* More Menu Icon */}
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`${styles.navItem} ${isMoreActive || showMoreMenu ? styles.active : ''}`}
            >
              {(isMoreActive || showMoreMenu) && (
                <span className={styles.activePill} />
              )}
              <span className={styles.navIcon}><MdMenu size={18} /></span>
              <span className={styles.navLabel}>More</span>
            </button>
          </>
        )}
      </nav>

      {/* More items drawer overlay */}
      <AnimatePresence>
        {showMobileBottomNav && showMoreMenu && (
          <>
            <div className={styles.moreMenuBackdrop} onClick={() => setShowMoreMenu(false)} />
            <motion.div
              className={styles.moreMenu}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {mobileMoreItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(to)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`${styles.moreMenuItem} ${isActive ? styles.active : ''}`}
                  >
                    <span className={styles.moreMenuIcon}><Icon /></span>
                    <span className={styles.moreMenuLabel}>{label}</span>
                    {to === '/communications' && unreadCount > 0 && (
                      <span className={styles.navBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </NavLink>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!isMobile && !user?.isSuperAdmin && user?.organization && (
        <div className={styles.footer}>
          <div className={styles.footerCard}>
            <div className={styles.footerTitle}>Workspace</div>
            <div className={styles.footerValue}>{user.organization.name}</div>
            <div className={styles.footerSub}>
              Active Plan: <span className={styles.footerPlan}>{user.organization.plan}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

