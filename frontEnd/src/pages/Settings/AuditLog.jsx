import { useState, useMemo } from "react"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import EmptyState from "../../components/UI/EmptyState.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate } from "../../lib/format.js"
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js"
import styles from "./Settings.module.css"
import auditStyles from "./AuditLog.module.css"

export default function AuditLog() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("org.settings.manage")

  const {
    data: logs,
    loading,
    hasMore,
    lastElementRef,
    totalCount
  } = useInfiniteScroll("/audit-log", 25, {})

  if (!canView) {
    return (
      <>
        <Topbar title="Audit Log" subtitle="Access restricted" />
        <div className={styles.page}>
          <div className={auditStyles.errorBox}>
            <h4 className={auditStyles.errorTitle}>Feature Unavailable</h4>
            <p className={auditStyles.errorText}>You don't have permission to view the audit log.</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Audit Log"
        subtitle={loading && logs.length === 0 ? "Loading..." : `${totalCount || logs.length} operations recorded`}
      />

      <div className={styles.page}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr
                  key={log.id}
                  ref={index === logs.length - 1 ? lastElementRef : null}
                >
                  <td className={styles.dateCell}>{formatDate(log.createdAt)}</td>
                  <td>
                    <div>
                      <strong>{log.actorIsSuperAdmin ? "Super Admin (Impersonation)" : log.actor?.name || "System"}</strong>
                      {log.actor?.email && <div className={auditStyles.actorEmail}>{log.actor.email}</div>}
                    </div>
                  </td>
                  <td>
                    <Badge tone={log.action.includes("deactivate") || log.action.includes("delete") || log.action.includes("suspend") ? "lost" : "won"}>
                      {log.action}
                    </Badge>
                  </td>
                  <td>
                    {log.targetType ? (
                      <span className={auditStyles.targetType}>
                        {log.targetType} ({log.targetId})
                      </span>
                    ) : "—"}
                  </td>
                  <td className={auditStyles.metadataCell} title={log.metadata}>
                    {log.metadata || "—"}
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5}><EmptyState type="activity" title="No audit log events found" compact /></td>
                </tr>
              )}
              {hasMore && (
                <tr>
                  <td colSpan={5} className={styles.loadingMoreCell} style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)" }}>
                    Loading more audit logs...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
