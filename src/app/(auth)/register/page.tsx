import type { Metadata } from "next";
import Link from "next/link";
import { register } from "@/app/actions/auth";
import { EmailField, NameField, PasswordField, ProfileFields } from "@/components/auth/fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { visitorCountry } from "@/lib/visitor";

export const metadata: Metadata = { title: "Create an account", description: "Create a free account to save your progress and enrol on courses whenever you're ready." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, country] = await Promise.all([searchParams, visitorCountry()]);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.6px] text-ink">Create your account</h1>
        <p className="text-[15px] text-muted">It&apos;s free. Explore courses, enrol when you&apos;re ready and keep track of your learning in one place.</p>
      </div>
      <ActionForm action={register}>
        {next && <input type="hidden" name="next" value={next} />}
        {/* Left empty by people; bots fill it in. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NameField label="First name" name="firstName" autoComplete="given-name" placeholder="First name" />
          <NameField label="Last name" name="lastName" autoComplete="family-name" placeholder="Last name" />
        </div>
        <EmailField autoComplete="email" />
        <ProfileFields defaultCountry={country ?? undefined} />
        <PasswordField autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
        <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4 shrink-0 accent-accent" />
          <span>I agree to the <Link href="/terms" target="_blank" className="font-semibold text-accent hover:text-accent-dark">terms</Link> and <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:text-accent-dark">privacy policy</Link>.</span>
        </label>
        <SubmitButton pendingText="Creating your account…" block>Create account</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-accent hover:text-accent-dark">Sign in</Link>
      </p>
    </>
  );
}
