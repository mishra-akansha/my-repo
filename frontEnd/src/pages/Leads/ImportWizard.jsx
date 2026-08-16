import { useState, useRef, useEffect } from "react"
import Modal from "../../components/UI/Modal.jsx"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { MdOutlineBolt, MdOutlineWarningAmber, MdCheckCircle, MdOutlineFileUpload, MdOutlineDescription, MdClose } from "react-icons/md"
import styles from "./ImportWizard.module.css"

const CRM_FIELDS = [
  { key: "name", label: "Name *", required: true },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "company", label: "Company", required: false },
  { key: "source", label: "Lead Source", required: false },
]

// Custom fields are mapped alongside the standard ones, keyed distinctly
// (custom:<fieldId>) so the mapping state never collides with a standard key.
function customFieldOptionKey(fieldId) {
  return `custom:${fieldId}`
}

const MOCK_CSV_DATA = `Name,Email,Phone,Company,Source
Alice Smith,alice.smith@hightech.com,9876543210,HighTech Inc.,Outbound Campaign
Bob Jones,bob.jones@quickcorp.org,555-0199,QuickCorp,Partner Referral
Charlie Brown,charlie@peanuts.net,123-456-7890,Peanuts,Web Signup
Dave Miller,dave.miller@invalid-email,999-999-9999,Miller Ltd.,Cold Outreach`

