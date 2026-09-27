import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, createDb, runMigrations } from "../src/db/client";
import { passwordProblem } from "../src/lib/password";
import { sessionSecretProblem } from "../src/lib/session";
import { announcements, assignments, classSessions, cohortInstructors, cohorts, courses, enrollments, settings, users } from "../src/db/schema";

/**
 * Idempotent seed:
 * - creates (or resets the password of) the admin from ADMIN_EMAIL / ADMIN_PASSWORD
 * - on the very first run only (no settings row yet), loads starter academy content
 * - locally only, adds a demo instructor and student so every role can be tried
 */
async function main() {
  if (process.env.VERCEL) {
    const problems = [
      sessionSecretProblem(),
      !process.env.ADMIN_EMAIL?.trim() && "ADMIN_EMAIL is not set.",
      !process.env.ADMIN_PASSWORD && "ADMIN_PASSWORD is not set.",
    ].filter(Boolean);
    if (problems.length) {
      throw new Error(`Missing Vercel environment variables:\n- ${problems.join("\n- ")}\nAdd them in Project Settings > Environment Variables, then redeploy.`);
    }
  }

  const db = await createDb();
  await runMigrations(db);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  let adminId: number | null = null;
  if (adminEmail && adminPassword) {
    const problem = passwordProblem(adminPassword, "ADMIN_PASSWORD");
    if (problem) throw new Error(problem);
    const hash = await bcrypt.hash(adminPassword, 12);
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing) {
      await db.update(users).set({ passwordHash: hash, role: "admin", active: true }).where(eq(users.id, existing.id));
      adminId = existing.id;
      console.log(`Updated admin ${adminEmail}.`);
    } else {
      const [row] = await db.insert(users).values({ name: process.env.ADMIN_NAME?.trim() || "Academy Admin", email: adminEmail, passwordHash: hash, role: "admin", emailVerifiedAt: new Date() }).returning();
      adminId = row.id;
      console.log(`Created admin ${adminEmail}.`);
    }
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin user created.");
  }

  const [existingSettings] = await db.select({ id: settings.id }).from(settings).where(eq(settings.id, 1));
  if (!existingSettings) {
    await seedContent(db, adminId);
    console.log("Loaded starter academy content.");
  }
  await closeDb(db);
}

type Db = Awaited<ReturnType<typeof createDb>>;

/** A date `days` from today at hh:mm London time, near enough for sample data. */
function at(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 1, minute, 0, 0);
  return d;
}
const isoDay = (days: number) => at(days, 12).toISOString().slice(0, 10);

