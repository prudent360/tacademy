import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts, type AiProvider, type AiSettings } from "@/db/schema";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";

export type AiFeature = "advisor" | "studyBuddy" | "grading" | "writing";

export const AI_PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic (Claude)" },
];

export const AI_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-6-sol", label: "GPT-6 Sol (balanced)" },
    { id: "gpt-6-astra", label: "GPT-6 Astra (most capable, highest cost)" },
    { id: "gpt-6-luna", label: "GPT-6 Luna (fastest, lowest cost)" },
  ],
  anthropic: [
    { id: "claude-opus-5", label: "Claude Opus 5 (best quality)" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 (balanced)" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest, lowest cost)" },
  ],
};
export const DEFAULT_MODEL: Record<AiProvider, string> = { openai: "gpt-6-sol", anthropic: "claude-opus-5" };

/** Claude models that accept the server-side refusal fallback. */
const CLAUDE_FALLBACK_MODELS = new Set(["claude-opus-5", "claude-opus-5-5", "claude-fable-5", "claude-fable-5-1"]);

export const DEFAULT_AI: AiSettings = {
  enabled: false, provider: "openai", openaiApiKey: "", openaiModel: DEFAULT_MODEL.openai, apiKey: "", model: DEFAULT_MODEL.anthropic,
  advisor: true, studyBuddy: true, grading: true, writing: true,
};

const ENV_KEY: Record<AiProvider, string | undefined> = { openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY };

export type ResolvedAi = AiSettings & {
  /** The active provider's key and model. */
  key: string;
  activeModel: string;
  /** Where the active provider's key comes from, for the settings page. */
  source: "settings" | "environment" | "none";
};

/** Settings > AI, with the chosen provider's key decrypted (or its environment variable as a fallback). */
export async function aiConfig(): Promise<ResolvedAi> {
  const saved = { ...DEFAULT_AI, ...((await getSettings()).ai ?? {}) };
  const savedKey = decryptSecret(saved.provider === "openai" ? saved.openaiApiKey : saved.apiKey);
  const key = savedKey || ENV_KEY[saved.provider] || "";
  const activeModel = (saved.provider === "openai" ? saved.openaiModel : saved.model) || DEFAULT_MODEL[saved.provider];
  return { ...saved, key, activeModel, source: savedKey ? "settings" : ENV_KEY[saved.provider] ? "environment" : "none" };
}

/** True when AI is switched on, has a key, and the feature is enabled. */
export async function aiAvailable(feature: AiFeature): Promise<boolean> {
  const cfg = await aiConfig();
  return cfg.enabled && Boolean(cfg.key) && cfg[feature];
}

const openaiClients = new Map<string, OpenAI>();
function openai(key: string): OpenAI {
  if (!openaiClients.has(key)) openaiClients.set(key, new OpenAI({ apiKey: key, timeout: 90_000, maxRetries: 2 }));
  return openaiClients.get(key)!;
}

const anthropicClients = new Map<string, Anthropic>();
function anthropic(key: string): Anthropic {
  if (!anthropicClients.has(key)) anthropicClients.set(key, new Anthropic({ apiKey: key, timeout: 90_000, maxRetries: 2 }));
  return anthropicClients.get(key)!;
}

export type AiResult = { text: string } | { error: string };
export type AiMessage = { role: "user" | "assistant"; content: string };

const UNAVAILABLE = "The assistant is unavailable right now. Please try again shortly.";

type Request = {
  system: string;
  /** Bulky, stable context (course lists, lesson content). Placed right after the system prompt so providers can cache it. */
  context?: string;
  messages: AiMessage[];
  /** JSON Schema for structured output. */
  schema?: Record<string, unknown>;
  maxTokens?: number;
};