export default function ImportWizard({ open, onClose, onImportComplete }) {
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [csvText, setCsvText] = useState("")
  const [showPasteFallback, setShowPasteFallback] = useState(false)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mappings, setMappings] = useState({}) // { columnIndex: "name" | "custom:<fieldId>" }
  const [customFields, setCustomFieldDefs] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    api.get("/custom-fields")
      .then((fields) => setCustomFieldDefs((fields || []).filter((f) => f.entityType === "LEAD")))
      .catch(() => setCustomFieldDefs([]))
  }, [open])

  const mappableFields = [
    ...CRM_FIELDS,
    ...customFields.map((f) => ({ key: customFieldOptionKey(f.id), label: `${f.label} (Custom)`, required: false })),
  ]

  function parseSheetRows(aoa) {
    // Rows come out of both XLSX.read and the CSV fallback as arrays of cells,
    // already trimmed to strings — drop fully-empty rows either way produces.
    const clean = aoa
      .map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim())))
      .filter((row) => row.some(Boolean))
    if (clean.length < 2) {
      setError("File must contain a header row and at least one data row.")
      return
    }
    const fileHeaders = clean[0]
    const fileRows = clean.slice(1)

    setHeaders(fileHeaders)
    setRows(fileRows)

    const initialMappings = {}
    fileHeaders.forEach((header, index) => {
      const lower = header.toLowerCase().replace(/[^a-z]/g, "")
      const matchedField = CRM_FIELDS.find((f) => {
        const fieldLower = f.label.toLowerCase().replace(/[^a-z]/g, "")
        return lower.includes(fieldLower) || fieldLower.includes(lower)
      })
      if (matchedField) initialMappings[index] = matchedField.key
    })
    setMappings(initialMappings)
    setStep(2)
  }

  async function handleFile(file) {
    setError("")
    if (!file) return
    setFileName(file.name)
    try {
      // Lazy-loaded — xlsx is a large parser library, no reason to ship it in
      // the main Leads bundle when most page loads never open this dialog.
      const XLSX = await import("xlsx")
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: "array" })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
          parseSheetRows(aoa)
        } catch (err) {
          setError("Couldn't read that file — make sure it's a valid .csv or .xlsx.")
        }
      }
      reader.onerror = () => setError("Couldn't read that file.")
      reader.readAsArrayBuffer(file)
    } catch {
      setError("Couldn't load the file parser. Please refresh and try again.")
    }
  }

  // Proper quote-aware CSV line split — the previous regex-based version
  // (`[^",\s]+`) excluded whitespace from a matched cell, so any unquoted
  // multi-word value ("Alice Smith", "HighTech Inc.") silently lost every
  // word except the last one before the comma.
  function parseCsvLine(line) {
    const cells = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === "," && !inQuotes) {
        cells.push(cur.trim())
        cur = ""
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  function handleParsePastedText() {
    setError("")
    if (!csvText.trim()) {
      setError("Please paste some CSV data.")
      return
    }
    const lines = csvText.trim().split("\n").map(parseCsvLine)
    parseSheetRows(lines)
  }

  // Step 2: Mapping columns to CRM fields
  function handleConfirmMapping() {
    setError("")
    const mappedCrmKeys = Object.values(mappings)
    const missingRequired = CRM_FIELDS.filter((f) => f.required && !mappedCrmKeys.includes(f.key))
    if (missingRequired.length > 0) {
      setError(`Please map all required fields: ${missingRequired.map((f) => f.label).join(", ")}`)
      return
    }

    const mapped = rows.map((row, rIdx) => {
      const obj = { id: rIdx, customFields: {} }
      CRM_FIELDS.forEach((f) => {
        const headerIdx = Object.keys(mappings).find((k) => mappings[k] === f.key)
        obj[f.key] = headerIdx !== undefined ? row[Number(headerIdx)] || "" : ""
      })
      customFields.forEach((f) => {
        const optKey = customFieldOptionKey(f.id)
        const headerIdx = Object.keys(mappings).find((k) => mappings[k] === optKey)
        if (headerIdx !== undefined) {
          const value = row[Number(headerIdx)] || ""
          if (value) obj.customFields[f.id] = value
        }
      })

      obj.errors = []
      if (!obj.name) obj.errors.push("Missing name")
      if (obj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.email)) obj.errors.push("Invalid email format")
      return obj
    })

    setPreviewRows(mapped)
    setStep(3)
  }

  // Step 3: Run the import
  async function handleImport() {
    setError("")
    setSubmitting(true)
    const validLeads = previewRows.filter((r) => !r.errors.includes("Missing name"))
    if (validLeads.length === 0) {
      setError("No valid leads to import. Name is required.")
      setSubmitting(false)
      return
    }
    try {
      const res = await api.post("/leads/import-bulk", {
        leads: validLeads.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          company: r.company,
          source: r.source,
          customFields: r.customFields,
        })),
      })
      setImportResult(res)
      setStep(4)
    } catch (err) {
      setError(err.message || "Failed to perform bulk import.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setStep(1)
    setFileName("")
    setCsvText("")
    setShowPasteFallback(false)
    setHeaders([])
    setRows([])
    setMappings({})
    setPreviewRows([])
    setImportResult(null)
    setError("")
    onClose()
  }

  function handleComplete() {
    handleClose()
    onImportComplete()
  }

  function loadDemoData() {
    setShowPasteFallback(true)
    setCsvText(MOCK_CSV_DATA)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const customFieldMappedCount = Object.values(mappings).filter((v) => v.startsWith("custom:")).length

  return (
    <Modal open={open} onClose={handleClose} title="Import Leads" size="wide">
      <div className={`${modalStyles.body} ${styles.wizardBody}`}>
        <div className={styles.stepperRow}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${step === s ? styles.stepCircleCurrent : step > s ? styles.stepCircleDone : styles.stepCirclePending}`}>
                {s}
              </div>
              <span className={`${styles.stepLabel} ${step === s ? styles.stepLabelActive : ""}`}>
                {s === 1 ? "Upload" : s === 2 ? "Map" : s === 3 ? "Preview" : "Done"}
              </span>
              {s < 4 && <div className={styles.stepConnector} />}
            </div>
          ))}
        </div>

        {/* Step 1: File upload */}
        {step === 1 && (
          <div>
            <p className={styles.uHint}>
              Upload a .csv or .xlsx file. Make sure the first row contains headers (e.g. Name, Email, Company).
            </p>

            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {fileName ? (
                <div className={styles.dropzoneFile}>
                  <MdOutlineDescription size={22} />
                  <span>{fileName}</span>
                  <button
                    type="button"
                    className={styles.dropzoneClear}
                    onClick={(e) => { e.stopPropagation(); setFileName(""); setHeaders([]); setRows([]) }}
                  >
                    <MdClose size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <MdOutlineFileUpload size={28} />
                  <p><strong>Click to browse</strong> or drag a .csv / .xlsx file here</p>
                </>
              )}
            </div>

            <div className={styles.uploadFootRow}>
              <button type="button" onClick={loadDemoData} className={styles.sampleBtn}>
                <MdOutlineBolt size={14} /> Load sample leads
              </button>
              <button type="button" onClick={() => setShowPasteFallback((s) => !s)} className={styles.sampleBtn}>
                {showPasteFallback ? "Hide" : "Or paste raw CSV text"}
              </button>
            </div>

            {showPasteFallback && (
              <div className={styles.uMt2}>
                <textarea
                  className={styles.csvTextarea}
                  rows={7}
                  placeholder={`Name,Email,Phone,Company,Source\nJohn Doe,john@company.com,12345678,Doe Inc,Web Signup`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <div className={styles.uploadFootRow} style={{ marginTop: "0.5rem" }}>
                  <button type="button" className={modalStyles.submitBtn} onClick={handleParsePastedText}>Parse pasted text</button>
                </div>
              </div>
            )}

            {error && <p className={`${modalStyles.error} ${styles.uMt2}`}>{error}</p>}
            <div className={`${modalStyles.actions} ${styles.uMt6}`}>
              <button type="button" className={modalStyles.cancelBtn} onClick={handleClose}>Cancel</button>
            </div>
          </div>
        )}

        {/* Step 2: Columns Mapping */}
        {step === 2 && (
          <div>
            <p className={styles.uHint}>
              Map the columns of your file to CRM Lead fields — including your organization's custom fields. You must map the <strong>Name</strong> field.
            </p>
            <div className={styles.mapTableWrap}>
              <table className={styles.plainTable}>
                <thead>
                  <tr className={styles.uRowDivider}>
                    <th className={styles.uThSmall}>File Column</th>
                    <th className={styles.uThSmall}>Maps to CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, index) => (
                    <tr key={index} className={styles.mapRow}>
                      <td className={styles.mapCellHeader}>{header || `Column ${index + 1}`}</td>
                      <td className={styles.mapCellSelect}>
                        <SearchableSelect
                          options={mappableFields.map((f) => ({ id: f.key, name: f.label }))}
                          value={mappings[index] || ""}
                          onChange={(v) => setMappings({ ...mappings, [index]: v })}
                          labelKey="name"
                          valueKey="id"
                          placeholder="[Ignore this column]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customFields.length > 0 && (
              <p className={styles.customFieldsHint}>
                {customFieldMappedCount > 0
                  ? `${customFieldMappedCount} column${customFieldMappedCount === 1 ? "" : "s"} mapped to custom fields.`
                  : `Your org has ${customFields.length} custom lead field${customFields.length === 1 ? "" : "s"} — map a column above if this file has data for them.`}
              </p>
            )}
            {error && <p className={`${modalStyles.error} ${styles.uMt2}`}>{error}</p>}
            <div className={`${modalStyles.actions} ${styles.uMt6}`}>
              <button type="button" className={modalStyles.cancelBtn} onClick={() => setStep(1)}>Back</button>
              <button type="button" className={modalStyles.submitBtn} onClick={handleConfirmMapping}>Next: Preview Leads</button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div>
            <p className={styles.uHint}>
              Preview leads mapped from your file. Verify values and errors before final import.
            </p>
            <div className={styles.previewWrap}>
              <table className={styles.previewTable}>
                <colgroup>
                  <col style={{ width: "22%" }} /><col style={{ width: "22%" }} /><col style={{ width: "18%" }} /><col style={{ width: "20%" }} /><col style={{ width: "18%" }} />
                </colgroup>
                <thead className={styles.previewThead}>
                  <tr className={styles.uRowDivider}>
                    <th className={styles.uThLeft}>Name</th>
                    <th className={styles.uThLeft}>Email</th>
                    <th className={styles.uThLeft}>Company</th>
                    <th className={styles.uThLeft}>Custom fields</th>
                    <th className={styles.uThLeft}>Status</th>
                  </tr>
                </thead>
              </table>
              <div className={styles.previewBodyScroll}>
                <table className={styles.previewTable}>
                  <colgroup>
                    <col style={{ width: "22%" }} /><col style={{ width: "22%" }} /><col style={{ width: "18%" }} /><col style={{ width: "20%" }} /><col style={{ width: "18%" }} />
                  </colgroup>
                  <tbody>
                    {previewRows.map((pRow, index) => (
                      <tr key={index} className={styles.previewRow} style={{ background: pRow.errors.length > 0 ? "var(--error-bg)" : "transparent" }}>
                        <td className={styles.previewCellName}>
                          {pRow.name || <span className={styles.missingTag}>[Missing]</span>}
                        </td>
                        <td className={styles.uCellPad}>
                          {pRow.email || "—"}
                          {pRow.errors.includes("Invalid email format") && (
                            <div className={styles.emailErrorRow}>
                              <MdOutlineWarningAmber size={12} /> Invalid email format
                            </div>
                          )}
                        </td>
                        <td className={styles.uCellPad}>{pRow.company || "—"}</td>
                        <td className={styles.uCellPad}>
                          {Object.keys(pRow.customFields || {}).length > 0
                            ? `${Object.keys(pRow.customFields).length} field${Object.keys(pRow.customFields).length === 1 ? "" : "s"}`
                            : "—"}
                        </td>
                        <td className={styles.uCellPad}>
                          <span className={styles.statusChip}>{pRow.errors.length > 0 ? "Needs fix" : "Ready"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {error && <p className={`${modalStyles.error} ${styles.uMt2}`}>{error}</p>}
            <div className={`${modalStyles.actions} ${styles.uMt6}`}>
              <button type="button" className={modalStyles.cancelBtn} onClick={() => setStep(2)}>Back</button>
              <button type="button" className={modalStyles.submitBtn} onClick={handleImport} disabled={submitting}>
                {submitting ? "Importing..." : `Import ${previewRows.filter((r) => !r.errors.includes("Missing name")).length} Leads`}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Import Complete */}
        {step === 4 && importResult && (
          <div className={styles.completeWrap}>
            <div className={styles.completeIcon}>
              <MdCheckCircle size={28} />
            </div>
            <h3 className={styles.completeTitle}>Import Completed Successfully!</h3>
            <p className={styles.completeSubtitle}>
              We successfully processed your lead records and updated the pipeline.
            </p>

            <div className={styles.summaryBox}>
              <div className={styles.uRowBetween}>
                <span className={styles.uMuted}>Created Leads:</span>
                <span className={styles.summaryValueAccent}>+{importResult.createdCount}</span>
              </div>
              <div className={styles.uRowBetween}>
                <span className={styles.uMuted}>Skipped Duplicates:</span>
                <span className={styles.summaryValue}>{importResult.duplicateCount}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span className={styles.summaryTotalLabel}>Total Processed:</span>
                <span className={styles.summaryTotalValue}>{importResult.totalCount}</span>
              </div>
            </div>

            <button type="button" className={`${modalStyles.submitBtn} ${styles.doneBtn}`} onClick={handleComplete}>
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
