/** DTOs mirrored from the backend (backend/src/types.ts + route payloads). */

export type Role = "admin" | "site_manager" | "content_reviewer" | "analyst";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const SITE_STATES = [
  "created",
  "provisioning",
  "seeding",
  "live",
  "indexed",
  "adsense_applied",
  "adsense_approved",
  "monetized",
  "adsense_rejected",
  "remediation",
  "flagged",
  "paused",
  "provisioning_failed",
] as const;
export type SiteState = (typeof SITE_STATES)[number];

export type ContentJobState =
  | "briefed"
  | "drafted"
  | "seo_passed"
  | "media_attached"
  | "quality_checked"
  | "in_review"
  | "auto_approved"
  | "published"
  | "indexed"
  | "rejected"
  | "failed";

export interface ContentPolicy {
  tone: string;
  persona?: string;
  allowedTopics: string[];
  forbiddenTopics: string[];
  wordCountMin: number;
  wordCountMax: number;
  imagePolicy: "ai_generated" | "stock" | "none";
  ymylEnabled: boolean;
}

export interface ReviewPolicy {
  mode: "mandatory" | "sampled" | "auto";
  sampleRate: number;
  qualityScoreThreshold: number;
}

export interface Cadence {
  cronExpression: string;
  articlesPerRun: number;
}

export interface Site {
  id: string;
  slug: string;
  name: string;
  niche: string;
  state: SiteState;
  domainId: string | null;
  templateId: string | null;
  contentPolicyJson: ContentPolicy;
  themeConfigJson: Record<string, unknown>;
  seoDefaultsJson: { titlePattern: string; defaultSchemaType: string };
  gtmContainerId: string | null;
  adsenseClientId: string | null;
  ga4PropertyId: string | null;
  reviewPolicyJson: ReviewPolicy;
  cadenceJson: Cadence;
  createdAt: string;
}

export interface SiteListRow {
  site: Site;
  fqdn: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface ChecklistResult {
  pass: boolean;
  items: ChecklistItem[];
}

export interface ProvisionRun {
  id: string;
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface QualityScores {
  duplication: { maxSimilarity: number; nearestArticleId: string | null; pass: boolean };
  readability: { fleschReadingEase: number; pass: boolean };
  policy: { forbiddenTopicHits: string[]; ymylDetected: boolean; pass: boolean };
  critic: { score: number; issues: string[]; source: "llm" | "heuristic"; pass: boolean };
  overall: number;
  pass: boolean;
}

export interface ContentJob {
  id: string;
  briefId: string;
  siteId: string;
  state: ContentJobState;
  modelUsed: string | null;
  tokenCostUsd: number;
  qualityScoresJson: QualityScores | null;
  title: string | null;
  slug: string | null;
  metaDescription: string | null;
  draftMd: string | null;
  critique: string | null;
  error: string | null;
  retryCount: number;
  createdAt: string;
  publishedAt: string | null;
}

export interface SiteDetail extends Site {
  fqdn: string | null;
  allowedTransitions: SiteState[];
  provisionRuns: ProvisionRun[];
  recentJobs: ContentJob[];
  adsenseChecklist: ChecklistResult;
}

export interface ReviewQueueItem {
  id: string;
  siteId: string;
  siteName: string;
  siteSlug: string;
  title: string | null;
  qualityScores: QualityScores | null;
  critique: string | null;
  retryCount: number;
  createdAt: string;
}

export interface ContentBrief {
  id: string;
  siteId: string;
  kind: "new" | "refresh";
  title: string | null;
  outlineJson: {
    targetKeyword: string;
    keywords: string[];
    intent: string;
    headings: string[];
    critique?: string;
  };
  internalLinkCandidatesJson: { title: string; slug: string }[];
  status: string;
  createdAt: string;
}

export interface Review {
  id: string;
  jobId: string;
  reviewerId: string;
  decision: "approve" | "reject" | "edit";
  reasonsJson: string[] | null;
  at: string;
}

export interface ArticleReviewPayload {
  job: ContentJob;
  brief: ContentBrief;
  reviews: Review[];
}

export interface KeywordCluster {
  id: string;
  niche: string;
  label: string;
  keywordsJson: string[];
  volume: number;
  difficulty: number;
  rpmEstimate: number;
  opportunityScore: number;
  status: "active" | "pinned" | "banned";
}

export interface Alert {
  id: string;
  siteId: string | null;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  payloadJson: Record<string, unknown> | null;
  ackedBy: string | null;
  createdAt: string;
}

export interface NetworkDaily {
  date: string;
  sites: number;
  revenue_usd: string | number;
  content_cost_usd: string | number;
  margin_usd: string | number;
  sessions: string | number;
  indexed_pages: string | number;
}

export interface SiteEconomicsSummary {
  site_id: string;
  site_name: string;
  state: SiteState;
  revenue_usd: string | number;
  content_cost_usd: string | number;
  margin_usd: string | number;
}

export interface NetworkAnalytics {
  range: { from: string; to: string };
  daily: NetworkDaily[];
  sites: SiteEconomicsSummary[];
}

export interface SiteEconomicsDaily {
  site_id: string;
  date: string;
  revenue_usd: string | number;
  rpm: string | number;
  content_cost_usd: string | number;
  margin_usd: string | number;
}

export interface IndexationPoint {
  site_id: string;
  date: string;
  indexed_pages: number;
  indexed_pages_7d_avg: string | number;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  lintPassed: boolean;
  manifestJson: {
    id: string;
    name: string;
    version: string;
    parameters: { key: string; label: string; type: string; required?: boolean; default?: unknown }[];
    requiredPages: string[];
  };
  createdAt: string;
}

export interface Domain {
  id: string;
  fqdn: string;
  registrar: string | null;
  isAged: boolean;
  status: "available" | "assigned" | "expired";
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
}

export interface CreateSitePayload {
  name: string;
  niche: string;
  domainId?: string;
  fqdn?: string;
  templateId: string;
  contentPolicy: ContentPolicy;
  themeConfig: Record<string, unknown>;
  seoDefaults: { titlePattern: string; defaultSchemaType: string };
  gtmContainerId?: string;
  adsenseClientId?: string;
  ga4PropertyId?: string;
  reviewPolicy: ReviewPolicy;
  cadence: Cadence;
}
