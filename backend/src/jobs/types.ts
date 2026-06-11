/** BullMQ job names and payload contracts for the four queues. */

export const QUEUE_NAMES = ["provisioning", "content", "seo", "analytics"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

// provisioning queue
export interface ProvisioningPayload {
  siteId: string;
}

// content queue — stage dispatch
export const CONTENT_STAGES = [
  "DRAFT",
  "SEO_PASS",
  "MEDIA",
  "QUALITY_GATE",
  "PUBLISH",
  "INDEX_CHECK",
  "CADENCE_TICK",
] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];

export interface ContentStagePayload {
  contentJobId: string;
}

export interface CadenceTickPayload {
  siteId: string;
}

// seo queue
export type SeoJobName = "KEYWORD_REFRESH" | "SEO_AUDIT";

export interface KeywordRefreshPayload {
  niche: string;
}

export interface SeoAuditPayload {
  siteId: string;
}

// analytics queue
export type AnalyticsJobName = "GA4_PULL" | "GSC_PULL" | "ADSENSE_PULL" | "CONTENT_COST_ROLLUP";

export interface AnalyticsPayload {
  /** ISO date (YYYY-MM-DD) to pull; defaults to yesterday when omitted. */
  date?: string;
}
