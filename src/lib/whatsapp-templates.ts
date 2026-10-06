/**
 * WhatsApp message templates. Meta only lets a business start a conversation with templates approved in
 * WhatsApp Manager, so each one here must be created there with exactly this name, the "Utility" category
 * and this body. {{1}}, {{2}}… are filled in, in order, from `params`.
 * Meta's rules: a variable can't start or end the message, and two variables can't sit side by side.
 */
export const WHATSAPP_TEMPLATES = {
  class_reminder: {
    label: "Class reminder",
    when: "The day before and shortly before each class, like the email reminders.",
    body: "Hi {{1}}, a reminder that your class {{2}} is {{3}} ({{4}}). Class details: {{5}}\n\nSee you there!",
    sample: ["Ada", "Week 2: Data modelling", "tomorrow", "Tue 14 Oct, 18:00 – 20:00 WAT", "https://example.com/dashboard/cohorts/1"],
  },
  assignment_due: {
    label: "Deadline reminder",
    when: "Before an assignment is due, to students who haven't submitted yet.",
    body: "Hi {{1}}, your assignment {{2}} for {{3}} is due {{4}}. Submit it here: {{5}}\n\nYou've got this!",
    sample: ["Ada", "Sales dashboard", "Data Analytics with Power BI", "Fri 17 Oct, 23:59 WAT", "https://example.com/dashboard/assignments/1"],
  },
  enrollment_confirmed: {
    label: "Enrolment confirmed",
    when: "When a student's place on a cohort is confirmed.",
    body: "Hi {{1}}, you're enrolled on {{2}} ({{3}}). Your dashboard, timetable and class links are here: {{4}}\n\nWelcome aboard!",
    sample: ["Ada", "Data Analytics with Power BI", "October cohort, starting 13 Oct 2026", "https://example.com/dashboard"],
  },
  payment_receipt: {
    label: "Payment received",
    when: "When a payment is confirmed.",
    body: "Hi {{1}}, we've received your payment of {{2}} for {{3}}. Your reference is {{4}}.\n\nThank you!",
    sample: ["Ada", "₦250,000", "Data Analytics with Power BI", "TSU-2026-7F3A9C"],
  },
  free_class_reminder: {
    label: "Free class reminder",
    when: "Before a free class, to people who ticked “Also remind me on WhatsApp”.",
    body: "Hi {{1}}, your free class {{2}} is {{3}} ({{4}}). {{5}}\n\nSee you there!",
    sample: ["Ada", "Your first Power BI dashboard", "tomorrow", "Tue 14 Oct, 18:00 – 19:30 WAT", "Join here: https://meet.google.com/abc-defg-hij"],
  },
} as const;

export type WhatsAppTemplate = keyof typeof WHATSAPP_TEMPLATES;

/** Template languages Meta offers that suit the academy. The code must match the one chosen when creating the templates. */
export const WHATSAPP_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "en_GB", label: "English (UK)" },
  { value: "en_US", label: "English (US)" },
] as const;
