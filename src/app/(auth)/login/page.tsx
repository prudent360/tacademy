import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { EmailField, PasswordField } from "@/components/auth/fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; denied?: string }> }) {
  const { next, denied } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.6px] text-ink">Sign in to your account</h1>
        <p className="text-[15px] text-muted">Welcome back! Pick up your classes, lessons and feedback.</p>
      </div>
      {denied && <Notice tone="amber">Your account doesn&apos;t have access to that page. Sign in with a different account, or go to your dashboard.</Notice>}
      <ActionForm action={login}>
        {next && <input type="hidden" name="next" value={next} />}
        <EmailField />
        <PasswordField />
        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
            <input type="checkbox" name="remember" defaultChecked className="size-4 accent-accent" /> Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:text-accent-dark">Forgot password?</Link>
        </div>
        <SubmitButton pendingText="Signing in…" block>Sign in</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="whitespace-nowrap font-semibold text-accent hover:text-accent-dark">Create an account</Link>
      </p>
    </>
  );
}
