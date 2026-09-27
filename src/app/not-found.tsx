import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-mono text-sm uppercase tracking-[1.5px] text-accent">404</p>
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="max-w-[420px] text-lg text-muted">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
      <div className="mt-2 flex gap-3">
        <Link href="/" className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Go home</Link>
        <Link href="/courses" className="flex h-12 items-center rounded-lg border border-edge-strong bg-white px-6 font-semibold text-ink hover:bg-page">Browse courses</Link>
      </div>
    </div>
  );
}
