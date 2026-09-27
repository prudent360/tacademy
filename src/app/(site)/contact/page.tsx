import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarIcon, MailIcon, MessageIcon, PinIcon } from "@/components/icons";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Contact Us", description: "Contact the academy about courses, enrolment, payments or student support." };

export default async function ContactPage() {
  const settings = await getSettings();
  const email = settings.supportEmail || "hello@tekskillup.com";
  const topics = [
    { icon: CalendarIcon, title: "Courses & enrolment", text: "Choosing a course, cohort dates, formats or entry requirements.", subject: "Course and enrolment question" },
    { icon: MessageIcon, title: "Student support", text: "Your account, class access, assignments, feedback or certificates.", subject: "Student support request" },
    { icon: MailIcon, title: "Payments & refunds", text: "Receipts, payment status, transfers, instalments or refund requests.", subject: "Payment or refund question" },
  ];
  return (
    <>
      <section className="border-b border-line bg-[linear-gradient(145deg,#f7f6fb,#fff_55%,#eefaff)]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 text-center sm:px-8 md:py-24">
          <p className="font-mono text-xs font-semibold uppercase tracking-[1.5px] text-accent">Contact us</p>
          <h1 className="mx-auto mt-4 max-w-[760px] font-display text-4xl font-extrabold tracking-[-1.5px] text-ink sm:text-5xl md:text-[58px]">How can we help?</h1>
          <p className="mx-auto mt-5 max-w-[660px] text-lg leading-8 text-muted">Tell us what you need and we’ll point you in the right direction. We aim to reply within two working days.</p>
        </div>
      </section>
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 md:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {topics.map(({ icon: Icon, title, text, subject }) => (
            <a key={title} href={`mailto:${email}?subject=${encodeURIComponent(subject)}`} className="group flex flex-col rounded-[20px] border border-edge bg-white p-6 transition hover:-translate-y-1 hover:border-accent-muted hover:shadow-[0_18px_45px_-24px_rgba(25,17,46,.35)]">
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="size-6" /></span>
              <h2 className="mt-5 font-display text-xl font-bold text-ink">{title}</h2><p className="mt-2 grow text-[15px] leading-6 text-muted">{text}</p><span className="mt-5 flex items-center gap-2 text-sm font-semibold text-accent">Email the team <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
            </a>
          ))}
        </div>
        <div className="mt-12 grid gap-8 rounded-[24px] bg-navy p-7 text-white md:grid-cols-[1.1fr_.9fr] md:p-10">
          <div><p className="font-display text-2xl font-bold">General enquiries</p><p className="mt-3 max-w-lg leading-7 text-white/70">Include your account email, course and cohort where relevant. Please never send passwords or full payment-card details.</p><a href={`mailto:${email}`} className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-accent hover:bg-accent-soft"><MailIcon className="size-5" /> {email}</a></div>
          <div className="space-y-5 border-white/15 md:border-l md:pl-8">
            {settings.phone && <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-light">Phone</p><p className="mt-1 text-white/85">{settings.phone}</p></div>}
            {settings.address && <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-light">Training location</p><p className="mt-1 flex gap-2 text-white/85"><PinIcon className="mt-1 size-4 shrink-0" />{settings.address}</p></div>}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-light">Useful links</p><div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold"><Link href="/#faq">FAQs</Link><Link href="/refund-policy">Refunds</Link><Link href="/privacy">Privacy</Link></div></div>
          </div>
        </div>
      </section>
    </>
  );
}
