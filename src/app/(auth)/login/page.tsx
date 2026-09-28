import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; denied?: string }> }) {
  const { next, denied } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted">Sign in to your classes, assignments and feedback.</p>
      </div>
      {denied && <Notice tone="amber">Your account doesn&apos;t have access to that page. Sign in with a different account, or go to your dashboard.</Notice>}
      <ActionForm action={login}>
        {next && <input type="hidden" name="next" value={next} />}
        <Input label="Email" name="email" type="email" autoComplete="username" required />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        <div className="flex items-center justify-between gap-4">
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:text-accent-dark">Forgot password?</Link>
        </div>
      </ActionForm>
      <p className="border-t border-line pt-5 text-sm text-muted">
        New here? Student accounts are created when you enrol. <Link href="/enroll" className="font-semibold text-accent hover:text-accent-dark">Enrol on a course</Link>
      </p>
    </>
  );
}
