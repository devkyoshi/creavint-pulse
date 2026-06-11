/**
 * Shared domain types and DTOs. When the dashboard app lands, this module is
 * the candidate to extract into packages/types.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ["admin", "site_manager", "content_reviewer", "analyst"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

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

export const CONTENT_JOB_STATES = [
  "briefed",
  "drafted",
  "seo_passed",
  "media_attached",
  "quality_checked",
  "in_review",
  "auto_approved",
  "published",
  "indexed",
  "rejected",
  "failed",
] as const;
export type ContentJobState = (typeof CONTENT_JOB_STATES)[number];

export const DOMAIN_STATUSES = ["available", "assigned", "expired"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const CLUSTER_STATUSES = ["active", "pinned", "banned"] as const;
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];

export const BRIEF_KINDS = ["new", "refresh"] as const;
export type BriefKind = (typeof BRIEF_KINDS)[number];

export const BRIEF_STATUSES = ["pending", "enqueued", "in_progress", "completed", "cancelled"] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const REVIEW_DECISIONS = ["approve", "reject", "edit"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const MEDIA_KINDS = ["ai_generated", "stock", "upload"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_TYPES = [
  "INDEXATION_DROP",
  "ADSENSE_POLICY",
  "REVENUE_ANOMALY",
  "CI_BUILD_FAILURE",
  "CERT_EXPIRY",
  "PROVISIONING_FAILED",
  "QUALITY_ESCALATION",
  "KILL_SWITCH",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const PROVISION_STEPS = [
  "SCAFFOLD",
  "TRUST_PAGES",
  "SEED_BRIEFS",
  "DNS",
  "TLS",
  "WEB_SERVER",
  "SEARCH_WIRING",
  "STATE_TRANSITION",
] as const;
export type ProvisionStep = (typeof PROVISION_STEPS)[number];

export const PROVISION_STATUSES = ["running", "completed", "failed", "skipped"] as const;
export type ProvisionStatus = (typeof PROVISION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Site configuration objects (stored as jsonb)
// ---------------------------------------------------------------------------

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
  /** Fraction of articles routed to humans in sampled mode (0–1). */
  sampleRate: number;
  /** Minimum overall quality score (0–100) for auto-approval. */
  qualityScoreThreshold: number;
}

export interface Cadence {
  cronExpression: string;
  articlesPerRun: number;
}

export interface SeoDefaults {
  titlePattern: string; // e.g. "{title} | {siteName}"
  defaultSchemaType: string; // e.g. "Article"
}

export interface ThemeConfig {
  primaryColor?: string;
  logoUrl?: string;
  description?: string;
  [param: string]: unknown;
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

export interface QualityScores {
  duplication: { maxSimilarity: number; nearestArticleId: string | null; pass: boolean };
  readability: { fleschReadingEase: number; pass: boolean };
  policy: { forbiddenTopicHits: string[]; ymylDetected: boolean; pass: boolean };
  critic: { score: number; issues: string[]; source: "llm" | "heuristic"; pass: boolean };
  overall: number;
  pass: boolean;
}

// ---------------------------------------------------------------------------
// AdSense application checklist
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

export interface CreateSiteRequest {
  name: string;
  niche: string;
  domainId?: string;
  fqdn?: string;
  templateId: string;
  contentPolicy: ContentPolicy;
  themeConfig: ThemeConfig;
  seoDefaults: SeoDefaults;
  gtmContainerId?: string;
  adsenseClientId?: string;
  ga4PropertyId?: string;
  reviewPolicy: ReviewPolicy;
  cadence: Cadence;
}

export interface ReviewRequest {
  decision: ReviewDecision;
  reasons?: string[];
  editedContent?: string;
}

// ---------------------------------------------------------------------------
// Channel adapter abstraction (§10 of the architecture doc)
// ---------------------------------------------------------------------------

export type ContentKind = "article" | "short_video" | "image_post" | "product_listing";

export interface CanonicalContent {
  kind: ContentKind;
  title: string;
  slug: string;
  description: string;
  bodyMarkdown: string;
  frontmatter: Record<string, unknown>;
  mediaRefs: { url: string; alt: string }[];
  policyTags: string[];
}

export interface PublishReceipt {
  channel: string;
  externalRef: string; // e.g. path_in_repo for static blogs
  publishedAt: string;
}

export interface ChannelMetrics {
  channel: string;
  since: string;
  metrics: Record<string, number>;
}

export interface ChannelAdapter {
  capabilities(): ContentKind[];
  transform(content: CanonicalContent, channelConfig: Record<string, unknown>): Promise<unknown>;
  publish(payload: unknown): Promise<PublishReceipt>;
  metrics(since: Date): Promise<ChannelMetrics>;
}

// ---------------------------------------------------------------------------
// Template manifest
// ---------------------------------------------------------------------------

export interface TemplateManifestParameter {
  key: string;
  label: string;
  type: "string" | "color" | "url" | "boolean" | "number";
  required?: boolean;
  default?: unknown;
}

export interface TemplateManifest {
  id: string;
  name: string;
  version: string;
  parameters: TemplateManifestParameter[];
  requiredPages: string[];
}

// ---------------------------------------------------------------------------
// Keyword backlog
// ---------------------------------------------------------------------------

export interface KeywordIdea {
  keyword: string;
  volume: number;
  difficulty: number; // 0–100
  cpc: number;
}

export interface BriefOutline {
  targetKeyword: string;
  keywords: string[];
  intent: "informational" | "commercial" | "transactional" | "navigational";
  headings: string[];
  notes?: string;
  /** Refresh briefs: slug of the existing article to rewrite. */
  targetSlug?: string;
  /** Quality-gate critique attached on retry. */
  critique?: string;
}

export interface InternalLinkCandidate {
  title: string;
  slug: string;
}
