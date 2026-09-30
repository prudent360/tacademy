import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const ROLES = ["admin", "instructor", "student"] as const;
export type Role = (typeof ROLES)[number];

/** An internship is run like a course (cohorts, classes, assignments) but listed separately. */
export const COURSE_KINDS = ["course", "internship"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const DELIVERY_MODES = ["virtual", "physical", "hybrid"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export const SESSION_MODES = ["virtual", "physical"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

/** graduate: joined free because they completed an academy course. */
export type EnrollmentSource = "payment" | "free" | "graduate" | "manual";
export const ENROLLMENT_STATUSES = ["pending", "active", "completed", "cancelled"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type Gateway = "stripe" | "paystack" | "pawapay" | "manual" | "test";
/** full: all tuition now · deposit: part of the tuition now · registration: registration fee only · balance: the rest later. */
export type PaymentPlan = "full" | "deposit" | "registration" | "balance";

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const SUBMISSION_STATUSES = ["submitted", "graded", "resubmit"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Amounts in minor units (pence, kobo) keyed by ISO currency code. */
export type PriceMap = Partial<Record<string, number>>;

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").$type<Role>().notNull().default("student"),
  phone: text("phone").notNull().default(""),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** YYYY-MM-DD, collected at enrolment. */
  dateOfBirth: text("date_of_birth"),
  qualification: text("qualification").notNull().default(""),
  /** ISO 3166 alpha-2, chosen at enrolment; sets the currency and payment options offered. */
  country: text("country"),
  emailReminders: boolean("email_reminders").notNull().default(true),
  /** Bumped to sign the user out everywhere (password reset, deactivation). */
  sessionVersion: integer("session_version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/** One-time links for email verification, password resets and invitations. Only the hash is stored. */
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").$type<"verify" | "reset" | "invite">().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  createdAt: createdAt(),
}, (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)]);

export type Stat = { value: string; label: string };

/** Secrets are stored encrypted (lib/secrets.ts); empty string means "not set, use the environment variable". */
export type GatewaySettings = {
  enabled: boolean;
  mode: "test" | "live";
  testPublicKey: string;
  testSecretKey: string;
  livePublicKey: string;
  liveSecretKey: string;
  testWebhookSecret?: string;
  liveWebhookSecret?: string;
};
export type BankTransferSettings = { enabled: boolean; accountName: string; bankName: string; accountNumber: string; sortCode: string; currency: string; instructions: string };
export type PaymentSettings = { stripe: GatewaySettings; paystack: GatewaySettings; pawapay: GatewaySettings; bank: BankTransferSettings };
export type EmailDriver = "resend" | "smtp" | "log";
/** smtpPassword and apiKey are stored encrypted. */
export type EmailSettings = {
  driver: EmailDriver;
  apiKey: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "ssl" | "tls" | "none";
  smtpUser: string;
  smtpPassword: string;
};
export type AiProvider = "openai" | "anthropic";
/**
 * Keys are stored encrypted; an empty key falls back to OPENAI_API_KEY / ANTHROPIC_API_KEY.
 * apiKey and model are Anthropic's (kept for settings saved before OpenAI was added).
 */
export type AiSettings = {
  enabled: boolean;
  provider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  apiKey: string;
  model: string;
  advisor: boolean;
  studyBuddy: boolean;
  grading: boolean;
  writing: boolean;
};
/** Search and social sharing settings; empty values fall back to the site name, tagline and course details. */
export type SeoSettings = {
  /** Page titles, e.g. "%s | Tekskillup Academy"; %s is the page name. */
  titleTemplate: string;
  homeTitle: string;
  homeDescription: string;
  defaultDescription: string;
  coursesDescription: string;
  internshipsDescription: string;
  shareImageUrl: string | null;
  twitterHandle: string;
  googleVerification: string;
  bingVerification: string;
  /** Off hides the whole site from search engines (useful for a staging copy). */
  allowIndexing: boolean;
  /** Social profile links, listed in the organisation's structured data. */
  socialProfiles: string[];
};
/** bunnyTokenKey is stored encrypted; when set, Bunny Stream lesson videos get expiring signed links. */
export type VideoSettings = { bunnyTokenKey: string };
export type ReminderSettings = { dayBefore: boolean; hourBefore: boolean; hourLeadMinutes: number; assignmentDue: boolean; assignmentLeadHours: number };
export type Faq = { question: string; answer: string };
export type Testimonial = { quote: string; name: string; role: string };
export type CourseModule = { title: string; summary: string };

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("Academy"),
  tagline: text("tagline").notNull().default(""),
  heroEyebrow: text("hero_eyebrow").notNull().default(""),
  heroTitle: text("hero_title").notNull().default(""),
  heroSubtitle: text("hero_subtitle").notNull().default(""),
  logoUrl: text("logo_url"),
  /** Photo on the home page hero; a bundled team photo is used when empty. */
  heroImageUrl: text("hero_image_url"),
  supportEmail: text("support_email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  timezone: text("timezone").notNull().default("Europe/London"),
  currencies: jsonb("currencies").$type<string[]>().notNull().default(["GBP"]),
  stats: jsonb("stats").$type<Stat[]>().notNull().default([]),
  faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
  testimonials: jsonb("testimonials").$type<Testimonial[]>().notNull().default([]),
  payment: jsonb("payment").$type<Partial<PaymentSettings>>().notNull().default({}),
  email: jsonb("email").$type<Partial<EmailSettings>>().notNull().default({}),
  reminders: jsonb("reminders").$type<Partial<ReminderSettings>>().notNull().default({}),
  ai: jsonb("ai").$type<Partial<AiSettings>>().notNull().default({}),
  seo: jsonb("seo").$type<Partial<SeoSettings>>().notNull().default({}),
  video: jsonb("video").$type<Partial<VideoSettings>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  kind: text("kind").$type<CourseKind>().notNull().default("course"),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default(""),
  level: text("level").notNull().default("Beginner"),
  durationWeeks: integer("duration_weeks"),
  outcomes: jsonb("outcomes").$type<string[]>().notNull().default([]),
  curriculum: jsonb("curriculum").$type<CourseModule[]>().notNull().default([]),
  portfolioProjects: jsonb("portfolio_projects").$type<string[]>().notNull().default([]),
  jobRoles: jsonb("job_roles").$type<string[]>().notNull().default([]),
  certificateEnabled: boolean("certificate_enabled").notNull().default(true),
  certificateMinAttendance: integer("certificate_min_attendance").notNull().default(70),
  certificateMinAssignments: integer("certificate_min_assignments").notNull().default(80),
  certificateMinScore: integer("certificate_min_score").notNull().default(50),
  /** Average of each quiz's best score; 0 means quizzes don't count towards the certificate. */
  certificateMinQuizScore: integer("certificate_min_quiz_score").notNull().default(0),
  imageUrl: text("image_url"),
  /** Full-width photo behind the course page hero; the hero stays white without one. */
  heroImageUrl: text("hero_image_url"),
  /** Optional search result title and description; the title and summary are used when empty. */
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  /** Downloadable curriculum, given out in exchange for contact details. */
  curriculumUrl: text("curriculum_url"),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const APPLICATION_STATUSES = ["new", "shortlisted", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type StudyMode = "remote" | "in_person" | "either";

/** Applications from the "Join our internship programme" form, reviewed by admins before an enrolment link is sent. */
export const internshipApplications = pgTable("internship_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  /** ISO 3166 alpha-2. */
  country: text("country").notNull(),
  city: text("city").notNull().default(""),
  /** What they said, and whether a completed academy course was found for their email. */
  graduateClaimed: boolean("graduate_claimed").notNull().default(false),
  graduateVerified: boolean("graduate_verified").notNull().default(false),
  qualification: text("qualification").notNull().default(""),
  currentStatus: text("current_status").notNull().default(""),
  skillArea: text("skill_area").notNull().default(""),
  experience: text("experience").notNull().default(""),
  /** The intake they'd like; null for "not sure". */
  preferredCohortId: integer("preferred_cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  mode: text("mode").$type<StudyMode>().notNull().default("either"),
  hoursPerWeek: text("hours_per_week").notNull().default(""),
  hasLaptop: boolean("has_laptop").notNull().default(false),
  hasInternet: boolean("has_internet").notNull().default(false),
  portfolioUrl: text("portfolio_url"),
  linkedinUrl: text("linkedin_url"),
  cvUrl: text("cv_url"),
  motivation: text("motivation").notNull().default(""),
  heardFrom: text("heard_from").notNull().default(""),
  isAdult: boolean("is_adult").notNull().default(false),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  status: text("status").$type<ApplicationStatus>().notNull().default("new"),
  adminNotes: text("admin_notes").notNull().default(""),
  /** The intake an accepted applicant was invited to enrol on. */
  acceptedCohortId: integer("accepted_cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  decidedById: integer("decided_by_id").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("internship_applications_status_idx").on(t.status, t.createdAt), index("internship_applications_email_idx").on(t.email)]);

export type InternshipApplication = typeof internshipApplications.$inferSelect;

/**
 * Courses linked to an internship programme: graduates of any of them join the internship's
 * "free for graduates" intakes without paying. With none linked, any course graduate qualifies.
 */
export const internshipCourses = pgTable("internship_courses", {
  internshipId: integer("internship_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.internshipId, t.courseId] })]);

/** Leads from the "View curriculum" form on course pages. */
export const curriculumRequests = pgTable("curriculum_requests", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
  /** Kept so the lead still makes sense if the course is deleted. */
  courseTitle: text("course_title").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  createdAt: createdAt(),
}, (t) => [index("curriculum_requests_created_idx").on(t.createdAt)]);

export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** YYYY-MM-DD */
  startDate: text("start_date"),
  endDate: text("end_date"),
  deliveryMode: text("delivery_mode").$type<DeliveryMode>().notNull().default("virtual"),
  /** Default venue for in-person sessions. */
  venue: text("venue").notNull().default(""),
  schedule: text("schedule").notNull().default(""),
  capacity: integer("capacity"),
  prices: jsonb("prices").$type<PriceMap>().notNull().default({}),
  depositPercent: integer("deposit_percent"),
  /** One-off fee added to the first payment, keyed by currency like prices. */
  registrationFees: jsonb("registration_fees").$type<PriceMap>().notNull().default({}),
  /** Lets students pay only the registration fee at enrolment and the tuition later. */
  registrationOnly: boolean("registration_only").notNull().default(false),
  /** Students who completed one of the academy's courses join without paying. */
  graduatesFree: boolean("graduates_free").notNull().default(false),
  enrollmentOpen: boolean("enrollment_open").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("cohorts_course_idx").on(t.courseId)]);

/** Reusable learning content owned by a course and shared by all of its cohorts. */
export const courseModules = pgTable("course_modules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  position: integer("position").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("course_modules_course_idx").on(t.courseId, t.position)]);

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  content: text("content").notNull().default(""),
  videoUrl: text("video_url"),
  resourceUrl: text("resource_url"),
  resourceLabel: text("resource_label").notNull().default(""),
  estimatedMinutes: integer("estimated_minutes").notNull().default(10),
  position: integer("position").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("lessons_module_idx").on(t.moduleId, t.position)]);

/** Optional per-cohort release timing; no row means the published module is available immediately. */
export const moduleReleases = pgTable("module_releases", {
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  moduleId: integer("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
  releaseAt: timestamp("release_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.cohortId, t.moduleId] }), index("module_releases_cohort_idx").on(t.cohortId, t.releaseAt)]);

export const cohortInstructors = pgTable("cohort_instructors", {
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.cohortId, t.userId] })]);

export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  mode: text("mode").$type<SessionMode>().notNull().default("virtual"),
  meetingUrl: text("meeting_url"),
  venue: text("venue").notNull().default(""),
  recordingUrl: text("recording_url"),
  cancelled: boolean("cancelled").notNull().default(false),
  reminderDaySentAt: timestamp("reminder_day_sent_at", { withTimezone: true }),
  reminderHourSentAt: timestamp("reminder_hour_sent_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("class_sessions_cohort_idx").on(t.cohortId, t.startsAt)]);

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  status: text("status").$type<EnrollmentStatus>().notNull().default("pending"),
  source: text("source").$type<EnrollmentSource>().notNull().default("payment"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  /** When an admin marked the course completed; dates the completion XP. */
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("enrollments_user_cohort_idx").on(t.userId, t.cohortId), index("enrollments_cohort_idx").on(t.cohortId)]);

/** Completion belongs to an enrolment so retaking a course in another cohort starts fresh. */
export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("lesson_progress_enrollment_lesson_idx").on(t.enrollmentId, t.lessonId), index("lesson_progress_enrollment_idx").on(t.enrollmentId)]);

export const QUESTION_KINDS = ["single", "multiple", "truefalse", "sql"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** The tables in a SQL dataset, for showing students what they can query. */
export type SqlTableInfo = { name: string; rows: number; columns: { name: string; type: string }[] };
/** A query's result as marked: column names and rows of values turned into text. */
export type SqlResult = { columns: string[]; rows: (string | null)[][] };

/** Practice data for SQL questions: the SQL that creates and fills its tables, run in the browser. */
export const sqlDatasets = pgTable("sql_datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  setupSql: text("setup_sql").notNull(),
  tables: jsonb("tables").$type<SqlTableInfo[]>().notNull().default([]),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** An automatically marked quiz at the end of a lesson. */
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }).unique(),
  passPercent: integer("pass_percent").notNull().default(70),
  /** Null means unlimited attempts. */
  maxAttempts: integer("max_attempts"),
  /** Null means no time limit. */
  timeLimitMinutes: integer("time_limit_minutes"),
  shuffle: boolean("shuffle").notNull().default(true),
  /** Students must pass before the lesson counts as complete; passing completes it. */
  requiredToComplete: boolean("required_to_complete").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  kind: text("kind").$type<QuestionKind>().notNull().default("single"),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  /** Indexes into options. */
  correct: jsonb("correct").$type<number[]>().notNull().default([]),
  explanation: text("explanation").notNull().default(""),
  position: integer("position").notNull().default(0),
  // SQL questions: the dataset to query, optional starter code, the instructor's answer and the result it gives.
  datasetId: integer("dataset_id").references(() => sqlDatasets.id, { onDelete: "restrict" }),
  starterSql: text("starter_sql").notNull().default(""),
  solutionSql: text("solution_sql").notNull().default(""),
  expected: jsonb("expected").$type<SqlResult | null>(),
  orderMatters: boolean("order_matters").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("quiz_questions_quiz_idx").on(t.quizId, t.position)]);

/** One try at a quiz. The question order is fixed when it starts, so shuffled quizzes mark consistently. */
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  questionOrder: jsonb("question_order").$type<number[]>().notNull().default([]),
  /** Chosen option indexes, keyed by question id. */
  answers: jsonb("answers").$type<Record<string, number[]>>().notNull().default({}),
  /** SQL questions: the query submitted, and whether its result matched, keyed by question id. */
  sqlAnswers: jsonb("sql_answers").$type<Record<string, string>>().notNull().default({}),
  sqlCorrect: jsonb("sql_correct").$type<Record<string, boolean>>().notNull().default({}),
  correctCount: integer("correct_count").notNull().default(0),
  total: integer("total").notNull().default(0),
  /** Percentage, 0–100; null until submitted. */
  score: integer("score"),
  passed: boolean("passed").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (t) => [index("quiz_attempts_enrollment_idx").on(t.enrollmentId, t.quizId)]);

/** Verifiable completion credentials. One certificate can be issued per enrolment. */
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }).unique(),
  code: text("code").notNull().unique(),
  issuedById: integer("issued_by_id").references(() => users.id, { onDelete: "set null" }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  percentOff: integer("percent_off").notNull(),
  active: boolean("active").notNull().default(true),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export type Certificate = typeof certificates.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  /** Our own reference, sent to the gateway and used to reconcile. */
  reference: text("reference").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cohortId: integer("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  gateway: text("gateway").$type<Gateway>().notNull(),
  providerId: text("provider_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").$type<PaymentStatus>().notNull().default("pending"),
  description: text("description").notNull().default(""),
  originalAmount: integer("original_amount"),
  paymentPlan: text("payment_plan").$type<PaymentPlan>().notNull().default("full"),
  /** The part of amount that is the registration fee rather than tuition. */
  registrationFee: integer("registration_fee").notNull().default(0),
  discountCodeId: integer("discount_code_id").references(() => discountCodes.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("payments_user_idx").on(t.userId)]);

export const attendance = pgTable("attendance", {
  sessionId: integer("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").$type<AttendanceStatus>().notNull(),
  markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.sessionId, t.userId] })]);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  /** Optional placement in the reusable course sequence; the assignment itself remains cohort-specific. */
  lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  attachmentUrl: text("attachment_url"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  maxScore: integer("max_score").notNull().default(100),
  published: boolean("published").notNull().default(true),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("assignments_cohort_idx").on(t.cohortId)]);

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull().default(""),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  linkUrl: text("link_url"),
  status: text("status").$type<SubmissionStatus>().notNull().default("submitted"),
  score: integer("score"),
  feedback: text("feedback").notNull().default(""),
  gradedById: integer("graded_by_id").references(() => users.id, { onDelete: "set null" }),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("submissions_assignment_user_idx").on(t.assignmentId, t.userId)]);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("announcements_cohort_idx").on(t.cohortId)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]);

/** Admin overrides of the built-in email templates in lib/email-templates.ts. */
export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailLog = pgTable("email_log", {
  id: serial("id").primaryKey(),
  to: text("to").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull().default(""),
  status: text("status").$type<"sent" | "failed" | "logged" | "skipped">().notNull(),
  error: text("error"),
  providerId: text("provider_id"),
  createdAt: createdAt(),
}, (t) => [index("email_log_created_idx").on(t.createdAt)]);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Cohort = typeof cohorts.$inferSelect;
export type LearningModule = typeof courseModules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type SqlDataset = typeof sqlDatasets.$inferSelect;
export type ModuleRelease = typeof moduleReleases.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CurriculumRequest = typeof curriculumRequests.$inferSelect;