async function seedContent(db: Db, adminId: number | null) {
  await db.insert(settings).values({
    id: 1,
    siteName: "Tekskillup Academy",
    tagline: "Practical tech training, taught live online and in person by people who do the work every day.",
    heroEyebrow: "Online & in-person cohorts",
    heroTitle: "Learn tech skills with real instructors, in class or online",
    heroSubtitle: "Join a cohort, attend live classes online or at our training space, submit real projects and get detailed feedback from instructors until you're job-ready.",
    supportEmail: "hello@tekskillup.com",
    phone: "",
    address: "",
    timezone: "Europe/London",
    currencies: ["GBP", "NGN", "USD"],
    stats: [
      { value: "1,200+", label: "Students trained" },
      { value: "92%", label: "Complete their cohort" },
      { value: "3", label: "Learning formats" },
      { value: "4.8/5", label: "Average rating" },
    ],
    testimonials: [
      { quote: "The weekend labs made all the difference. I built three dashboards I now show in interviews.", name: "Adaeze Okafor", role: "Data Analyst" },
      { quote: "Classes online during the week fitted around my job, and the feedback on every assignment was detailed and honest.", name: "Tom Richards", role: "BI Developer" },
      { quote: "Reminders before every class meant I never missed a session. The instructors genuinely cared.", name: "Kemi Adeyemi", role: "Junior Data Engineer" },
    ],
    faqs: [
      { question: "What's the difference between online, in-person and hybrid?", answer: "Online classes are live on Zoom or Google Meet. In-person classes are at our training space. Hybrid cohorts mix both on a fixed timetable, and every class clearly shows which it is." },
      { question: "How do I pay?", answer: "Pay by card through Stripe in pounds, dollars or euros, or through Paystack in naira, cedi, shillings or rand (card, bank transfer or USSD). You'll get an email receipt straight away." },
      { question: "Will I get reminders?", answer: "Yes. We email you the day before and about an hour before each class, plus a reminder before assignment deadlines. You can turn reminder emails off in your account." },
      { question: "How are assignments marked?", answer: "Submit a file, a link or a written answer from your dashboard. Your instructor scores it and writes feedback, or asks for changes if something needs another pass." },
      { question: "What if I miss a class?", answer: "Online classes are recorded where possible, and all materials stay in your dashboard. Let your instructor know and they'll help you catch up." },
    ],
  });

  const rows = await db.insert(courses).values([
    {
      slug: "data-analytics-power-bi",
      title: "Data Analytics with Power BI",
      summary: "Go from spreadsheets to interactive dashboards: clean data, model it properly and tell clear stories with Power BI.",
      category: "Data",
      level: "Beginner",
      durationWeeks: 8,
      featured: true,
      published: true,
      sortOrder: 1,
      outcomes: ["Clean and shape data with Power Query", "Build star-schema data models", "Write DAX measures with confidence", "Design dashboards people actually use", "Publish and share reports securely"],
      description: "## Who this course is for\n\nAnyone who works with spreadsheets and wants to move into analytics. No coding experience is needed.\n\n## How it runs\n\nWeekday evening classes are **live online**, and alternate Saturdays are **hands-on labs in person**. Every week ends with a practical assignment reviewed by your instructor.\n\n## What you'll build\n\n- A sales performance dashboard\n- A customer churn report with drill-through\n- A capstone project using a dataset of your choice",
    },
    {
      slug: "sql-for-data-analysis",
      title: "SQL for Data Analysis",
      summary: "Query, join and aggregate real business data with SQL, from your first SELECT to window functions.",
      category: "Data",
      level: "Beginner",
      durationWeeks: 6,
      featured: true,
      published: true,
      sortOrder: 2,
      outcomes: ["Write SELECT queries with filters and sorting", "Join tables correctly", "Aggregate with GROUP BY and HAVING", "Use CTEs and window functions", "Answer business questions with data"],
      description: "## Learn by doing\n\nEvery class is **live online** with exercises on a real PostgreSQL database. You'll finish with a portfolio of analysis queries and a final project.",
    },
    {
      slug: "data-engineering-foundations",
      title: "Data Engineering Foundations",
      summary: "Design and build reliable data pipelines with Python, SQL, dbt and cloud warehouses.",
      category: "Engineering",
      level: "Intermediate",
      durationWeeks: 12,
      featured: true,
      published: true,
      sortOrder: 3,
      outcomes: ["Build ETL/ELT pipelines in Python", "Model data with dbt", "Orchestrate jobs and handle failures", "Work with cloud data warehouses", "Apply testing and data quality checks"],
      description: "## A practitioner-led course\n\nTaught **in person** in small groups, with lab machines available. Ideal if you already know some SQL and want to build production-grade pipelines.",
    },
  ]).returning();
  const [powerBi, sql, engineering] = rows;

  const [pbiOct, sqlOnline, deCohort] = await db.insert(cohorts).values([
    { courseId: powerBi.id, name: "Autumn cohort", startDate: isoDay(-7), endDate: isoDay(49), deliveryMode: "hybrid", venue: "Lab 2, Innovation Hub, 12 High Street", schedule: "Tue & Thu 6–8pm online · alternate Saturdays 10am–1pm in person", capacity: 24, prices: { GBP: 49900, NGN: 35000000, USD: 62900 } },
    { courseId: sql.id, name: "Evening cohort", startDate: isoDay(10), endDate: isoDay(52), deliveryMode: "virtual", schedule: "Mon & Wed 7–9pm, live online", capacity: 30, prices: { GBP: 29900, NGN: 20000000, USD: 37900 } },
    { courseId: engineering.id, name: "Weekend cohort", startDate: isoDay(21), endDate: isoDay(105), deliveryMode: "physical", venue: "Lab 2, Innovation Hub, 12 High Street", schedule: "Saturdays 10am–4pm in person", capacity: 16, prices: { GBP: 89900, NGN: 65000000 } },
  ]).returning();
  await db.insert(cohorts).values({ courseId: powerBi.id, name: "Winter cohort", startDate: isoDay(70), endDate: isoDay(126), deliveryMode: "virtual", schedule: "Tue & Thu 6–8pm online", capacity: 30, prices: { GBP: 44900, NGN: 32000000, USD: 56900 } });

  const meet = "https://meet.google.com/abc-defg-hij";
  await db.insert(classSessions).values([
    { cohortId: pbiOct.id, title: "Week 1: Welcome & Power BI tour", mode: "virtual", startsAt: at(-6, 18), endsAt: at(-6, 20), meetingUrl: meet, recordingUrl: "https://example.com/recording-week-1" },
    { cohortId: pbiOct.id, title: "Lab: Getting data in with Power Query", mode: "physical", venue: "Lab 2, Innovation Hub, 12 High Street", startsAt: at(-2, 10), endsAt: at(-2, 13) },
    { cohortId: pbiOct.id, title: "Week 2: Data modelling basics", mode: "virtual", startsAt: at(1, 18), endsAt: at(1, 20), meetingUrl: meet, description: "Bring the dataset from the lab." },
    { cohortId: pbiOct.id, title: "Week 2: DAX fundamentals", mode: "virtual", startsAt: at(3, 18), endsAt: at(3, 20), meetingUrl: meet },
    { cohortId: pbiOct.id, title: "Lab: Dashboard design clinic", mode: "physical", venue: "Lab 2, Innovation Hub, 12 High Street", startsAt: at(5, 10), endsAt: at(5, 13), description: "Laptops available, or bring your own with Power BI Desktop installed." },
    { cohortId: sqlOnline.id, title: "Week 1: SELECT, WHERE and ORDER BY", mode: "virtual", startsAt: at(10, 19), endsAt: at(10, 21), meetingUrl: meet },
    { cohortId: sqlOnline.id, title: "Week 1: Joins", mode: "virtual", startsAt: at(12, 19), endsAt: at(12, 21), meetingUrl: meet },
    { cohortId: deCohort.id, title: "Day 1: Pipelines and the modern data stack", mode: "physical", venue: "Lab 2, Innovation Hub, 12 High Street", startsAt: at(21, 10), endsAt: at(21, 16) },
  ]);

  const [brief] = await db.insert(assignments).values([
    { cohortId: pbiOct.id, title: "Clean the sales dataset", instructions: "Using the **sales.xlsx** file from the lab:\n\n1. Load it with Power Query\n2. Fix data types and remove duplicates\n3. Split the customer name column\n\nSubmit your `.pbix` file or a screenshot of your applied steps, plus a short note on anything you found tricky.", dueAt: at(2, 23, 59), maxScore: 100, createdById: adminId },
    { cohortId: pbiOct.id, title: "Model the sales data as a star schema", instructions: "Create fact and dimension tables and relate them. Share a screenshot of the model view and explain your choices in a few sentences.", dueAt: at(9, 23, 59), maxScore: 100, createdById: adminId },
  ]).returning();
  void brief;

  await db.insert(announcements).values({ cohortId: pbiOct.id, authorId: adminId, title: "Welcome to the autumn cohort!", body: "Great to meet everyone in week 1. Please install **Power BI Desktop** before Saturday's lab. The recording of week 1 is under Past classes." });

  // Demo accounts so each role can be explored locally. Never created on Vercel.
  if (!process.env.VERCEL) {
    const hash = await bcrypt.hash("demo-password-123", 12);
    const [instructor, student] = await db.insert(users).values([
      { name: "Grace Bello", email: "instructor@example.com", passwordHash: hash, role: "instructor", emailVerifiedAt: new Date(), bio: "Power BI developer with 8 years' experience building reporting for retail and fintech teams." },
      { name: "Ada Obi", email: "student@example.com", passwordHash: hash, role: "student", emailVerifiedAt: new Date() },
    ]).onConflictDoNothing().returning();
    if (instructor && student) {
      await db.insert(cohortInstructors).values([{ cohortId: pbiOct.id, userId: instructor.id }, { cohortId: sqlOnline.id, userId: instructor.id }]);
      await db.insert(enrollments).values({ userId: student.id, cohortId: pbiOct.id, status: "active", source: "manual", activatedAt: new Date() });
      console.log("Demo accounts: instructor@example.com and student@example.com (password: demo-password-123)");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
