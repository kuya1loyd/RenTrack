export const AGENT_BADGES = [
  { key: "prime_lister", label: "Prime Lister", category: "Achievement", description: "Recognized for listing quality and consistency." },
  { key: "rookie_beast", label: "Rookie Beast", category: "Achievement", description: "Recognized as a standout new Rent Manager." },
  { key: "rising_beast", label: "Rising Beast", category: "Achievement", description: "Recognized for strong professional growth." },
  { key: "rental_beast", label: "Rental Beast", category: "Achievement", description: "Recognized for exceptional rental activity." },
  { key: "annirentsary_rewards", label: "AnniRENTsary Rewards", category: "Reward", description: "A RentTrack anniversary reward." },
] as const;

export type AgentBadgeKey = (typeof AGENT_BADGES)[number]["key"];

export function getAgentBadge(key: string) {
  return AGENT_BADGES.find((badge) => badge.key === key) ?? null;
}
