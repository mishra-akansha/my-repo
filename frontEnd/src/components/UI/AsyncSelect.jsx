import { useState, useEffect, useRef } from "react"
import { MdKeyboardArrowDown } from "react-icons/md"
import useDebounce from "../../hooks/useDebounce.js"
import styles from "./SearchableSelect.module.css"

export default function AsyncSelect({
  fetchOptions,
  value = "",
  selectedLabel = "",
  onChange,
  placeholder = "Search...",
  disabled = false,
  minChars = 2,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const requestId = useRef(0)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (debouncedSearch.length < minChars) {
      setOptions([])
      return
    }
    const id = ++requestId.current
    setLoading(true)
    fetchOptions(debouncedSearch)
      .then((results) => {
        if (id === requestId.current) setOptions(results || [])
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [debouncedSearch, isOpen, minChars, fetchOptions])

  function handleSelect(opt) {
    onChange(opt)
    setIsOpen(false)
    setSearch("")
  }

  function handleToggle() {
    if (disabled) return
    setIsOpen((o) => !o)
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
        <span className={value ? styles.valueText : styles.placeholderText}>
          {value ? selectedLabel : placeholder}
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
              placeholder={minChars > 0 ? `Type ${minChars}+ characters...` : "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className={styles.optionsList}>
            {loading ? (
              <div className={styles.noOptions}>Searching…</div>
            ) : debouncedSearch.length < minChars ? (
              <div className={styles.noOptions}>Type {minChars}+ characters to search</div>
            ) : options.length === 0 ? (
              <div className={styles.noOptions}>No matches found</div>
            ) : (
              options.map((opt) => {
                const isSelected = String(opt.value) === String(value)
                return (
                  <div
                    key={opt.value}
                    className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                    onClick={() => handleSelect(opt)}
                  >
                    {opt.label}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
