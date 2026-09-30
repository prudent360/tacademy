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
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">Welcome back</h1>
        <p className="text-[15px] text-muted">Sign in to your classes, assignments and feedback.</p>
      </div>
      {denied && <Notice tone="amber">Your account doesn&apos;t have access to that page. Sign in with a different account, or go to your dashboard.</Notice>}
      <ActionForm action={login}>
        {next && <input type="hidden" name="next" value={next} />}
        <Input label="Email address" name="email" type="email" autoComplete="username" placeholder="you@example.com" required />
        <div className="flex flex-col gap-2">
          <Input label="Password" name="password" type="password" autoComplete="current-password" required />
          <Link href="/forgot-password" className="self-end text-sm font-semibold text-accent hover:text-accent-dark">Forgot password?</Link>
        </div>
        <SubmitButton pendingText="Signing in…" block>Sign in</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm text-muted">
        New here? Accounts are created when you enrol.{" "}
        <Link href="/enroll" className="whitespace-nowrap font-semibold text-accent hover:text-accent-dark">Enrol on a course</Link>
      </p>
    </>
  );
}
