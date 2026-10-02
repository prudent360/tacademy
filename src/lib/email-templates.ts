/**
 * Built-in email templates. Admins can override the subject and body of each one
 * (Admin > Emails); the stored override lives in the email_templates table.
 *
 * Bodies are Markdown. {{variable}} inserts a value and [[Button label|{{url}}]]
 * on its own line renders a button.
 */
export type TemplateDef = {
  name: string;
  description: string;
  /** Variable -> sample value used for previews and test sends. */
  variables: Record<string, string>;
  subject: string;
  body: string;
};

/** Available in every template. */
export const COMMON_VARIABLES: Record<string, string> = {
  name: "Ada",
  siteName: "Tekskillup Academy",
  siteUrl: "https://example.com",
  supportEmail: "hello@example.com",
};

export const EMAIL_TEMPLATES = {
  welcome: {
    name: "Welcome",
    description: "Sent when a student creates an account. Includes the email verification link.",
    variables: { verifyUrl: "https://example.com/verify-email?token=sample" },
    subject: "Welcome to {{siteName}}",
    body: `Hi {{name}},

Welcome to **{{siteName}}**. Your account is ready, so you can browse upcoming cohorts and enrol whenever you're ready.

Please confirm your email address so we can send you class reminders and feedback:

[[Confirm my email|{{verifyUrl}}]]

See you in class,
The {{siteName}} team`,
  },
  verify_email: {
    name: "Confirm email",
    description: "Sent when someone asks for a new verification link.",
    variables: { verifyUrl: "https://example.com/verify-email?token=sample" },
    subject: "Confirm your email address",
    body: `Hi {{name}},

Confirm your email address to keep receiving class reminders, assignment feedback and receipts.

[[Confirm my email|{{verifyUrl}}]]

This link expires in 3 days. If you didn't ask for it, you can ignore this email.`,
  },
  password_reset: {
    name: "Password reset",
    description: "Sent when someone uses \"Forgot password\".",
    variables: { resetUrl: "https://example.com/reset-password?token=sample" },
    subject: "Reset your {{siteName}} password",
    body: `Hi {{name}},

We received a request to reset your password. Choose a new one here:

[[Reset password|{{resetUrl}}]]

This link expires in 1 hour. If you didn't ask for a reset, you can safely ignore this email; your password won't change.`,
  },
  invite: {
    name: "Account invitation",
    description: "Sent when an admin adds an instructor, admin or student account.",
    variables: { role: "instructor", inviteUrl: "https://example.com/reset-password?token=sample" },
    subject: "You've been invited to {{siteName}}",
    body: `Hi {{name}},

You've been added to **{{siteName}}** as an **{{role}}**. Set your password to sign in:

[[Set my password|{{inviteUrl}}]]

This link expires in 7 days.`,
  },
  enrollment_confirmed: {
    name: "Enrolment confirmed",
    description: "Sent when a student's place on a cohort is confirmed (paid, free or added by an admin).",
    variables: { courseTitle: "Data Analytics with Power BI", cohortName: "October 2026", startDate: "6 Oct 2026", deliveryMode: "Hybrid", dashboardUrl: "https://example.com/dashboard" },
    subject: "You're in: {{courseTitle}} ({{cohortName}})",
    body: `Hi {{name}},

Your place on **{{courseTitle}}** ({{cohortName}}) is confirmed.

- **Starts:** {{startDate}}
- **Format:** {{deliveryMode}}

Your timetable, joining links, venue details and assignments are all in your dashboard. We'll also email you a reminder the day before and an hour before each class.

[[Go to my dashboard|{{dashboardUrl}}]]`,
  },
  account_setup: {
    name: "Student account set-up",
    description: "Sent when someone who enrolled without an account is given their place. Lets them choose a password.",
    variables: { courseTitle: "Data Analytics with Power BI", setupUrl: "https://example.com/reset-password?token=sample" },
    subject: "Set up your {{siteName}} student account",
    body: `Hi {{name}},

Welcome to **{{siteName}}**! Your place on **{{courseTitle}}** is confirmed and your student account is ready.

Choose a password to sign in and see your timetable, class links and assignments:

[[Set my password|{{setupUrl}}]]

This link expires in 7 days. If it runs out, use "Forgot password" on the sign-in page.`,
  },
  payment_receipt: {
    name: "Payment receipt",
    description: "Sent after a successful payment.",
    variables: { amount: "£499", reference: "TSU-8K2P-1Q4Z", description: "Data Analytics with Power BI – October 2026", paidAt: "26 Sep 2026", gateway: "Stripe", paymentsUrl: "https://example.com/dashboard/payments" },
    subject: "Receipt for your payment of {{amount}}",
    body: `Hi {{name}},

Thanks for your payment. Here are the details for your records:

| | |
|---|---|
| **Amount** | {{amount}} |
| **For** | {{description}} |
| **Reference** | {{reference}} |
| **Date** | {{paidAt}} |
| **Paid via** | {{gateway}} |

[[View my payments|{{paymentsUrl}}]]`,
  },
  balance_reminder: {
    name: "Outstanding balance reminder",
    description: "Sent manually by an admin when a student has a remaining course balance.",
    variables: { courseTitle: "Data Analytics with Power BI", cohortName: "October 2026", amount: "£349.30", paid: "£149.70", paymentsUrl: "https://example.com/dashboard/payments" },
    subject: "Reminder: {{amount}} balance for {{courseTitle}}",
    body: `Hi {{name}},

This is a friendly reminder that **{{amount}}** remains to be paid for **{{courseTitle}}** ({{cohortName}}).

You have already paid **{{paid}}**. You can securely pay the remaining balance from your dashboard:

[[Pay my balance|{{paymentsUrl}}]]

If you have already arranged payment with the academy, please ignore this message or contact us at {{supportEmail}}.`,
  },
  session_reminder: {
    name: "Class reminder",
    description: "Sent the day before and one hour before each class.",
    variables: { sessionTitle: "Week 2: Data modelling", courseTitle: "Data Analytics with Power BI", when: "Tue 7 Oct, 18:00 – 20:00 BST", leadTime: "tomorrow", modeLabel: "Live online", location: "Join link: https://meet.google.com/abc-defg-hij", sessionUrl: "https://example.com/dashboard/cohorts/1" },
    subject: "Reminder: {{sessionTitle}} is {{leadTime}}",
    body: `Hi {{name}},

A quick reminder that your class is **{{leadTime}}**.

- **Class:** {{sessionTitle}} ({{courseTitle}})
- **When:** {{when}}
- **Format:** {{modeLabel}}
- {{location}}

[[View class details|{{sessionUrl}}]]`,
  },
  session_updated: {
    name: "Class changed",
    description: "Sent when a class is rescheduled, moved or cancelled.",
    variables: { sessionTitle: "Week 2: Data modelling", courseTitle: "Data Analytics with Power BI", change: "The class has moved to Wed 8 Oct, 18:00 – 20:00 BST.", sessionUrl: "https://example.com/dashboard/cohorts/1" },
    subject: "Update: {{sessionTitle}}",
    body: `Hi {{name}},

There's an update to **{{sessionTitle}}** ({{courseTitle}}):

{{change}}

[[View the timetable|{{sessionUrl}}]]`,
  },
  assignment_published: {
    name: "New assignment",
    description: "Sent to students when an instructor publishes an assignment.",
    variables: { assignmentTitle: "Build a sales dashboard", courseTitle: "Data Analytics with Power BI", dueDate: "Sun 12 Oct, 23:59 BST", assignmentUrl: "https://example.com/dashboard/assignments/1" },
    subject: "New assignment: {{assignmentTitle}}",
    body: `Hi {{name}},

A new assignment has been set for **{{courseTitle}}**.

**{{assignmentTitle}}**
Due: {{dueDate}}

[[Open the assignment|{{assignmentUrl}}]]`,
  },
  assignment_due: {
    name: "Assignment due soon",
    description: "Sent about a day before the deadline to students who haven't submitted.",
    variables: { assignmentTitle: "Build a sales dashboard", courseTitle: "Data Analytics with Power BI", dueDate: "Sun 12 Oct, 23:59 BST", assignmentUrl: "https://example.com/dashboard/assignments/1" },
    subject: "Due soon: {{assignmentTitle}}",
    body: `Hi {{name}},

**{{assignmentTitle}}** for {{courseTitle}} is due **{{dueDate}}**, and we haven't received your submission yet.

[[Submit my work|{{assignmentUrl}}]]

If you're stuck, reply to your instructor in class or reach out at {{supportEmail}}.`,
  },
  submission_received: {
    name: "Submission received (instructor)",
    description: "Sent to the cohort's instructors when a student submits work.",
    variables: { studentName: "Ada Obi", assignmentTitle: "Build a sales dashboard", courseTitle: "Data Analytics with Power BI", gradeUrl: "https://example.com/teach/submissions/1" },
    subject: "{{studentName}} submitted {{assignmentTitle}}",
    body: `Hi {{name}},

**{{studentName}}** has submitted **{{assignmentTitle}}** ({{courseTitle}}).

[[Review and give feedback|{{gradeUrl}}]]`,
  },
  feedback_posted: {
    name: "Feedback ready",
    description: "Sent to a student when their work is graded or returned for changes.",
    variables: { assignmentTitle: "Build a sales dashboard", result: "You scored 86 / 100.", assignmentUrl: "https://example.com/dashboard/assignments/1" },
    subject: "Feedback on {{assignmentTitle}}",
    body: `Hi {{name}},

Your instructor has reviewed **{{assignmentTitle}}**. {{result}}

[[Read the feedback|{{assignmentUrl}}]]`,
  },
  announcement: {
    name: "Cohort announcement",
    description: "Sent to every student in a cohort when an instructor posts an announcement.",
    variables: { title: "Bring your laptop on Saturday", message: "We'll be building dashboards together, so please install Power BI Desktop beforehand.", courseTitle: "Data Analytics with Power BI", cohortUrl: "https://example.com/dashboard/cohorts/1" },
    subject: "{{courseTitle}}: {{title}}",
    body: `Hi {{name}},

**{{title}}**

{{message}}

[[Open my course|{{cohortUrl}}]]`,
  },
  certificate_issued: {
    name: "Certificate issued",
    description: "Sent when a student meets the completion requirements and receives a certificate.",
    variables: { courseTitle: "Data Analytics with Power BI", certificateCode: "TSU-2026-A1B2C3", certificateUrl: "https://example.com/certificates/TSU-2026-A1B2C3" },
    subject: "Your {{courseTitle}} certificate is ready",
    body: `Hi {{name}},

Congratulations — you have completed **{{courseTitle}}** and your verified certificate is ready.

Certificate ID: **{{certificateCode}}**

[[View and download my certificate|{{certificateUrl}}]]`,
  },
  curriculum_request: {
    name: "Curriculum download",
    description: "Sent when a visitor requests a course curriculum from the course page.",
    variables: { courseTitle: "Data Analytics with Power BI", curriculumUrl: "https://example.com/uploads/courses/curriculum.pdf", courseUrl: "https://example.com/courses/data-analytics" },
    subject: "Your {{courseTitle}} curriculum",
    body: `Hi {{name}},

Thanks for your interest in **{{courseTitle}}**. Here's the full curriculum:

[[Download the curriculum|{{curriculumUrl}}]]

When you're ready, you can see upcoming dates and fees on the course page: {{courseUrl}}

Any questions? Just reply to this email.`,
  },
  application_received: {
    name: "Internship application received",
    description: "Sent to an applicant straight after they apply for the internship programme.",
    variables: { programme: "Data Analytics Internship" },
    subject: "We've received your internship application",
    body: `Hi {{name}},

Thanks for applying to the **{{programme}}** at {{siteName}}. We've received your application and our team will review it shortly.

We'll email you with the outcome, usually within a week. If anything changes in the meantime, just reply to this email.

The {{siteName}} team`,
  },
  application_accepted: {
    name: "Internship application accepted",
    description: "Sent when an admin accepts an internship application. Includes the link to enrol on the intake.",
    variables: { programme: "Data Analytics Internship", intake: "January 2027 intake", enrolUrl: "https://example.com/enroll?cohort=1" },
    subject: "You've been accepted: {{programme}}",
    body: `Hi {{name}},

Great news: you've been accepted onto the **{{programme}}** ({{intake}}).

Secure your place using the button below. If you're a graduate of {{siteName}}, sign in first and your place is free.

[[Secure my place|{{enrolUrl}}]]

We're looking forward to working with you.

The {{siteName}} team`,
  },
  application_rejected: {
    name: "Internship application not successful",
    description: "Sent when an admin decides not to offer an internship place.",
    variables: { programme: "Data Analytics Internship" },
    subject: "Your internship application",
    body: `Hi {{name}},

Thank you for applying to the **{{programme}}** at {{siteName}}, and for the time you put into your application.

We're not able to offer you a place on this intake. We received many strong applications and places are limited.

You're very welcome to apply again for a future intake, and our courses are a great way to build the skills our internships look for: {{siteUrl}}/courses

The {{siteName}} team`,
  },
  instructor_application_received: {
    name: "Instructor application received",
    description: "Sent to someone straight after they apply to become an instructor.",
    variables: { expertise: "Data analysis" },
    subject: "We've received your application to teach",
    body: `Hi {{name}},

Thanks for applying to teach **{{expertise}}** at {{siteName}}. We've received your application and our team will review it shortly.

If your experience is a good fit, we'll be in touch to arrange a short call, usually within a week. If anything changes in the meantime, just reply to this email.

The {{siteName}} team`,
  },
  instructor_application_accepted: {
    name: "Instructor application accepted",
    description: "Sent when an admin accepts an instructor application. Includes the link to set a password or sign in.",
    variables: { accountUrl: "https://example.com/reset-password?token=sample", buttonLabel: "Set up my instructor account", cohortNote: "You'll be teaching **Data Analytics with Power BI** (October 2026). You'll find it under Teaching once you sign in." },
    subject: "Welcome to the {{siteName}} teaching team",
    body: `Hi {{name}},

Great news: we'd love you to teach with **{{siteName}}**. Your instructor account is ready.

{{cohortNote}}

[[{{buttonLabel}}|{{accountUrl}}]]

Once you're in, you'll find your cohorts, the curriculum builder, grading and attendance in one place. We'll be in touch about your first cohort and the next steps.

Welcome aboard,
The {{siteName}} team`,
  },
  instructor_application_rejected: {
    name: "Instructor application not successful",
    description: "Sent when an admin decides not to take an instructor application forward.",
    variables: { expertise: "Data analysis" },
    subject: "Your application to teach with {{siteName}}",
    body: `Hi {{name}},

Thank you for applying to teach **{{expertise}}** with {{siteName}}, and for the time you took to tell us about your experience.

We're not able to take your application forward at the moment. Our needs change as new courses and cohorts open, so you're very welcome to apply again in future.

The {{siteName}} team`,
  },
} satisfies Record<string, TemplateDef>;

export type TemplateKey = keyof typeof EMAIL_TEMPLATES;

export function isTemplateKey(key: string): key is TemplateKey {
  return Object.hasOwn(EMAIL_TEMPLATES, key);
}
