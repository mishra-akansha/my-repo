import styles from './Avatar.module.css'

export default function Avatar({ name, initials, color, size = 32 }) {
  const label = initials || name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, background: color || 'var(--primary)', fontSize: size * 0.38 }}
      title={name}
    >
      {label}
    </div>
  )
}
