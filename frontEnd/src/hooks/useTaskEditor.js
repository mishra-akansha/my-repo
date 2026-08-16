import { useState } from "react"
import { api } from "../api/client.js"

const EMPTY_FORM = { title: "", dueDate: "", type: "TASK", related: "", ownerId: "", status: "", priority: "MEDIUM", description: "", milestoneId: "", labelIds: [], relatedType: "", leadId: "", dealId: "", accountId: "", contactId: "", customFields: {}, pendingFiles: [] }

// Shared task create/edit state + save logic behind TaskDetailModal, used by
// both the Tasks page and the Team page (assigning/reviewing a direct
// report's tasks) so the two open the identical detail experience instead of
// drifting into two different task forms over time.
export default function useTaskEditor({ currentUser, statuses, onSaved }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [relatedLabel, setRelatedLabel] = useState("")
  const [contactLabel, setContactLabel] = useState("")
  // false = opening the task itself (card/title click) — shows the full
  // detail view with Discussion/Attachments alongside Details, since those
  // are facets of the task, not extras of editing it. true = the explicit
  // "Edit" action — just the editable fields, nothing else.
  const [editOnly, setEditOnly] = useState(false)

  function openCreate(overrides = {}) {
    setEditingId(null)
    setEditOnly(false)
    setForm({ ...EMPTY_FORM, ownerId: currentUser.id, status: statuses[0]?.name || "", ...overrides })
    setRelatedLabel("")
    setContactLabel("")
    setError("")
    setModalOpen(true)
  }

  function openEdit(task, { editOnly: openAsEditOnly = false } = {}) {
    setEditingId(task.id)
    setEditOnly(openAsEditOnly)
    const relatedType = task.leadId ? "LEAD" : task.dealId ? "DEAL" : task.accountId ? "ACCOUNT" : ""
    setForm({
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      type: task.type,
      related: task.related || "",
      ownerId: task.ownerId || task.owner?.id || currentUser.id,
      status: task.status || statuses[0]?.name || "",
      priority: task.priority || "MEDIUM",
      description: task.description || "",
      milestoneId: task.milestoneId || "",
      labelIds: (task.labels || []).map((l) => l.labelId),
      relatedType,
      leadId: task.leadId || "",
      dealId: task.dealId || "",
      accountId: task.accountId || "",
      contactId: task.contactId || "",
      customFields: {},
      pendingFiles: [],
    })
    setRelatedLabel(task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : task.deal?.name || task.account?.name || "")
    setContactLabel(task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : "")
    setError("")
    setModalOpen(true)
    api.get(`/tasks/${task.id}`).then((full) => {
      setForm((prev) => ({ ...prev, customFields: full.customFields || {} }))
    }).catch((err) => console.error("Failed to load task custom fields", err))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        dueDate: form.dueDate,
        type: form.type,
        related: form.related,
        ownerId: form.ownerId || currentUser.id,
        status: form.status,
        priority: form.priority,
        description: form.description,
        milestoneId: form.milestoneId || null,
        labelIds: form.labelIds || [],
        leadId: form.relatedType === "LEAD" ? (form.leadId || null) : null,
        dealId: form.relatedType === "DEAL" ? (form.dealId || null) : null,
        accountId: form.relatedType === "ACCOUNT" ? (form.accountId || null) : null,
        contactId: form.contactId || null,
        customFields: form.customFields || {},
      }
      const saved = editingId ? await api.patch(`/tasks/${editingId}`, payload) : await api.post("/tasks", payload)

      // Upload any pending file attachments selected during task creation / edit
      if (form.pendingFiles && form.pendingFiles.length > 0) {
        for (const file of form.pendingFiles) {
          await api.upload(`/tasks/${saved.id}/attachments/upload`, file).catch(console.error)
        }
      }

      setModalOpen(false)
      await onSaved?.(saved, Boolean(editingId))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return {
    modalOpen, setModalOpen,
    editingId, form, setForm,
    error, submitting,
    relatedLabel, setRelatedLabel,
    contactLabel, setContactLabel,
    editOnly, setEditOnly,
    openCreate, openEdit, handleSubmit,
  }
}
