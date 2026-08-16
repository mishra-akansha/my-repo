import { motion } from "framer-motion"
import styles from "./Switch.module.css"

// Checkbox with the app's own look instead of the raw browser control —
// there's no MUI (or any toggle component) in this project, so this follows
// the existing design tokens (--primary, --border-strong, --bg-surface)
// instead of pulling in a whole UI library for one control.
export default function Switch({ checked, onChange, disabled, label, id }) {
  return (
    <label className={`${styles.wrap} ${disabled ? styles.disabled : ""}`} htmlFor={id}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        className={`${styles.track} ${checked ? styles.trackOn : ""}`}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
      >
        <motion.span
          className={styles.thumb}
          animate={{ x: checked ? "1.125rem" : "0.125rem" }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </button>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}
