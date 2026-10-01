import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import type { Settings } from "@/db/schema";

/**
 * Logo lockup: the uploaded logo for the background (light, or `tone="reversed"` for dark) if there is one,
 * otherwise the brand mark and wordmark.
 */
export function Brand({ settings, href = "/", className = "", tone = "primary" }: { settings: Pick<Settings, "siteName" | "logoUrl" | "logoDarkUrl">; href?: string; className?: string; tone?: "primary" | "reversed" }) {
  const [first, ...rest] = settings.siteName.split(" ");
  const logo = tone === "reversed" ? settings.logoDarkUrl : settings.logoUrl;
  return (
    <Link href={href} aria-label={`${settings.siteName} home`} className={`flex shrink-0 items-center gap-2.5 ${className}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={settings.siteName} className="h-9 w-auto max-w-[200px] object-contain" />
      ) : (
        <>
          <BrandMark className="size-9 shrink-0" tone={tone} />
          <span className={`font-display text-[22px] font-extrabold leading-none tracking-[-0.6px] ${tone === "reversed" ? "text-white" : "text-ink"}`}>
            {first}
            {rest.length > 0 && <span className={`ml-1.5 font-semibold tracking-[-0.3px] ${tone === "reversed" ? "text-white/75" : "text-accent"}`}>{rest.join(" ")}</span>}
          </span>
        </>
      )}
    </Link>
  );
}
