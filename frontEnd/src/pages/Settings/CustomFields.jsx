import { useEffect, useMemo, useState } from "react"
import Topbar from "../../components/Layout/Topbar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import DataGrid from "../../components/UI/DataGrid.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import SearchableSelect from "../../components/UI/SearchableSelect.jsx"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Settings.module.css"
import fieldStyles from "./CustomFields.module.css"

const MODULE_OPTIONS = [
  { value: "LEAD", label: "Leads" },
  { value: "DEAL", label: "Deals" },
  { value: "CONTACT", label: "Contacts" },
  { value: "ACCOUNT", label: "Accounts" },
  { value: "TASK", label: "Tasks" },
  { value: "INVOICE", label: "Invoices" },
  { value: "EVENT", label: "Events" },
]

const FIELD_TYPE_OPTIONS = [
  { value: "TEXT", label: "Text" },
  { value: "LONG_TEXT", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Currency" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Checkbox" },
  { value: "SELECT", label: "Single select" },
  { value: "MULTI_SELECT", label: "Multi select" },
  { value: "URL", label: "URL" },
  { value: "USER", label: "User" },
]

const OPTION_FIELD_TYPES = new Set(["SELECT", "MULTI_SELECT"])
const EMPTY_FIELD = { entityType: "LEAD", name: "", label: "", type: "TEXT", optionsRaw: "", required: false }

