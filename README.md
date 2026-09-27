# Tekskillup Academy

An online academy for cohort-based courses that mix **live online** and **in-person** classes, with assignments, instructor feedback, branded emails, Stripe and Paystack payments, and automatic reminders.

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

Each cohort has a price per currency. The student picks a currency at checkout:

- **GBP, USD, EUR, CAD** → Stripe Checkout
- **NGN, GHS, KES, ZAR** → Paystack

The student's place is confirmed by the gateway's **webhook** (and double-checked when they return to the site), then they get an enrolment email and a receipt. Turn on **bank transfer** in Settings → Payments to let students pay by transfer: they get your account details and a reference, and you click **Confirm** under Payments when the money arrives. Cash and other offline payments can be recorded with **Payments → Record payment**. Switch either gateway off, or between test and live mode, in Settings → Payments. Leave every price empty to make a cohort free.

## Reminders

`/api/cron/reminders` sends, at most once each:

- a class reminder the day before, and another about an hour before
- a deadline reminder about 24 hours before an assignment is due (only to students who haven't submitted)

Vercel Cron calls it daily (`vercel.json`). The Hobby plan only allows daily crons, so `.github/workflows/reminders.yml` also calls it every 15 minutes for the one-hour reminders. Add the repository secrets `SITE_URL` and `CRON_SECRET` to enable it.

## Deploy to Vercel

1. Push this folder to a new GitHub repository and import it in Vercel.
2. **Storage:** connect a **Neon** Postgres database (sets `DATABASE_URL`) and a **Blob** store (for uploads).
3. **Environment variables** (Production):
   - `SESSION_SECRET`: run `openssl rand -base64 32`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters), `ADMIN_NAME`
   - `NEXT_PUBLIC_SITE_URL`: your domain, e.g. `https://academy.example.com`
   - `CRON_SECRET`: any long random string
   - Payment and email keys can be entered later in **Admin → Settings → Payments / Email** (stored encrypted). The environment variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY` and `EMAIL_FROM` still work as a fallback.
4. **Webhooks:**
   - Stripe → Developers → Webhooks: endpoint `https://YOUR-DOMAIN/api/webhooks/stripe`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Paystack → Settings → API Keys & Webhooks: webhook URL `https://YOUR-DOMAIN/api/webhooks/paystack`.
5. Deploy. The build runs migrations and the seed (`vercel-build`), which creates your admin account. Sample courses are loaded only on the first deploy, and you can edit or delete them.
6. Sign in, open **Settings** to set your branding, contact details, timezone and currencies, then invite instructors under **People**.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Seed/migrate, then start the dev server |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run admin:reset -- you@example.com "new password"` | Reset an admin password |
| `npm run lint` / `npm run typecheck` | Checks |
