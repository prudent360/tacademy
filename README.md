# Tekskillup Academy

An online academy for cohort-based courses that mix **live online** and **in-person** classes, with assignments, instructor feedback, branded emails, Stripe, Paystack and pawaPay (mobile money) payments, and automatic reminders.

Built with Next.js 16 (App Router), Tailwind CSS v4 and Drizzle ORM on Postgres (Neon in production, embedded PGlite locally). Designed to deploy on Vercel.

## Roles

| Role | Can |
|---|---|
| **Student** | Sign up, enrol and pay, see their timetable (joining links, venues, add to calendar), submit assignments, read feedback, get notifications and receipts |
| **Instructor** | For cohorts they're assigned to: schedule classes (with weekly repeats), take attendance, add recordings, set assignments, grade or request changes, post announcements |
| **Admin** | Everything above for every cohort, plus courses, cohorts and prices, people and invitations, payments (including offline ones), email templates and site settings |

## Run locally

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev                  # migrates and seeds, then starts http://localhost:3001
```

The first run loads sample courses, cohorts and classes, plus two demo accounts (local only):

- `instructor@example.com` / `demo-password-123`
- `student@example.com` / `demo-password-123`

Without payment keys, checkout goes to a **simulated test page** (local development only). Without `RESEND_API_KEY`, emails are not sent; they're recorded under **Admin → Email templates → Recent emails**, where you can open them and click their links.

## How payments work

Each cohort has a price per currency. Students choose the country they live in when they enrol, which sets the currency they pay in (their local one when the cohort is priced in it, otherwise USD) and the payment options shown; they can still switch currency. Currencies map to gateways:

- **GBP, USD, EUR, CAD** → Stripe Checkout
- **NGN, GHS, KES, ZAR** → Paystack
- **UGX, TZS, RWF, XOF, XAF** → pawaPay mobile money. NGN, GHS and KES students can also choose **Mobile money** instead of Paystack. XOF and XAF students pick the country their wallet is in. Mobile money amounts are charged in whole units.

The student's place is confirmed by the gateway's **webhook** (and double-checked when they return to the site), then they get an enrolment email and a receipt. Turn on **bank transfer** in Settings → Payments to let students pay by transfer: they get your account details and a reference, and you click **Confirm** under Payments when the money arrives. Cash and other offline payments can be recorded with **Payments → Record payment**. Switch any gateway off, or between test and live mode, in Settings → Payments. Leave every price empty to make a cohort free.

## Reminders

`/api/cron/reminders` sends, at most once each:

- a class reminder the day before, and another about an hour before
- a deadline reminder about 24 hours before an assignment is due (only to students who haven't submitted)

Vercel Cron calls it daily (`vercel.json`). The Hobby plan only allows daily crons, so `.github/workflows/reminders.yml` also calls it every 15 minutes for the one-hour reminders. Add the repository secrets `SITE_URL` and `CRON_SECRET` to enable it.

## Self-paced video lessons

Courses have modules and lessons that every cohort shares. Admins build them from the course page; instructors can add modules and lessons, publish modules and edit lessons for courses they teach from **Teach → cohort → Learning** (deleting stays with admins). Paste a Bunny Stream, YouTube, Vimeo or Loom link into a lesson's **Video link** and it plays inside the lesson. For Bunny Stream, add the library's token authentication key in **Settings → Video** to sign video links so they expire after six hours, then turn on embed token authentication in Bunny.

## XP and levels

Students earn XP for what they do: 10 per lesson completed, 20 per class attended (10 if late), 25 per assignment submitted (+10 on time), up to 50 more by grade, 200 per course or internship completed and 100 per certificate. XP is calculated from those records (`src/lib/xp.ts`), so past activity counts and corrections to attendance or grades adjust it. Students see their level in the top bar, an XP panel on their dashboard and a leaderboard on each cohort page.

## AI assistant

Optional features powered by OpenAI or Anthropic (Claude), chosen and connected in **Settings → AI** with that provider's API key (or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`): a public course advisor, a study buddy on each lesson, a grading assistant for instructors, and "Draft with AI" for course copy, announcements and email templates. People review every draft before it is saved or sent. Requests are capped per person per hour; set a monthly spending limit in your provider's dashboard too.

## SEO

**Settings → SEO** controls the home page title and description, the title pattern for other pages, page descriptions, the social share image, the X handle, Google and Bing verification codes, social profile links (added to the organisation's structured data) and a switch that hides the whole site from search engines. Each course can override its search title and description under "Search engines"; its cover image is used when it's shared. The sitemap is at `/sitemap.xml`.

## Deploy to Vercel

1. Push this folder to a new GitHub repository and import it in Vercel.
2. **Storage:** connect a **Neon** Postgres database (sets `DATABASE_URL`) and a **Blob** store (for uploads).
3. **Environment variables** (Production):
   - `SESSION_SECRET`: run `openssl rand -base64 32`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters), `ADMIN_NAME`
   - `NEXT_PUBLIC_SITE_URL`: your domain, e.g. `https://academy.example.com`
   - `CRON_SECRET`: any long random string
   - Payment and email keys can be entered later in **Admin → Settings → Payments / Email** (stored encrypted). The environment variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `PAWAPAY_API_TOKEN`, `RESEND_API_KEY` and `EMAIL_FROM` still work as a fallback.
4. **Webhooks:**
   - Stripe → Developers → Webhooks: endpoint `https://YOUR-DOMAIN/api/webhooks/stripe`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Paystack → Settings → API Keys & Webhooks: webhook URL `https://YOUR-DOMAIN/api/webhooks/paystack`.
   - pawaPay → System configuration → Callback URLs: deposit callback `https://YOUR-DOMAIN/api/webhooks/pawapay`. The callback only triggers a status check against pawaPay's API, so signed callbacks are optional.
5. Deploy. The build runs migrations and the seed (`vercel-build`), which creates your admin account. Sample courses are loaded only on the first deploy, and you can edit or delete them.
6. Sign in, open **Settings** to set your branding, contact details, timezone and currencies, then invite instructors under **People**.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Seed/migrate, then start the dev server |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run admin:reset -- you@example.com "new password"` | Reset an admin password |
| `npm run lint` / `npm run typecheck` | Checks |