export default function CustomFields() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("teams.manage")

  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FIELD)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function reload() {
    setLoading(true)
    return api.get("/custom-fields")
      .then((data) => setFields(data))
      .catch((err) => console.error("Error loading custom fields", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FIELD)
    setError("")
    setModalOpen(true)
  }

  function openEdit(field) {
    let optionsList = []
    try {
      if (field.options) optionsList = JSON.parse(field.options)
    } catch (e) {}

    setEditingId(field.id)
    setForm({
      entityType: field.entityType,
      name: field.name,
      label: field.label,
      type: field.type,
      optionsRaw: optionsList.join(", "),
      required: field.required,
    })
    setError("")
    setModalOpen(true)
  }

  async function handleDelete(id) {
    if (!confirm("Delete this custom field? Existing values remain stored, but the field will stop appearing in forms.")) return
    try {
      await api.delete(`/custom-fields/${id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    const options = OPTION_FIELD_TYPES.has(form.type)
      ? form.optionsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined

    try {
      if (editingId) {
        await api.patch(`/custom-fields/${editingId}`, {
          label: form.label,
          required: form.required,
          options,
        })
      } else {
        await api.post("/custom-fields", {
          entityType: form.entityType,
          name: form.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          label: form.label,
          type: form.type,
          required: form.required,
          options,
        })
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      setError(err.message || "Failed to save custom field")
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: "entityType",
      header: "CRM Module",
      meta: { label: "CRM Module" },
      cell: ({ row }) => {
        const entityType = row.original.entityType
        return <Badge tone={entityType === "LEAD" ? "new" : entityType === "DEAL" ? "progress" : "neutral"}>{entityType}</Badge>
      },
    },
    {
      accessorKey: "name",
      header: "Field Name",
      meta: { label: "Field Name" },
      cell: ({ getValue }) => <span className={fieldStyles.monoCell}>{getValue()}</span>,
    },
    {
      accessorKey: "label",
      header: "Display Label",
      meta: { label: "Display Label" },
      cell: ({ getValue }) => <span className={fieldStyles.strongCell}>{getValue()}</span>,
    },
    {
      accessorKey: "type",
      header: "Data Type",
      meta: { label: "Data Type" },
      cell: ({ getValue }) => (
        <span className={fieldStyles.typeCell}>
          {String(getValue()).toLowerCase().replace("_", " ")}
        </span>
      ),
    },
    {
      accessorKey: "options",
      header: "Choices / Options",
      enableSorting: false,
      meta: { label: "Choices / Options" },
      cell: ({ getValue }) => {
        let parsedOptions = []
        try {
          if (getValue()) parsedOptions = JSON.parse(getValue())
        } catch (e) {}
        return parsedOptions.length > 0 ? (
          <div className={fieldStyles.optionList}>
            {parsedOptions.map((option, index) => (
              <span key={`${option}-${index}`} className={fieldStyles.optionPill}>
                {option}
              </span>
            ))}
          </div>
        ) : (
          <span className={fieldStyles.mutedCell}>-</span>
        )
      },
    },
    {
      accessorKey: "required",
      header: "Required",
      meta: { label: "Required" },
      cell: ({ getValue }) => getValue() ? <span className={fieldStyles.requiredText}>Yes</span> : "No",
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { label: "Actions" },
      cell: ({ row }) => canManage ? (
        <div className={fieldStyles.rowActions}>
          <button className={styles.rowActionBtn} onClick={() => openEdit(row.original)}>
            Edit
          </button>
          <button className={styles.rowActionBtnDanger} onClick={() => handleDelete(row.original.id)}>
            Delete
          </button>
        </div>
      ) : null,
    },
  ], [canManage])

  return (
    <>
      <Topbar title="Custom Fields Configurator" subtitle="Extend any CRM module with company-specific attributes" />

      <div className={fieldStyles.page}>
        <div className={fieldStyles.pageHeader}>
          <h3 className={fieldStyles.pageTitle}>Custom CRM Attributes</h3>
          {canManage && (
            <button className={styles.addBtn} onClick={openCreate}>
              + Add Custom Field
            </button>
          )}
        </div>

        {loading ? (
          <div className={fieldStyles.loadingBox}>
            <p className={fieldStyles.loadingText}>Loading configurator details...</p>
          </div>
        ) : (
          <DataGrid
            columns={columns}
            data={fields}
            globalFilterPlaceholder="Search fields, modules, and types..."
            emptyText="No custom fields added yet. Add custom urgency tags, segment fields, approval dates, or task priorities."
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit Field: ${form.name}` : "Add Custom Field"}>
        <form onSubmit={handleSubmit} className={`${modalStyles.body} ${fieldStyles.formReset}`}>
          {!editingId && (
            <>
              <div className={modalStyles.row}>
                <div className={modalStyles.field}>
                  <label>CRM Module</label>
                  <SearchableSelect
                    options={MODULE_OPTIONS}
                    value={form.entityType}
                    onChange={(value) => setForm({ ...form, entityType: value })}
                  />
                </div>
                <div className={modalStyles.field}>
                  <label>Data Type</label>
                  <SearchableSelect
                    options={FIELD_TYPE_OPTIONS}
                    value={form.type}
                    onChange={(value) => setForm({ ...form, type: value })}
                  />
                </div>
              </div>

              <div className={modalStyles.field}>
                <label>Field Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="e.g. lead_urgency or approval_date"
                />
              </div>
            </>
          )}

          <div className={modalStyles.field}>
            <label>Display Label</label>
            <input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. Lead Urgency" />
          </div>

          {OPTION_FIELD_TYPES.has(form.type) && (
            <div className={modalStyles.field}>
              <label>Choices</label>
              <input
                required
                value={form.optionsRaw}
                onChange={(event) => setForm({ ...form, optionsRaw: event.target.value })}
                placeholder="e.g. High, Medium, Low"
              />
              <span className={fieldStyles.hint}>
                Separate options with commas.
              </span>
            </div>
          )}

          <div className={`${modalStyles.field} ${fieldStyles.checkboxField}`}>
            <input
              type="checkbox"
              id="field-required"
              checked={form.required}
              onChange={(event) => setForm({ ...form, required: event.target.checked })}
              className={fieldStyles.checkboxInput}
            />
            <label htmlFor="field-required" className={fieldStyles.checkboxLabel}>This field is required on forms</label>
          </div>

          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={modalStyles.submitBtn} disabled={submitting}>
              {submitting ? "Saving..." : "Save Custom Field"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
