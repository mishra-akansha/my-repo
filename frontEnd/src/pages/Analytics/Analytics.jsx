import { useState, useEffect } from "react"
import Topbar from "../../components/Layout/Topbar.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import { TableSkeleton } from "../../components/UI/Skeleton.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Analytics.module.css"

function formatCurrency(v) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v)
}

function monthLabel(key) {
  const [y, m] = key.split("-")
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

export default function Analytics() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("reports.view.org")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(canView ? "" : "You don't have permission to view analytics.")

  useEffect(() => {
    if (!canView) { setLoading(false); return }
    api.get("/analytics/overview")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [canView])

  const maxWinRateValue = data ? Math.max(1, ...data.winRateTrend.map((m) => m.wonValue)) : 1

  return (
    <>
      <Topbar title="Analytics" subtitle="Pipeline velocity, win-rate trends, lead-source ROI, and team performance" />
      <div className={styles.page}>
        {error ? (
          <p className={styles.errorState}>{error}</p>
        ) : loading || !data ? (
          <TableSkeleton rows={6} />
        ) : (
          <>
            <div className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Avg. days to close (WON)</span>
                <span className={styles.metricValue}>{data.avgDaysToClose}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Deals won (last 6 months)</span>
                <span className={styles.metricValue}>{data.winRateTrend.reduce((s, m) => s + m.won, 0)}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Won pipeline value (6mo)</span>
                <span className={styles.metricValue}>{formatCurrency(data.winRateTrend.reduce((s, m) => s + m.wonValue, 0))}</span>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Win-rate trend</h3>
              {data.winRateTrend.length === 0 ? (
                <p className={styles.emptyState}>No closed deals in the last 6 months yet.</p>
              ) : (
                <div className={styles.trendChart}>
                  {data.winRateTrend.map((m) => (
                    <div key={m.month} className={styles.trendCol}>
                      <div className={styles.trendBarTrack}>
                        <div
                          className={styles.trendBarFill}
                          style={{ height: `${Math.round((m.wonValue / maxWinRateValue) * 100)}%` }}
                        />
                      </div>
                      <span className={styles.trendWinRate}>{m.winRate}%</span>
                      <span className={styles.trendMonth}>{monthLabel(m.month)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.twoCol}>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Lead source ROI</h3>
                {data.leadSourceROI.length === 0 ? (
                  <p className={styles.emptyState}>No leads yet.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Source</th><th>Total</th><th>Converted</th><th>Rate</th></tr>
                      </thead>
                      <tbody>
                        {data.leadSourceROI.map((s) => (
                          <tr key={s.source}>
                            <td className={styles.tdStrong}>{s.source}</td>
                            <td>{s.total}</td>
                            <td>{s.converted}</td>
                            <td>{s.conversionRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Team leaderboard</h3>
                {data.teamLeaderboard.length === 0 ? (
                  <p className={styles.emptyState}>No won deals yet.</p>
                ) : (
                  <div className={styles.leaderboardList}>
                    {data.teamLeaderboard.map((entry, i) => (
                      <div key={entry.owner?.id || i} className={styles.leaderboardRow}>
                        <span className={styles.leaderboardRank}>{i + 1}</span>
                        <Avatar name={entry.owner?.name} color={entry.owner?.color} size={26} />
                        <span className={styles.leaderboardName}>{entry.owner?.name || "Unknown"}</span>
                        <span className={styles.leaderboardStat}>{entry.count} won</span>
                        <span className={styles.leaderboardValue}>{formatCurrency(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Task workload by team member</h3>
              {(!data.taskWorkload || data.taskWorkload.length === 0) ? (
                <p className={styles.emptyState}>No tasks assigned yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Owner</th><th>Total</th><th>In progress</th><th>Overdue</th><th>Done</th><th>Completion</th></tr>
                    </thead>
                    <tbody>
                      {data.taskWorkload.map((w) => (
                        <tr key={w.owner?.id}>
                          <td className={styles.tdStrong}>
                            <span className={styles.workloadOwner}>
                              <Avatar name={w.owner?.name} color={w.owner?.color} size={20} />
                              {w.owner?.name || "Unknown"}
                            </span>
                          </td>
                          <td>{w.total}</td>
                          <td>{w.inProgress}</td>
                          <td className={w.overdue > 0 ? styles.workloadOverdue : undefined}>{w.overdue}</td>
                          <td>{w.done}</td>
                          <td>{w.completionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
