"use client";

import type { AiProvider } from "@/db/schema";
import { ChoicePanels } from "./choice-panels";

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
];

/** Picks the AI provider; the other provider's saved key and model are kept. */
export function AiProviderFields({ initial, openai, anthropic }: { initial: AiProvider; openai: React.ReactNode; anthropic: React.ReactNode }) {
  return <ChoicePanels name="aiProvider" legend="Provider" options={PROVIDERS} initial={initial} panels={{ openai, anthropic }} />;
}
