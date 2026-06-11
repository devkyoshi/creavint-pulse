import type { SiteState } from "../types.ts";

/**
 * Allowed site state transitions (§6.3). Mirrored by the sites_state_guard
 * DB trigger in migration 0001 — keep both in sync.
 */
export const SITE_TRANSITIONS: Record<SiteState, SiteState[]> = {
  created: ["provisioning", "flagged", "paused"],
  provisioning: ["seeding", "provisioning_failed", "flagged", "paused"],
  seeding: ["live", "flagged", "paused"],
  live: ["indexed", "flagged", "paused"],
  indexed: ["adsense_applied", "flagged", "paused"],
  adsense_applied: ["adsense_approved", "adsense_rejected", "flagged", "paused"],
  adsense_approved: ["monetized", "flagged", "paused"],
  monetized: ["flagged", "paused"],
  adsense_rejected: ["remediation", "flagged", "paused"],
  remediation: ["adsense_applied", "flagged", "paused"],
  flagged: ["paused", "live"],
  paused: ["live", "seeding", "provisioning"],
  provisioning_failed: ["provisioning", "paused"],
};

export function canTransition(from: SiteState, to: SiteState): boolean {
  return SITE_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: SiteState, to: SiteState) {
    super(`invalid site state transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}
