import { useState, useEffect, useRef } from "react"
import { MdKeyboardArrowDown, MdClose } from "react-icons/md"
import styles from "./MultiSelect.module.css"

// Simple multi-select dropdown with checkbox options + removable chips below.
// `values` is an array of selected valueKey values; `onChange` receives the new array.
export default function MultiSelect({
  options = [],
  values = [],
  onChange,
  placeholder = "Select options...",
  labelKey = "label",
  valueKey = "value",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOptions = options.filter((opt) => values.some((v) => String(v) === String(opt[valueKey])))

  const filteredOptions = options.filter((opt) =>
    String(opt[labelKey]).toLowerCase().includes(search.toLowerCase())
  )

  function toggleOption(opt) {
    const optValue = opt[valueKey]
    const isSelected = values.some((v) => String(v) === String(optValue))
    if (isSelected) {
      onChange(values.filter((v) => String(v) !== String(optValue)))
    } else {
      onChange([...values, optValue])
    }
  }

  function removeChip(val) {
    onChange(values.filter((v) => String(v) !== String(val)))
  }

  function handleToggle() {
    if (disabled) return
    setIsOpen(!isOpen)
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ""} ${disabled ? styles.triggerDisabled : ""}`}
        onClick={handleToggle}
      >
        <span className={selectedOptions.length ? styles.valueText : styles.placeholderText}>
          {selectedOptions.length ? `${selectedOptions.length} selected` : placeholder}
        </span>
        <span className={styles.arrow}><MdKeyboardArrowDown size={16} /></span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchBox}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className={styles.optionsList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noOptions}>No matches found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.some((v) => String(v) === String(opt[valueKey]))
                return (
                  <div
                    key={opt[valueKey]}
                    className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                    onClick={() => toggleOption(opt)}
                  >
                    <input type="checkbox" readOnly checked={isSelected} className={styles.checkbox} />
                    <span>{opt[labelKey]}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {selectedOptions.length > 0 && (
        <div className={styles.chipsRow}>
          {selectedOptions.map((opt) => (
            <span key={opt[valueKey]} className={styles.chip}>
              {opt[labelKey]}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removeChip(opt[valueKey])}
                aria-label={`Remove ${opt[labelKey]}`}
              >
                <MdClose size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
