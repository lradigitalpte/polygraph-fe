import type { UserActivityRecord } from "@/lib/users";

/**
 * Turns a raw audit-log request (method + API path) into a sentence a person can read.
 * "GET /api/users/29/permissions" -> "Viewed permissions of user #29".
 */

export type ActivityKind = "change" | "view" | "background";

export type DescribedActivity = {
  title: string;
  kind: ActivityKind;
};

// [singular, plural]
const RESOURCES: Record<string, [string, string]> = {
  users: ["user", "users"],
  appointments: ["exam", "exams"],
  exams: ["exam", "exams"],
  clients: ["client", "clients"],
  leads: ["lead", "leads"],
  reports: ["report", "reports"],
  availability: ["availability", "availability"],
  blocks: ["availability block", "availability blocks"],
  agreements: ["agreement", "agreements"],
  templates: ["template", "templates"],
  types: ["exam type", "exam types"],
  roles: ["role", "roles"],
  permissions: ["permission", "permissions"],
  settings: ["setting", "settings"],
  organization: ["organization settings", "organization settings"],
  expenses: ["expense", "expenses"],
  "payment-methods": ["payment method", "payment methods"],
  "purchase-items": ["inventory item", "inventory items"],
  "question-templates": ["question template", "question templates"],
  questions: ["question", "questions"],
  examinees: ["examinee", "examinees"],
  documents: ["document", "documents"],
  shares: ["shared link", "shared links"],
  payments: ["payment", "payments"],
  quotations: ["quotation", "quotations"],
  invoices: ["invoice", "invoices"],
  "prepaid-slots": ["prepaid slot", "prepaid slots"],
  signature: ["signature", "signature"],
  stats: ["stats", "stats"],
  "sales-report": ["sales report", "sales reports"],
  "vat-return": ["VAT return", "VAT returns"],
  ledger: ["ledger", "ledger"],
  activity: ["activity", "activity"],
  audit: ["audit log", "audit log"],
  "workflow-status": ["workflow status", "workflow status"],
  examiners: ["examiner", "examiners"],
  rbac: ["access setting", "access settings"],
  "audit-logs": ["audit log", "audit log"],
};

// Trailing path segments that are actions, not resources. Past tense, then the thing acted on.
const ACTIONS: Record<string, string> = {
  "require-password-reset": "Required a password reset for",
  role: "Changed the role of",
  active: "Changed the active state of",
  status: "Changed the status of",
  approve: "Approved",
  "send-email": "Sent an email for",
  "send-payment-reminder": "Sent a payment reminder for",
  "collect-payment": "Recorded a payment for",
  payment: "Updated the payment for",
  finalize: "Finalized",
  void: "Voided",
  resend: "Resent",
  convert: "Converted",
  "sync-stripe-payment": "Synced the Stripe payment for",
  "revoke-slot": "Revoked a prepaid slot on",
  "mint-prepaid-slots": "Created prepaid slots for",
  "apply-prepaid-slot": "Applied a prepaid slot to",
  "override-unlock": "Unlocked",
  "cancellation-policy": "Updated the cancellation policy of",
  start: "Started",
  sign: "Signed",
  decline: "Declined",
  archive: "Archived",
  restore: "Restored",
  regenerate: "Regenerated",
};

// Numeric ids, UUIDs, or long opaque tokens (which always contain a digit, unlike action words).
const isId = (segment: string) =>
  /^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || (/^[A-Za-z0-9_-]{20,}$/.test(segment) && /\d/.test(segment));

// Friendlier names for "<resource>/<sub>" pages, where joining the two words reads badly.
const PAGE_NAMES: Record<string, string> = {
  "availability/blocks": "availability blocks",
  "settings/organization": "organization settings",
  "reports/stats": "report stats",
  "reports/workflow-status": "workflow status",
  "agreements/templates": "agreement templates",
  "agreements/booking-status": "agreement status",
  "users/examiners": "examiners",
  "rbac/roles": "roles",
  "rbac/permissions": "permissions",
};

function label(segment: string, plural: boolean): string {
  const known = RESOURCES[segment];
  if (known) return known[plural ? 1 : 0];
  return segment.replace(/[-_]/g, " ");
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeActivity(log: Pick<UserActivityRecord, "method" | "path" | "action">): DescribedActivity {
  const method = log.method.toUpperCase();
  const clean = log.path.split("?")[0].replace(/^\/+api\/+/, "").replace(/\/+$/, "");
  const segments = clean.split("/").filter(Boolean);

  if (segments.length === 0) return { title: capitalise(log.action || `${method} request`), kind: method === "GET" ? "view" : "change" };

  // Session bootstrap calls the app makes on every page load — not something the person did.
  if (segments[0] === "me") return { title: "Opened the dashboard", kind: "background" };

  const resource = segments[0];
  const rest = segments.slice(1);
  const id = rest.find(isId);
  const named = rest.filter((s) => !isId(s));
  const sub = named[named.length - 1]; // e.g. "permissions" in /users/29/permissions
  const isRead = method === "GET";

  const target = (() => {
    // Singular "user #29" when an id is present, otherwise the plural collection.
    const noun = label(resource, !id);
    return id ? `${noun} #${id}` : noun;
  })();

  // Action endpoints: POST/PATCH /appointments/12/approve
  if (!isRead && sub && ACTIONS[sub]) {
    return { title: `${ACTIONS[sub]} ${target}`, kind: "change" };
  }

  const subIdx = sub ? rest.indexOf(sub) : -1;
  const idIdx = id ? rest.indexOf(id) : -1;
  const hasSub = Boolean(sub) && sub !== resource;

  if (isRead) {
    if (hasSub) {
      if (id && idIdx > subIdx) return { title: `Opened ${label(sub, false)} #${id}`, kind: "view" };
      if (id) return { title: `Viewed ${label(sub, true)} of ${label(resource, false)} #${id}`, kind: "view" };
      return { title: `Viewed ${PAGE_NAMES[`${resource}/${sub}`] ?? label(sub, true)}`, kind: "view" };
    }
    return { title: id ? `Opened ${target}` : `Viewed ${label(resource, true)}`, kind: "view" };
  }

  const verb = method === "POST" ? "Added" : method === "DELETE" ? "Deleted" : "Updated";

  if (hasSub) {
    if (id && idIdx > subIdx) return { title: `${verb} ${label(sub, false)} #${id}`, kind: "change" };
    if (id) return { title: `${verb} ${label(sub, method !== "POST")} for ${label(resource, false)} #${id}`, kind: "change" };
    return { title: `${verb} ${label(sub, false)}`, kind: "change" };
  }

  if (method === "POST") return { title: `Created ${label(resource, false)}`, kind: "change" };
  if (method === "DELETE") return { title: `Deleted ${target}`, kind: "change" };
  return { title: `Updated ${target}`, kind: "change" };
}
