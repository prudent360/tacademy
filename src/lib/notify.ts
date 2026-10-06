import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, users, type User } from "@/db/schema";
import { sendEmails, type OutgoingEmail, type Vars } from "./email";
import type { TemplateKey } from "./email-templates";
import { firstName } from "./utils";
import { sendWhatsApp, whatsappNumber } from "./whatsapp";
import type { WhatsAppTemplate } from "./whatsapp-templates";

type NotifyOptions = {
  kind: string;
  title: string;
  body?: string;
  href?: string;
  email?: {
    template: TemplateKey;
    /** Extra variables, optionally per recipient. `name` is filled in automatically. */
    vars: Vars | ((user: User) => Vars);
    /** Reminders respect the "email me reminders" preference; transactional emails always send. */
    isReminder?: boolean;
  };
  /** Also sent on WhatsApp to people who opted in, when WhatsApp is set up. `params` fill the template's {{1}}, {{2}}… */
  whatsapp?: {
    template: WhatsAppTemplate;
    params: (user: User) => string[];
  };
};

/** Creates an in-app notification for each user and, optionally, emails them and sends a WhatsApp message. */
export async function notify(userIds: number[], options: NotifyOptions): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const db = await getDb();
  const recipients = (await db.select().from(users).where(inArray(users.id, ids))).filter((u) => u.active);
  if (!recipients.length) return;

  await db.insert(notifications).values(
    recipients.map((u) => ({ userId: u.id, kind: options.kind, title: options.title, body: options.body ?? "", href: options.href ?? null })),
  );

  const whatsapp = options.whatsapp;
  if (whatsapp) {
    await sendWhatsApp(recipients.flatMap((u) => {
      const to = u.whatsappOptIn ? whatsappNumber(u.phone) : null;
      return to ? [{ to, template: whatsapp.template, params: whatsapp.params(u) }] : [];
    }));
  }

  const email = options.email;
  if (!email) return;
  const outgoing: OutgoingEmail[] = recipients
    .filter((u) => !email.isReminder || u.emailReminders)
    .map((u) => ({
      to: u.email,
      template: email.template,
      vars: { name: firstName(u.name), ...(typeof email.vars === "function" ? email.vars(u) : email.vars) },
    }));
  await sendEmails(outgoing);
}
