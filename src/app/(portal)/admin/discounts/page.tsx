import type { Metadata } from "next";
import { desc, isNull } from "drizzle-orm";
import { createDiscountCode, deleteDiscountCode, setDiscountCodeActive, updateDiscountCode } from "@/app/actions/admin";
import { ActionButton, ActionForm, DeleteButton, Input, ModalButton, SubmitButton } from "@/components/forms";
import { CardIcon } from "@/components/icons";
import { Card, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { formatDateTime, toZonedInput } from "@/lib/time";
import { getSettings } from "@/lib/data";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Discount codes" };

export default async function DiscountsPage() {
  await requirePermission("discounts.manage");
  const { timezone } = await getSettings();
  const rows = await (await getDb()).select().from(discountCodes).where(isNull(discountCodes.deletedAt)).orderBy(desc(discountCodes.createdAt));
  return <>
    <PageHeader title="Discount codes" description="Create controlled promotions for online enrolment. Expiry and usage limits are enforced at checkout." />
    <Card title="Create a code">
      <ActionForm action={createDiscountCode} resetOnSuccess className="grid items-end gap-4 md:grid-cols-4">
        <Input label="Code" name="code" placeholder="WELCOME20" required />
        <Input label="Percentage off" name="percentOff" type="number" min="1" max="100" required />
        <Input label="Maximum uses" name="maxUses" type="number" min="1" placeholder="Unlimited" />
        <Input label="Expires" name="expiresAt" type="datetime-local" />
        <div className="md:col-span-4"><SubmitButton pendingText="Creating…">Create discount</SubmitButton></div>
      </ActionForm>
    </Card>
    {rows.length ? <DataTable><thead><tr><th>Code</th><th>Discount</th><th>Uses</th><th>Expires</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{rows.map((row) => {
      const expired = row.expiresAt ? row.expiresAt < new Date() : false;
      return <tr key={row.id}><td className="font-mono font-bold text-ink">{row.code}</td><td>{row.percentOff}% off</td><td>{row.usedCount}{row.maxUses ? ` / ${row.maxUses}` : ""}</td><td>{row.expiresAt ? formatDateTime(row.expiresAt, timezone, { zone: false }) : "Never"}</td><td><StatusBadge status={row.active && !expired ? "active" : "cancelled"} label={expired ? "Expired" : row.active ? "Active" : "Paused"} /></td><td className="text-right"><span className="flex justify-end gap-2">
        <ModalButton label="Edit" title={`Edit ${row.code}`} variant="secondary">
          <ActionForm action={updateDiscountCode.bind(null, row.id)}>
            <Input label="Percentage off" name="percentOff" type="number" min="1" max="100" defaultValue={row.percentOff} required />
            <Input label="Maximum uses" name="maxUses" type="number" min={Math.max(1, row.usedCount)} defaultValue={row.maxUses ?? ""} placeholder="Unlimited" hint={`Used ${row.usedCount} time${row.usedCount === 1 ? "" : "s"} so far. Leave empty for no limit.`} />
            <Input label="Expires" name="expiresAt" type="datetime-local" defaultValue={toZonedInput(row.expiresAt, timezone)} hint="Leave empty for no expiry." />
            <SubmitButton>Save changes</SubmitButton>
          </ActionForm>
        </ModalButton>
        <ActionButton action={setDiscountCodeActive.bind(null, row.id, !row.active)}>{row.active ? "Pause" : "Activate"}</ActionButton><DeleteButton action={deleteDiscountCode.bind(null, row.id)} /></span></td></tr>;
    })}</tbody></DataTable> : <EmptyState title="No discount codes" icon={CardIcon}>Create the first code above when you are ready to run a promotion.</EmptyState>}
  </>;
}
