import type { Metadata } from "next";
import Link from "next/link";
import { register } from "@/app/actions/auth";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted">Enrol on cohorts, get class reminders and track your progress.</p>
      </div>
      <ActionForm action={register}>
        {next && <input type="hidden" name="next" value={next} />}
        <Input label="Full name" name="name" autoComplete="name" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </ActionForm>
      <p className="border-t border-line pt-5 text-sm text-muted">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-accent hover:text-accent-dark">Sign in</Link>
      </p>
    </>
  );
}
