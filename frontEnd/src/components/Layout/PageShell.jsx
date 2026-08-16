import Topbar from "./Topbar.jsx"
import styles from "./PageShell.module.css"

export default function PageShell({ title, subtitle, action, loading, loadingFallback, error, errorFallback, children }) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} action={action} />
      {error ? (
        errorFallback || <p className={styles.errorText}>{error}</p>
      ) : loading ? (
        loadingFallback || null
      ) : (
        children
      )}
    </>
  )
}