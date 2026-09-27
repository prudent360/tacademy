import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/site/policy-page";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Cookie Policy", description: "How the academy website uses cookies and similar technologies." };

export default async function CookiesPage() {
  const settings = await getSettings();
  const sections: PolicySection[] = [
    { id: "what", title: "What cookies are", content: <p>Cookies are small text files stored by your browser. Similar technologies can remember a session or device without storing a traditional cookie.</p> },
    { id: "essential", title: "Essential cookies", content: <><p>We use essential cookies to keep you signed in, protect forms, maintain security and remember choices required for the service to work. These cannot be switched off through a consent tool because the platform would not function correctly without them.</p></> },
    { id: "other", title: "Analytics and optional cookies", content: <p>If we introduce analytics, advertising or other optional cookies, we will request consent where required and update this page with their purpose, provider and duration. We do not currently rely on optional advertising cookies to deliver the academy platform.</p> },
    { id: "third-parties", title: "Third-party services", content: <p>Payment, video-conferencing or embedded services may set cookies when you interact with them. Their own privacy and cookie policies govern those technologies.</p> },
    { id: "control", title: "How to control cookies", content: <p>You can delete or block cookies in your browser settings. Blocking essential cookies may prevent sign-in, enrolment, checkout or other secure features from working.</p> },
    { id: "changes", title: "Changes and contact", content: <p>We may update this policy when our technology changes. Questions can be sent to <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail || "our support team"}</a>.</p> },
  ];
  return <PolicyPage eyebrow="Privacy & data" title="Cookie Policy" summary="What cookies the academy platform uses, why they are needed and how you can control them." updated="27 September 2026" sections={sections} settings={settings} />;
}
