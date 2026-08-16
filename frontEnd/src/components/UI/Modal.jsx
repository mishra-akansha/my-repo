import { motion, AnimatePresence } from "framer-motion"
import styles from "./Modal.module.css"

export default function Modal({ open, onClose, title, children, size = "default" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={size === "wide" ? `${styles.panel} ${styles.panelWide}` : styles.panel}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h3>{title}</h3>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                &times;
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}