async function askOpenAI(key: string, model: string, request: Request): Promise<AiResult> {
  try {
    const response = await openai(key).responses.create({
      model,
      // Stable instructions and context first: OpenAI caches repeated prompt prefixes automatically.
      instructions: request.context ? `${request.system}\n\n${request.context}` : request.system,
      input: request.messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: request.maxTokens ?? 16000,
      store: false,
      ...(request.schema ? { text: { format: { type: "json_schema" as const, name: "result", schema: request.schema, strict: true } } } : {}),
    });
    const refused = response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"));
    if (refused) return { error: "The assistant can't help with that request." };
    const text = response.output_text.trim();
    return text ? { text } : { error: "The assistant didn't return an answer. Please try again." };
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      // Students and visitors see the generic message; admins find the cause with "Test connection".
      console.error("OpenAI API key rejected");
      return { error: UNAVAILABLE };
    }
    if (error instanceof OpenAI.RateLimitError) return { error: "The assistant is busy right now. Please try again in a minute." };
    if (error instanceof OpenAI.BadRequestError) {
      console.error("OpenAI request rejected", error.message);
      return { error: "The assistant couldn't process that request." };
    }
    console.error("OpenAI request failed", error);
    return { error: UNAVAILABLE };
  }
}

async function askAnthropic(key: string, model: string, request: Request): Promise<AiResult> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: request.system }];
  if (request.context) system.push({ type: "text", text: request.context, cache_control: { type: "ephemeral" } });
  try {
    const response = await anthropic(key).beta.messages.create({
      model,
      max_tokens: request.maxTokens ?? 16000,
      system,
      messages: request.messages,
      ...(request.schema ? { output_config: { format: { type: "json_schema" as const, schema: request.schema } } } : {}),
      ...(CLAUDE_FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") return { error: "The assistant can't help with that request." };
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("").trim();
    return text ? { text } : { error: "The assistant didn't return an answer. Please try again." };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key rejected");
      return { error: UNAVAILABLE };
    }
    if (error instanceof Anthropic.RateLimitError) return { error: "The assistant is busy right now. Please try again in a minute." };
    if (error instanceof Anthropic.BadRequestError) {
      console.error("Anthropic request rejected", error.message);
      return { error: "The assistant couldn't process that request." };
    }
    console.error("Anthropic request failed", error);
    return { error: UNAVAILABLE };
  }
}

/** One request to the AI provider chosen in Settings > AI. Pass `schema` to get JSON matching a JSON Schema. */
export async function askAi(feature: AiFeature, request: Request): Promise<AiResult> {
  const cfg = await aiConfig();
  if (!cfg.enabled || !cfg.key || !cfg[feature]) return { error: "The AI assistant isn't switched on." };
  return cfg.provider === "openai" ? askOpenAI(cfg.key, cfg.activeModel, request) : askAnthropic(cfg.key, cfg.activeModel, request);
}

/** Checks the saved key and model with a tiny request, for the "Test connection" button. */
export async function pingAi(): Promise<string | null> {
  const cfg = await aiConfig();
  const name = cfg.provider === "openai" ? "OpenAI" : "Anthropic";
  if (!cfg.key) return `Add your ${name} API key first.`;
  try {
    if (cfg.provider === "openai") await openai(cfg.key).responses.create({ model: cfg.activeModel, input: "Reply with OK.", max_output_tokens: 64, store: false });
    else await anthropic(cfg.key).messages.create({ model: cfg.activeModel, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] });
    return null;
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError || error instanceof Anthropic.AuthenticationError) return `${name} rejected the API key.`;
    if (error instanceof OpenAI.NotFoundError || error instanceof Anthropic.NotFoundError) return "That model isn't available on this API key.";
    if (error instanceof OpenAI.RateLimitError || error instanceof Anthropic.RateLimitError) return `${name} says the key is out of credit or rate-limited. Check your billing.`;
    if (error instanceof OpenAI.APIError) return `OpenAI responded with an error (${error.status}): ${error.message}`;
    if (error instanceof Anthropic.APIError) return `Anthropic responded with an error (${error.status}).`;
    return `Couldn't reach ${name}. Check your network and try again.`;
  }
}

/**
 * Caps AI requests per person (or visitor address) per hour, to keep costs predictable.
 * Returns an error message when the limit is reached, otherwise records the request.
 */
export async function aiQuota(scope: string, who: string, perHour: number): Promise<string | null> {
  const db = await getDb();
  const key = `ai:${scope}:${who}`;
  const [row] = await db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.key, key), gte(loginAttempts.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if ((row?.n ?? 0) >= perHour) return "You've reached the limit for the assistant this hour. Please try again later.";
  await db.insert(loginAttempts).values({ key });
  return null;
}

/** Keeps a chat to its recent turns and caps each message, so a long conversation can't run up costs. */
export function trimChat(history: AiMessage[], maxTurns = 12): AiMessage[] {
  const recent = history.slice(-maxTurns).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}
