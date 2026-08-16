import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Topbar from "../../components/Layout/Topbar.jsx"
import Avatar from "../../components/UI/Avatar.jsx"
import Badge from "../../components/UI/Badge.jsx"
import Modal from "../../components/UI/Modal.jsx"
import modalStyles from "../../components/UI/Modal.module.css"
import { api } from "../../api/client.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { formatDate, initialsOf } from "../../lib/format.js"
import { getPlanLimits } from "../../lib/plans.js"

function labelize(s) {
  return s.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
import {
  MdOutlineGroup,
  MdOutlineApartment,
  MdOutlineShield,
  MdSearch,
  MdGridView,
  MdFormatListBulleted,
  MdOutlineAdd,
  MdOutlineEdit,
  MdOutlinePersonAdd,
  MdContentCopy,
  MdCheck,
  MdOutlineDelete,
  MdOutlineSupervisorAccount,
} from "react-icons/md"
import styles from "./TeamManagement.module.css"
import baseSettingsStyles from "./Settings.module.css"

const EMPTY_INVITE = { name: "", email: "", roleId: "", managerIds: [], teamId: "" }

export default function TeamManagement() {
  const { user, hasPermission } = useAuth()

  const [activeTab, setActiveTab] = useState("members") // "members" | "teams" | "roles"
  const [viewMode, setViewMode] = useState("grid") // "grid" | "table"

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [teamFilter, setTeamFilter] = useState("")

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [tempPasswordResult, setTempPasswordResult] = useState(null)
  const [copied, setCopied] = useState(false)

  // Quick Edit Member Modal State
  const [editMember, setEditMember] = useState(null)
  const [editRoleId, setEditRoleId] = useState("")
  const [editTeamId, setEditTeamId] = useState("")
  const [editManagerIds, setEditManagerIds] = useState([])
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Create / Edit Team Modal State
  const [editTeamModal, setEditTeamModal] = useState(null) // "new" or team object
  const [teamName, setTeamName] = useState("")
  const [teamManagerId, setTeamManagerId] = useState("")
  const [teamMemberIds, setTeamMemberIds] = useState([])
  const [teamSubmitting, setTeamSubmitting] = useState(false)
  const [teamError, setTeamError] = useState("")

  // Create / Edit Role Modal State
  const [catalogue, setCatalogue] = useState({ groups: {} })
  const [editRoleModal, setEditRoleModal] = useState(null) // "new" or role object
  const [roleName, setRoleName] = useState("")
  const [selectedPerms, setSelectedPerms] = useState(new Set())
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleError, setRoleError] = useState("")

  async function reload() {
    try {
      const [uList, rList, tList, cat] = await Promise.all([
        api.get("/users"),
        api.get("/roles"),
        api.get("/teams"),
        api.get("/roles/catalogue"),
      ])
      setUsers(uList)
      setRoles(rList)
      setTeams(tList)
      setCatalogue(cat)

      setInviteForm((f) => ({
        ...f,
        roleId: f.roleId || rList.find((x) => x.name === "Rep")?.id || rList[0]?.id || "",
      }))
    } catch (err) {
      console.error("Failed to load team management data", err)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  // Permissions & Limits
  const canManageUsers = hasPermission("users.manage")
  const canInviteUsers = hasPermission("users.invite")
  const canManageTeams = hasPermission("teams.manage")
  const canManageRoles = hasPermission("roles.manage")

  const limits = getPlanLimits(user?.organization?.plan)
  const activeUsersCount = users.filter((u) => u.active).length
  const atSeatCap = limits.maxUsers !== null && activeUsersCount >= limits.maxUsers
  const allowInvite = canInviteUsers && !atSeatCap

  // Filtered members list
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    const matchesSearch =
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchesRole = !roleFilter || u.role?.id === roleFilter
    const matchesTeam = !teamFilter || (teamFilter === "none" ? !u.team : u.team?.id === teamFilter)
    return matchesSearch && matchesRole && matchesTeam
  })

  // ---- Invite Handlers ----
  async function handleInvite(e) {
    e.preventDefault()
    setInviteError("")
    setInviteSubmitting(true)
    try {
      const res = await api.post("/users/invite", inviteForm)
      setTempPasswordResult(res)
      setInviteForm(EMPTY_INVITE)
      await reload()
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviteSubmitting(false)
    }
  }

  function copyTempPassword(pass) {
    navigator.clipboard.writeText(pass)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---- Member Quick Edit Handlers ----
  function openQuickEdit(u) {
    setEditMember(u)
    setEditRoleId(u.role?.id || "")
    setEditTeamId(u.team?.id || "")
    setEditManagerIds((u.managers || []).map((m) => m.id))
  }

  async function saveQuickEdit(e) {
    e.preventDefault()
    setEditSubmitting(true)
    try {
      await Promise.all([
        api.patch(`/users/${editMember.id}/role`, { roleId: editRoleId }),
        api.patch(`/users/${editMember.id}/team`, { teamId: editTeamId || null }),
        api.patch(`/users/${editMember.id}/managers`, { managerIds: editManagerIds }),
      ])
      setEditMember(null)
      await reload()
    } catch (err) {
      alert(`Error updating member: ${err.message}`)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function toggleActive(u) {
    if (u.id === user.id) return
    try {
      await api.patch(`/users/${u.id}/active`, { active: !u.active })
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  // ---- Team Editing Handlers ----
  function openNewTeam() {
    setEditTeamModal("new")
    setTeamName("")
    setTeamManagerId("")
    setTeamMemberIds([])
    setTeamError("")
  }

  function openEditTeam(t) {
    setEditTeamModal(t)
    setTeamName(t.name)
    setTeamManagerId(t.manager?.id || "")
    setTeamMemberIds((t.members || []).map((m) => m.id))
    setTeamError("")
  }

  async function saveTeam(e) {
    e.preventDefault()
    if (!teamName.trim()) return setTeamError("Team name is required")
    setTeamSubmitting(true)
    setTeamError("")
    try {
      const payload = {
        name: teamName,
        managerId: teamManagerId || null,
        memberIds: teamMemberIds,
      }
      if (editTeamModal === "new") {
        await api.post("/teams", payload)
      } else {
        await api.patch(`/teams/${editTeamModal.id}`, payload)
      }
      setEditTeamModal(null)
      await reload()
    } catch (err) {
      setTeamError(err.message)
    } finally {
      setTeamSubmitting(false)
    }
  }

  async function deleteTeam(t) {
    if (!confirm(`Are you sure you want to delete team "${t.name}"?`)) return
    try {
      await api.delete(`/teams/${t.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  // ---- Role Editing Handlers ----
  function openNewRole() {
    setEditRoleModal("new")
    setRoleName("")
    setSelectedPerms(new Set())
    setRoleError("")
  }

  function openEditRole(role) {
    setEditRoleModal(role)
    setRoleName(role.name)
    setSelectedPerms(new Set(role.permissions))
    setRoleError("")
  }

  function togglePerm(perm) {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  function toggleGroupAll(actions, resource) {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      const groupPerms = actions.map((a) => `${resource}.${a}`)
      const allChecked = groupPerms.every((p) => next.has(p))
      groupPerms.forEach((p) => (allChecked ? next.delete(p) : next.add(p)))
      return next
    })
  }

  async function saveRole(e) {
    e.preventDefault()
    if (!canManageRoles) return
    if (!roleName.trim()) return setRoleError("Role name is required")
    setRoleSubmitting(true)
    setRoleError("")
    try {
      const permissions = [...selectedPerms]
      if (editRoleModal === "new") {
        await api.post("/roles", { name: roleName, permissions })
      } else {
        await api.patch(`/roles/${editRoleModal.id}`, { name: roleName, permissions })
      }
      setEditRoleModal(null)
      await reload()
    } catch (err) {
      setRoleError(err.message)
    } finally {
      setRoleSubmitting(false)
    }
  }

  async function deleteRole(role) {
    if (!confirm(`Delete role "${role.name}"? Users assigned to it will need to be reassigned first.`)) return
    try {
      await api.delete(`/roles/${role.id}`)
      await reload()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <Topbar
        title="Team Management"
        subtitle={
          loading
            ? "Loading workspace team data…"
            : `${activeUsersCount}${limits.maxUsers !== null ? ` / ${limits.maxUsers}` : ""} active team member${activeUsersCount !== 1 ? "s" : ""} · ${teams.length} department${teams.length !== 1 ? "s" : ""}`
        }
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {activeTab === "roles" && canManageRoles && limits.customRoles && (
              <motion.button
                className={baseSettingsStyles.addBtn}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={openNewRole}
              >
                + New Role
              </motion.button>
            )}
            {allowInvite && (
              <motion.button
                className={baseSettingsStyles.addBtn}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setInviteOpen(true)
                  setInviteError("")
                  setTempPasswordResult(null)
                }}
              >
                + Invite Teammate
              </motion.button>
            )}
          </div>
        }
      />

      <div className={styles.page}>
        {/* Navigation Tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === "members" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("members")}
          >
            <MdOutlineGroup size={17} /> Members Directory
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "teams" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("teams")}
          >
            <MdOutlineApartment size={17} /> Departments & Teams
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "roles" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("roles")}
          >
            <MdOutlineShield size={17} /> Roles & Permissions
          </button>
        </div>

        {/* ===================== 1. MEMBERS DIRECTORY TAB ===================== */}
        {activeTab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.searchFilterGroup}>
                <div className={styles.searchInputWrap}>
                  <MdSearch size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by member name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>

                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">All Teams</option>
                  <option value="none">No Team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.viewModeToggle}>
                <button
                  className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.activeViewMode : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  <MdGridView size={16} />
                </button>
                <button
                  className={`${styles.viewModeBtn} ${viewMode === "table" ? styles.activeViewMode : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  <MdFormatListBulleted size={16} />
                </button>
              </div>
            </div>

            {/* Grid View */}
            {viewMode === "grid" ? (
              <div className={styles.membersGrid}>
                {filteredUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    className={styles.memberCard}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.memberInfo}>
                        <Avatar name={u.name} color={u.color} size={42} />
                        <div className={styles.memberMeta}>
                          <div className={styles.memberName}>{u.name}</div>
                          <div className={styles.memberEmail}>{u.email}</div>
                        </div>
                      </div>
                      <Badge tone={u.active ? "won" : "lost"}>
                        {u.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.pillRow}>
                        <Badge tone="primary">{u.role?.name || "Member"}</Badge>
                        {u.team ? (
                          <Badge tone="neutral">{u.team.name}</Badge>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No Team</span>
                        )}
                      </div>

                      {(u.managers || []).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span className={styles.infoLabel}>Reports To:</span>
                          <div className={styles.pillRow}>
                            {u.managers.map((m) => (
                              <span
                                key={m.id}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  color: "var(--text-primary)",
                                  background: "var(--bg-chip)",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "999px",
                                }}
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <span>Joined {formatDate(u.createdAt)}</span>
                      {canManageUsers && u.id !== user.id && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => openQuickEdit(u)}
                        >
                          <MdOutlineEdit size={14} /> Manage Member
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className={baseSettingsStyles.tableWrap}>
                <table className={baseSettingsStyles.table}>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Department / Team</th>
                      <th>Reports To</th>
                      <th>Status</th>
                      <th>Joined</th>
                      {canManageUsers && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className={baseSettingsStyles.memberCell}>
                            <Avatar name={u.name} color={u.color} size={30} />
                            <div>
                              <div className={baseSettingsStyles.memberName}>{u.name}</div>
                              <div className={baseSettingsStyles.memberEmail}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone="primary">{u.role?.name || "Member"}</Badge>
                        </td>
                        <td>
                          {u.team ? <Badge tone="neutral">{u.team.name}</Badge> : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                        <td>
                          {(u.managers || []).length > 0 ? (
                            u.managers.map((m) => (
                              <Badge key={m.id} tone="neutral" style={{ marginRight: "0.3rem" }}>{m.name}</Badge>
                            ))
                          ) : (
                            <span style={{ color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={u.active ? "won" : "lost"}>
                            {u.active ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          {formatDate(u.createdAt)}
                        </td>
                        {canManageUsers && (
                          <td>
                            {u.id !== user.id && (
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className={styles.actionBtn} onClick={() => openQuickEdit(u)}>
                                  <MdOutlineEdit size={14} /> Edit
                                </button>
                                <button
                                  className={styles.actionBtn}
                                  onClick={() => toggleActive(u)}
                                  style={{ color: u.active ? "var(--error)" : "var(--success)" }}
                                >
                                  {u.active ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================== 2. TEAMS & DEPARTMENTS TAB ===================== */}
        {activeTab === "teams" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            <div className={styles.toolbar}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Group reps and staff into sales teams, regional units, or business departments.
              </div>
              {canManageTeams && (
                <motion.button
                  className={baseSettingsStyles.addBtn}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={openNewTeam}
                >
                  + Add Department / Team
                </motion.button>
              )}
            </div>

            <div className={styles.teamsGrid}>
              {teams.map((t) => (
                <motion.div
                  key={t.id}
                  className={styles.teamCard}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className={styles.teamHeader}>
                    <div className={styles.teamTitle}>
                      <MdOutlineApartment size={20} style={{ color: "var(--primary)" }} />
                      {t.name}
                    </div>
                    {canManageTeams && (
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button className={styles.actionBtn} onClick={() => openEditTeam(t)}>
                          <MdOutlineEdit size={14} />
                        </button>
                        <button className={styles.actionBtn} onClick={() => deleteTeam(t)} style={{ color: "var(--error)" }}>
                          <MdOutlineDelete size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className={styles.infoLabel}>Department Manager:</span>
                    <div style={{ marginTop: "0.35rem" }}>
                      {t.manager ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Avatar name={t.manager.name} color={t.manager.color} size={24} />
                          <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{t.manager.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No manager assigned</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className={styles.infoLabel}>Team Members ({t.members?.length || 0}):</span>
                    <div className={styles.avatarStack} style={{ marginTop: "0.4rem" }}>
                      {(t.members || []).slice(0, 5).map((m) => (
                        <Avatar key={m.id} name={m.name} color={m.color} size={28} />
                      ))}
                      {(t.members || []).length > 5 && (
                        <div className={styles.moreCount}>+{(t.members || []).length - 5}</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== 3. ROLES & PERMISSIONS TAB ===================== */}
        {activeTab === "roles" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            <div className={styles.toolbar}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Security access roles configured for your organization.
              </div>
            </div>

            {!limits.customRoles && (
              <div className={styles.planNotice}>
                Custom roles aren't available on the {user?.organization?.plan} plan — you can still view the built-in roles below.
              </div>
            )}

            <div className={styles.rolesGrid}>
              {roles.map((r) => {
                const memberCount = users.filter((u) => u.role?.id === r.id).length
                const permCount = r.permissions?.length || 0
                return (
                  <motion.div
                    key={r.id}
                    className={styles.roleCard}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className={styles.roleCardHeader}>
                      <h4 className={styles.roleCardTitle}>{r.name}</h4>
                      {r.isBuiltIn ? (
                        <Badge tone="neutral">Built-in</Badge>
                      ) : (
                        <Badge tone="primary">Custom</Badge>
                      )}
                    </div>
                    <p className={styles.roleCardMeta}>
                      {permCount} permission{permCount !== 1 ? "s" : ""} · {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </p>
                    <div className={styles.roleCardActions}>
                      <button className={styles.actionBtn} onClick={() => openEditRole(r)}>
                        <MdOutlineEdit size={13} />
                        {canManageRoles ? (r.isBuiltIn ? "View / edit permissions" : "Edit") : "View permissions"}
                      </button>
                      {!r.isBuiltIn && canManageRoles && (
                        <button
                          className={styles.actionBtnDanger}
                          onClick={() => deleteRole(r)}
                        >
                          <MdOutlineDelete size={13} />
                          Delete
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===================== QUICK EDIT MEMBER MODAL ===================== */}
      {editMember && (
        <Modal
          open
          title={`Manage Teammate — ${editMember.name}`}
          onClose={() => setEditMember(null)}
        >
          <form onSubmit={saveQuickEdit} className={styles.modalForm}>
            <div className={styles.formField}>
              <label>Role</label>
              <select
                value={editRoleId}
                onChange={(e) => setEditRoleId(e.target.value)}
                className={styles.formSelect}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Department / Team</label>
              <select
                value={editTeamId}
                onChange={(e) => setEditTeamId(e.target.value)}
                className={styles.formSelect}
              >
                <option value="">No Team Assigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Reporting Managers</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "8rem", overflowY: "auto" }}>
                {users
                  .filter((u) => u.id !== editMember.id && u.active)
                  .map((u) => {
                    const isMgr = editManagerIds.includes(u.id)
                    return (
                      <label
                        key={u.id}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.82rem" }}
                      >
                        <input
                          type="checkbox"
                          checked={isMgr}
                          onChange={() => {
                            setEditManagerIds((prev) =>
                              prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                            )
                          }}
                        />
                        <span>{u.name} ({u.role?.name})</span>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className={modalStyles.actions}>
              <button
                type="button"
                className={modalStyles.cancelBtn}
                onClick={() => setEditMember(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={baseSettingsStyles.addBtn}
                disabled={editSubmitting}
              >
                {editSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================== INVITE TEAMMATE MODAL ===================== */}
      {inviteOpen && (
        <Modal open title="Invite Teammate" onClose={() => setInviteOpen(false)}>
          {tempPasswordResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ color: "var(--success)", fontWeight: "600", fontSize: "0.9rem" }}>
                ✓ Teammate account created successfully!
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {tempPasswordResult.emailSent
                  ? <>An onboarding email with their login details was sent to <strong>{tempPasswordResult.user.email}</strong>.</>
                  : <>Couldn't send the onboarding email (check Settings → Onboarding Email) — share these credentials with <strong>{tempPasswordResult.user.name}</strong> ({tempPasswordResult.user.email}) directly:</>}
              </p>
              <div className={styles.tempPassCard}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                    TEMPORARY PASSWORD {tempPasswordResult.emailSent && "(backup)"}
                  </div>
                  <div className={styles.tempPassValue}>{tempPasswordResult.tempPassword}</div>
                </div>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => copyTempPassword(tempPasswordResult.tempPassword)}
                >
                  {copied ? <MdCheck size={14} /> : <MdContentCopy size={14} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className={modalStyles.actions}>
                <button
                  type="button"
                  className={baseSettingsStyles.addBtn}
                  onClick={() => setInviteOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className={styles.modalForm}>
              {inviteError && <div style={{ color: "var(--error)", fontSize: "0.82rem" }}>{inviteError}</div>}
              <div className={styles.formField}>
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formField}>
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formField}>
                <label>Security Role</label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: e.target.value })}
                  className={styles.formSelect}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formField}>
                <label>Department / Team (Optional)</label>
                <select
                  value={inviteForm.teamId}
                  onChange={(e) => setInviteForm({ ...inviteForm, teamId: e.target.value })}
                  className={styles.formSelect}
                >
                  <option value="">No Team Assigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className={modalStyles.actions}>
                <button
                  type="button"
                  className={modalStyles.cancelBtn}
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={baseSettingsStyles.addBtn}
                  disabled={inviteSubmitting}
                >
                  {inviteSubmitting ? "Inviting…" : "Invite Teammate"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ===================== CREATE / EDIT TEAM MODAL ===================== */}
      {editTeamModal && (
        <Modal
          open
          title={editTeamModal === "new" ? "Create Department / Team" : `Edit Team — ${editTeamModal.name}`}
          onClose={() => setEditTeamModal(null)}
        >
          <form onSubmit={saveTeam} className={styles.modalForm}>
            {teamError && <div style={{ color: "var(--error)", fontSize: "0.82rem" }}>{teamError}</div>}
            <div className={styles.formField}>
              <label>Team / Department Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Enterprise Sales"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formField}>
              <label>Department Manager</label>
              <select
                value={teamManagerId}
                onChange={(e) => setTeamManagerId(e.target.value)}
                className={styles.formSelect}
              >
                <option value="">No Manager Assigned</option>
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>
                  ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Team Members ({teamMemberIds.length} assigned)</label>
              <div className={styles.memberChecklistContainer}>
                {users
                  .filter((u) => u.active)
                  .map((u) => {
                    const isMember = teamMemberIds.includes(u.id)
                    return (
                      <label key={u.id} className={styles.memberCheckRow}>
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={() => {
                            setTeamMemberIds((prev) =>
                              prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                            )
                          }}
                        />
                        <Avatar name={u.name} color={u.color} size={22} />
                        <div className={styles.memberCheckMeta}>
                          <span className={styles.memberCheckName}>{u.name}</span>
                          <span className={styles.memberCheckRole}>
                            {u.role?.name || "Member"}{u.team && u.team.name !== teamName ? ` • Currently in ${u.team.name}` : ""}
                          </span>
                        </div>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className={modalStyles.actions}>
              <button
                type="button"
                className={modalStyles.cancelBtn}
                onClick={() => setEditTeamModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={baseSettingsStyles.addBtn}
                disabled={teamSubmitting}
              >
                {teamSubmitting ? "Saving…" : "Save Team"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================== CREATE / EDIT ROLE MODAL ===================== */}
      {editRoleModal && (
        <Modal
          open
          title={editRoleModal === "new" ? "Create Custom Role" : `Edit Role — ${editRoleModal.name}`}
          onClose={() => setEditRoleModal(null)}
        >
          <form onSubmit={saveRole} className={styles.modalForm}>
            {roleError && <div style={{ color: "var(--error)", fontSize: "0.82rem" }}>{roleError}</div>}

            <div className={styles.formField}>
              <label>Role Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Sales Rep"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className={styles.formInput}
                disabled={!canManageRoles || (editRoleModal !== "new" && editRoleModal?.isBuiltIn)}
              />
            </div>

            <div className={styles.formField}>
              <label>Permissions ({selectedPerms.size} selected)</label>
              <div className={styles.permGroupsContainer}>
                {Object.entries(catalogue.groups || {}).map(([resource, actions]) => {
                  const groupPerms = actions.map((a) => `${resource}.${a}`)
                  const allChecked = groupPerms.every((p) => selectedPerms.has(p))
                  const someChecked = groupPerms.some((p) => selectedPerms.has(p))
                  return (
                    <div key={resource} className={styles.permGroup}>
                      <div className={styles.permGroupHeader}>
                        <label className={styles.permGroupToggle}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={!canManageRoles}
                            ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={() => toggleGroupAll(actions, resource)}
                          />
                          <span className={styles.permGroupName}>{resource}</span>
                        </label>
                        <span className={styles.permGroupCount}>
                          {groupPerms.filter((p) => selectedPerms.has(p)).length}/{groupPerms.length}
                        </span>
                      </div>
                      <div className={styles.permChipRow}>
                        {actions.map((action) => {
                          const perm = `${resource}.${action}`
                          const checked = selectedPerms.has(perm)
                          return (
                            <label key={perm} className={`${styles.permChip} ${checked ? styles.permChipActive : ""}`}>
                              <input type="checkbox" checked={checked} disabled={!canManageRoles} onChange={() => togglePerm(perm)} />
                              {labelize(action)}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={modalStyles.actions}>
              <button
                type="button"
                className={modalStyles.cancelBtn}
                onClick={() => setEditRoleModal(null)}
              >
                Cancel
              </button>
              {canManageRoles && (
                <button
                  type="submit"
                  className={baseSettingsStyles.addBtn}
                  disabled={roleSubmitting}
                >
                  {roleSubmitting ? "Saving…" : editRoleModal === "new" ? "Create Role" : "Save Changes"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
