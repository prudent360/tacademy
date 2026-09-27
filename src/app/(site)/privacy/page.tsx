import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/site/policy-page";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Privacy Policy", description: "How the academy collects, uses and protects personal information." };

export default async function PrivacyPage() {
  const settings = await getSettings();
  const email = settings.supportEmail || "our support team";
  const sections: PolicySection[] = [
    { id: "who-we-are", title: "Who we are", content: <p>{settings.siteName} is responsible for the personal information described in this policy. You can contact us at <a href={`mailto:${email}`}>{email}</a>{settings.address ? ` or at ${settings.address}` : ""}.</p> },
    { id: "data-we-collect", title: "Information we collect", content: <><p>We collect information you provide, including your name, email, phone number, account details, course choices, assignments, messages and support requests.</p><p>We also receive payment status and transaction references from payment providers. We do not store full card details. Technical information may include device, browser, IP address, sign-in activity and essential cookie data.</p></> },
    { id: "how-we-use", title: "How we use information", content: <ul><li>Create and secure your account.</li><li>Process enrolment and payments.</li><li>Deliver classes, assignments, feedback, certificates and reminders.</li><li>Provide support and communicate important service changes.</li><li>Prevent fraud, maintain security and meet legal obligations.</li><li>Improve courses and the learning experience using aggregated insights.</li></ul> },
    { id: "legal-bases", title: "Our legal bases", content: <><p>We process information where necessary to perform our contract with you, comply with law, pursue legitimate interests such as security and service improvement, or where you have given consent.</p><p>You may withdraw consent at any time, although this does not affect earlier lawful processing.</p></> },
    { id: "sharing", title: "Who we share data with", content: <><p>We use trusted service providers for hosting, email, file storage, analytics and payment processing. Instructors receive only the information needed to teach and assess their cohorts.</p><p>We may disclose information if legally required, to protect rights and safety, or as part of a business reorganisation. We do not sell personal information.</p></> },
    { id: "recordings", title: "Classes, recordings and submitted work", content: <><p>Class recordings may contain display names, voices, chat messages or contributions. Recordings are shared only with authorised learners and staff unless we obtain further permission.</p><p>Assignments and feedback are stored so you can track progress and instructors can assess your work.</p></> },
    { id: "international", title: "International transfers", content: <p>Some providers may process information outside the UK. Where required, we use recognised safeguards such as adequacy regulations or approved contractual clauses.</p> },
    { id: "retention", title: "How long we keep information", content: <><p>We keep account and learning records while your account is active and for a reasonable period afterwards. Payment records may be retained longer to meet tax, accounting and dispute requirements.</p><p>We delete or anonymise information when it is no longer needed, unless law requires continued retention.</p></> },
    { id: "rights", title: "Your privacy rights", content: <><p>Depending on your location, you may ask to access, correct, erase, restrict or transfer your personal information, or object to certain processing.</p><p>Email <a href={`mailto:${email}`}>{email}</a> to make a request. We may need to verify your identity. You may also complain to the UK Information Commissioner’s Office or your local regulator.</p></> },
    { id: "security", title: "Security", content: <p>We use access controls, password hashing, signed sessions and other reasonable organisational and technical measures. No internet service is completely secure, so please use a unique password and notify us of suspicious activity.</p> },
    { id: "updates", title: "Changes to this policy", content: <p>We may update this policy as our services or legal obligations change. We will post the revised version here and highlight material changes where appropriate.</p> },
  ];
  return <PolicyPage eyebrow="Privacy & data" title="Privacy Policy" summary="A clear explanation of what information we collect, why we use it, who receives it and the choices available to you." updated="27 September 2026" sections={sections} settings={settings} />;
}
