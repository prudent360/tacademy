/**
 * Everything the admin area checks. Custom staff roles (Settings › Team & roles) grant a subset; Administrators
 * always have all of them. Instructors and students don't use these: instructors teach the cohorts they're
 * assigned to, students learn.
 */
export const PERMISSIONS = [
  "admin.access",
  "insights.view",
  "reports.view",
  "audit.view",
  "courses.manage",
  "certificates.manage",
  "applications.review",
  "users.view",
  "users.manage",
  "instructors.review",
  "reviews.manage",
  "payments.view",
  "payments.manage",
  "discounts.manage",
  "leads.view",
  "referrals.manage",
  "team.manage",
  "settings.manage",
  "emails.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string; hint: string }[] }[] = [
  { title: "General", items: [
    { key: "admin.access", label: "Open the admin area", hint: "Needed for anything else here, and shows the admin dashboard" },
    { key: "insights.view", label: "View learning insights", hint: "Engagement charts and learners at risk" },
    { key: "reports.view", label: "View reports", hint: "Revenue, enrolments and conversion, with CSV export" },
    { key: "audit.view", label: "View the audit log", hint: "See what every team member has done" },
  ] },
  { title: "Programmes", items: [
    { key: "courses.manage", label: "Manage courses and cohorts", hint: "Courses, internships, cohorts, prices, timetables and curriculum" },
    { key: "certificates.manage", label: "Manage certificates", hint: "Issue and revoke certificates" },
    { key: "applications.review", label: "Review internship applications", hint: "Shortlist, accept or decline applicants" },
    { key: "reviews.manage", label: "Moderate student reviews", hint: "Publish or hide reviews on course pages" },
  ] },
  { title: "People", items: [
    { key: "users.view", label: "View people", hint: "Students and instructors, their details and progress" },
    { key: "users.manage", label: "Manage people", hint: "Invite, edit, enrol, complete and deactivate accounts" },
    { key: "instructors.review", label: "Review instructor applications", hint: "Accept people as instructors" },
  ] },
  { title: "Sales", items: [
    { key: "payments.view", label: "View payments", hint: "Transactions and CSV exports" },
    { key: "payments.manage", label: "Manage payments", hint: "Confirm transfers, record payments, refunds and balance reminders" },
    { key: "discounts.manage", label: "Manage discount codes", hint: "Create and switch off codes" },
    { key: "leads.view", label: "View curriculum requests", hint: "People who downloaded a curriculum" },
    { key: "referrals.manage", label: "Manage referrals", hint: "See referral commissions and mark them paid" },
  ] },
  { title: "Administration", items: [
    { key: "team.manage", label: "Manage team and roles", hint: "Invite staff, change roles and what each role can do" },
    { key: "settings.manage", label: "Platform settings", hint: "Branding, payments, email, AI and other integrations" },
    { key: "emails.manage", label: "Email templates", hint: "Edit, switch off and test the emails the academy sends" },
  ] },
];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}
