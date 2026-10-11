import type { CommunityCategory, Role, User } from "@/db/schema";
import type { Tone } from "@/components/ui";

export const COMMUNITY_CATEGORY_INFO: Record<CommunityCategory, { label: string; hint: string; tone: Tone }> = {
  general: { label: "General", hint: "Say hello, introduce yourself, chat about anything", tone: "neutral" },
  help: { label: "Help", hint: "Stuck on a query, a dashboard or an assignment? Ask here", tone: "amber" },
  wins: { label: "Wins", hint: "New job, finished project, passed a certification: share it", tone: "green" },
  jobs: { label: "Jobs & careers", hint: "Openings, CV and interview tips", tone: "cyan" },
  resources: { label: "Resources", hint: "Useful articles, datasets, courses and tools", tone: "accent" },
};

/** Shown next to names so members can tell who's on the team. */
export const COMMUNITY_ROLE_BADGE: Partial<Record<Role, string>> = { admin: "Team", staff: "Team", instructor: "Instructor" };

/** Limits that keep a runaway script or a spammer from flooding the board. */
export const COMMUNITY_LIMITS = { posts: 5, replies: 30, windowMinutes: 60 } as const;

/** Unconfirmed accounts can read but not post, so throwaway sign-ups can't spam. The team is always allowed. */
export function canPostInCommunity(user: Pick<User, "role" | "emailVerifiedAt">): boolean {
  return user.role !== "student" || Boolean(user.emailVerifiedAt);
}
