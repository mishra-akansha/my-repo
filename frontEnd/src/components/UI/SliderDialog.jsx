import { motion, AnimatePresence } from "framer-motion"
import { MdClose } from "react-icons/md"
import styles from "./SliderDialog.module.css"

export default function SliderDialog({ open, onClose, title, subtitle, children, footer, width, headerActions }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.panel}
            style={width ? { width } : undefined}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={title}
          >
            <div className={styles.header}>
              <div className={styles.headerText}>
                <h3 title={title}>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <div className={styles.headerActions}>
                {headerActions}
                <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
                  <MdClose size={18} />
                </button>
              </div>
            </div>
            <div className={styles.body}>{children}</div>
            {footer && <div className={styles.footer}>{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
