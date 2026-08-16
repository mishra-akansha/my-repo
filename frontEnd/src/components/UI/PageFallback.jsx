import styles from "./PageFallback.module.css"

export default function PageFallback() {
  return (
    <div className={styles.wrap}>
      <span className={styles.spinner} />
    </div>
  )
}
