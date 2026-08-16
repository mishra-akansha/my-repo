import styles from "./Skeleton.module.css"

export function Skeleton({ variant = "text", width, height, className = "" }) {
  const customStyle = {
    width: width || (variant === "text" ? "100%" : undefined),
    height: height || (variant === "text" ? "1em" : undefined),
  }

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className}`}
      style={customStyle}
    />
  )
}

export function LeadsSkeleton() {
  return (
    <div className={styles.colStack}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className={styles.rowCenter}>
          <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
          <div className={styles.rowFlex1}>
            <Skeleton variant="text" width="40%" height="1.25rem" />
            <Skeleton variant="text" width="25%" height="0.875rem" />
          </div>
          <Skeleton variant="rounded" width="5rem" height="1.5rem" />
          <Skeleton variant="rounded" width="6rem" height="1.5rem" />
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton() {
  return (
    <div className={styles.cardGrid}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
            <Skeleton variant="rounded" width="3rem" height="1rem" />
          </div>
          <Skeleton variant="text" width="70%" height="1.25rem" />
          <Skeleton variant="text" width="90%" height="0.875rem" />
          <div className={styles.cardFooterRow}>
            <Skeleton variant="text" width="30%" height="0.75rem" />
            <Skeleton variant="text" width="20%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className={styles.colStack}>
      <div className={styles.statGrid}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.statCard}>
            <Skeleton variant="text" width="40%" height="0.875rem" />
            <Skeleton variant="text" width="60%" height="1.75rem" />
            <Skeleton variant="text" width="30%" height="0.75rem" />
          </div>
        ))}
      </div>
      <div className={styles.panelGrid}>
        {[...Array(2)].map((_, i) => (
          <div key={i} className={styles.panel}>
            <Skeleton variant="text" width="30%" height="1.25rem" />
            <div className={styles.panelBody}>
              <Skeleton variant="text" width="90%" height="1.5rem" />
              <Skeleton variant="text" width="85%" height="1.5rem" />
              <Skeleton variant="text" width="80%" height="1.5rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TasksSkeleton() {
  return (
    <div className={styles.colStackTight}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className={styles.rowCenterCard}>
          <Skeleton variant="rounded" width="1.25rem" height="1.25rem" />
          <Skeleton variant="circular" width="1.5rem" height="1.5rem" />
          <div className={styles.rowFlex1Tight}>
            <Skeleton variant="text" width="50%" height="1rem" />
            <Skeleton variant="text" width="30%" height="0.75rem" />
          </div>
          <Skeleton variant="text" width="4rem" height="0.875rem" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className={styles.colStack}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className={styles.rowCenter}>
          <Skeleton variant="rounded" width="2.5rem" height="2rem" />
          <div className={styles.rowFlex1}>
            <Skeleton variant="text" width="45%" height="1rem" />
            <Skeleton variant="text" width="25%" height="0.8125rem" />
          </div>
          <Skeleton variant="rounded" width="4.5rem" height="1.375rem" />
        </div>
      ))}
    </div>
  )
}

export function PipelineSkeleton() {
  return (
    <div className={styles.pipelineRow}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className={styles.pipelineCol}>
          <div className={styles.cardHeaderRow}>
            <Skeleton variant="text" width="50%" height="1.125rem" />
            <Skeleton variant="rounded" width="1.5rem" height="1.125rem" />
          </div>
          <Skeleton variant="text" width="30%" height="0.75rem" className={styles.marginBottomSm} />
          {[...Array(2)].map((_, j) => (
            <div key={j} className={styles.pipelineCard}>
              <Skeleton variant="text" width="80%" height="1rem" />
              <Skeleton variant="text" width="60%" height="0.75rem" />
              <div className={styles.pipelineCardFooter}>
                <Skeleton variant="circular" width="1.25rem" height="1.25rem" />
                <Skeleton variant="text" width="25%" height="0.75rem" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
