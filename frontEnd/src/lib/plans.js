// Mirrors backend/src/lib/plans.js for display purposes only — actual enforcement is
// server-side (invite/role-create/audit-log routes all 402 independently of this file).
export const PLAN_LIMITS = {
  free: { maxUsers: 3, customRoles: false, auditLog: false },
  pro: { maxUsers: 20, customRoles: true, auditLog: false },
  enterprise: { maxUsers: null, customRoles: true, auditLog: true },
}

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

export const PLAN_DETAILS = [
  { id: "free", label: "Free", price: "₹0", blurb: "Up to 3 users", features: ["3 team members", "Built-in roles (Org Admin/Manager/Rep)", "Core CRM: leads, contacts, deals, tasks"] },
  { id: "pro", label: "Pro", price: "₹2,499/mo", blurb: "Up to 20 users", features: ["20 team members", "Everything in Free", "Custom roles & granular permissions"] },
  { id: "enterprise", label: "Enterprise", price: "Talk to us", blurb: "Unlimited users", features: ["Unlimited team members", "Everything in Pro", "Audit log & compliance trail"] },
]