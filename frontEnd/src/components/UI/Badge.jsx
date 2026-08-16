import styles from './Badge.module.css'

// tone: 'new' | 'progress' | 'won' | 'lost' | 'neutral'
export default function Badge({ children, tone = 'neutral', title, className }) {
  return <span className={`${styles.badge} ${styles[tone]} ${className || ''}`} title={title}>{children}</span>
}
