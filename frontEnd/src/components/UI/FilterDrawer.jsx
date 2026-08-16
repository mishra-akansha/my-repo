import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HiOutlineAdjustmentsHorizontal } from "react-icons/hi2"
import { MdClose } from "react-icons/md"
import styles from "./FilterDrawer.module.css"

export function FilterButton({ onClick, activeCount = 0, label = "Filters", open = false }) {
  if (open) return null
  const [top, setTop] = useState(16)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const offsetY = useRef(0)

  useEffect(() => {
    function handleMove(e) {
      if (!dragging.current) return
      moved.current = true
      const container = wrapRef.current?.offsetParent
      const btnH = btnRef.current?.offsetHeight || 0
      const containerTop = container ? container.getBoundingClientRect().top : 0
      const containerH = container ? container.clientHeight : window.innerHeight
      let next = e.clientY - containerTop - offsetY.current
      const maxTop = Math.max(0, containerH - btnH)
      if (next < 0) next = 0
      if (next > maxTop) next = maxTop
      setTop(next)
    }
    function handleUp() {
      dragging.current = false
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [])

  function handlePointerDown(e) {
    dragging.current = true
    moved.current = false
    offsetY.current = e.clientY - (btnRef.current?.getBoundingClientRect().top ?? 0)
  }

  function handleClick() {
    if (moved.current) return
    onClick()
  }

  return (
    <div ref={wrapRef} className={styles.wrapper} style={{ top: `${top}px` }}>
      <button
        ref={btnRef}
        type="button"
        className={styles.draggableButton}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        title={label}
      >
        <HiOutlineAdjustmentsHorizontal size={19} />
        <span className={styles.expandableContent}>{label}</span>
        {activeCount > 0 && (
          <span className={styles.badge} title={`${activeCount} filter${activeCount > 1 ? "s" : ""} applied`}>
            {activeCount}
          </span>
        )}
      </button>
    </div>
  )
}

// A flex sibling of whatever content it's rendered next to (table, board,
// card grid) — not an overlay. Caller is responsible for wrapping its main
// content + this component in a flex row (see Leads/Invoices/Tasks .bodyRow).
export default function FilterDrawer({ open, onClose, title = "Filters", children, onClear, activeCount = 0 }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.panel}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "20rem", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label={title}
        >
          <div className={styles.header}>
            <h3>{title}</h3>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <MdClose size={18} />
            </button>
          </div>
          <div className={styles.body}>{children}</div>
          {onClear && (
            <div className={styles.footer}>
              <button type="button" className={styles.clearBtn} onClick={onClear} disabled={!activeCount}>
                Clear all{activeCount > 0 ? ` (${activeCount})` : ""}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
