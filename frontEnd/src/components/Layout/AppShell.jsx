import Sidebar from './Sidebar.jsx'
import CommandPalette from '../UI/CommandPalette.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import styles from './AppShell.module.css'

export default function AppShell({ children }) {
  const { impersonating, exitImpersonation, user } = useAuth()

  return (
    <div className={styles.shell}>
      <div className="u-mesh-bg" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Sidebar />
      <main className={styles.content}>
        {impersonating && (
          <div className={styles.impersonationBanner}>
            <span>Viewing as Super Admin — inside <strong>{user?.organization?.name}</strong>'s workspace</span>
            <button onClick={exitImpersonation}>Exit impersonation</button>
          </div>
        )}
        {children}
      </main>
      <CommandPalette />
    </div>
  )
}