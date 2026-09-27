import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/site/policy-page";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Refund Policy", description: "Refund, cancellation and cohort transfer rules for academy courses." };

export default async function RefundPolicyPage() {
  const settings = await getSettings();
  const email = settings.supportEmail || "our support team";
  const sections: PolicySection[] = [
    { id: "overview", title: "Overview", content: <p>This policy explains when course fees may be refunded, credited or transferred. It does not limit any cancellation or refund right that applicable consumer law gives you.</p> },
    { id: "cooling-off", title: "Cooling-off period", content: <><p>If you are a UK consumer who buys online, you may cancel within 14 days of purchase. If you ask us to begin providing classes or digital materials during that period, we may deduct a fair amount for what has already been supplied.</p><p>The right may end once digital content has been fully supplied after your express consent and acknowledgement.</p></> },
    { id: "before-start", title: "Cancellation before a cohort starts", content: <p>Contact us as soon as possible. Outside a statutory cooling-off period, requests received at least 14 days before the cohort starts are normally eligible for a refund less any clearly disclosed, non-recoverable payment-processing charges.</p> },
    { id: "after-start", title: "After teaching has started", content: <p>Course fees are generally non-refundable after the cohort begins, except where the course is materially not as described, we cannot deliver it, or consumer law requires otherwise. We will still consider exceptional circumstances fairly.</p> },
    { id: "transfers", title: "Transfers and account credit", content: <p>Where a refund is unavailable, we may offer a transfer to a later cohort or account credit. Transfers depend on capacity and should normally be requested before the original cohort starts.</p> },
    { id: "our-cancellations", title: "If we cancel or reschedule", content: <p>If we cancel a course and cannot offer a suitable alternative, we will refund the course fees paid. For a material schedule change, you may choose the revised cohort, a reasonable alternative or a refund for the undelivered part.</p> },
    { id: "how-to-request", title: "How to request a refund", content: <p>Email <a href={`mailto:${email}`}>{email}</a> with your account email, course, cohort, payment reference and reason for the request. Do not send full card or bank security details.</p> },
    { id: "timing", title: "Review and payment timing", content: <p>We aim to acknowledge requests within five working days. Approved refunds are returned to the original payment method where possible. Banks and payment providers may take additional time to display the funds.</p> },
  ];
  return <PolicyPage eyebrow="Payments" title="Refund Policy" summary="When you can cancel, move to another cohort, receive credit or request a refund for academy fees." updated="27 September 2026" sections={sections} settings={settings} />;
}
