import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  BRIEF_KINDS,
  BRIEF_STATUSES,
  CLUSTER_STATUSES,
  CONTENT_JOB_STATES,
  DOMAIN_STATUSES,
  MEDIA_KINDS,
  PROVISION_STATUSES,
  PROVISION_STEPS,
  REVIEW_DECISIONS,
  ROLES,
  SITE_STATES,
  USER_STATUSES,
} from "../types.ts";
import type {
  BriefOutline,
  Cadence,
  ContentPolicy,
  InternalLinkCandidate,
  QualityScores,
  ReviewPolicy,
  SeoDefaults,
  TemplateManifest,
  ThemeConfig,
} from "../types.ts";

export const roleEnum = pgEnum("user_role", ROLES);
export const userStatusEnum = pgEnum("user_status", USER_STATUSES);
export const siteStateEnum = pgEnum("site_state", SITE_STATES);
export const domainStatusEnum = pgEnum("domain_status", DOMAIN_STATUSES);
export const clusterStatusEnum = pgEnum("cluster_status", CLUSTER_STATUSES);
export const briefKindEnum = pgEnum("brief_kind", BRIEF_KINDS);
export const briefStatusEnum = pgEnum("brief_status", BRIEF_STATUSES);
export const contentJobStateEnum = pgEnum("content_job_state", CONTENT_JOB_STATES);
export const reviewDecisionEnum = pgEnum("review_decision", REVIEW_DECISIONS);
export const mediaKindEnum = pgEnum("media_kind", MEDIA_KINDS);
export const alertSeverityEnum = pgEnum("alert_severity", ALERT_SEVERITIES);
export const alertTypeEnum = pgEnum("alert_type", ALERT_TYPES);
export const provisionStepEnum = pgEnum("provision_step", PROVISION_STEPS);
export const provisionStatusEnum = pgEnum("provision_status", PROVISION_STATUSES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId), index("audit_log_at_idx").on(t.at)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    manifestJson: jsonb("manifest_json").$type<TemplateManifest>().notNull(),
    lintPassed: boolean("lint_passed").notNull().default(false),
    lintResultsJson: jsonb("lint_results_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("templates_name_version_uq").on(t.name, t.version)],
);

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  fqdn: text("fqdn").notNull().unique(),
  registrar: text("registrar"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  isAged: boolean("is_aged").notNull().default(false),
  historyCheckJson: jsonb("history_check_json"),
  status: domainStatusEnum("status").notNull().default("available"),
});

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  domainId: uuid("domain_id").references(() => domains.id),
  templateId: uuid("template_id").references(() => templates.id),
  state: siteStateEnum("state").notNull().default("created"),
  contentPolicyJson: jsonb("content_policy_json").$type<ContentPolicy>().notNull(),
  themeConfigJson: jsonb("theme_config_json").$type<ThemeConfig>().notNull(),
  seoDefaultsJson: jsonb("seo_defaults_json").$type<SeoDefaults>().notNull(),
  gtmContainerId: text("gtm_container_id"),
  adsenseClientId: text("adsense_client_id"),
  ga4PropertyId: text("ga4_property_id"),
  reviewPolicyJson: jsonb("review_policy_json").$type<ReviewPolicy>().notNull(),
  cadenceJson: jsonb("cadence_json").$type<Cadence>().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywordClusters = pgTable(
  "keyword_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    niche: text("niche").notNull(),
    label: text("label").notNull(),
    keywordsJson: jsonb("keywords_json").$type<string[]>().notNull(),
    volume: integer("volume").notNull().default(0),
    difficulty: integer("difficulty").notNull().default(50),
    rpmEstimate: doublePrecision("rpm_estimate").notNull().default(0),
    opportunityScore: doublePrecision("opportunity_score").notNull().default(0),
    status: clusterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("keyword_clusters_niche_label_uq").on(t.niche, t.label)],
);

export const contentBriefs = pgTable(
  "content_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    clusterId: uuid("cluster_id").references(() => keywordClusters.id),
    kind: briefKindEnum("kind").notNull().default("new"),
    title: text("title"),
    outlineJson: jsonb("outline_json").$type<BriefOutline>().notNull(),
    internalLinkCandidatesJson: jsonb("internal_link_candidates_json")
      .$type<InternalLinkCandidate[]>()
      .notNull()
      .default([]),
    status: briefStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_briefs_site_idx").on(t.siteId, t.status)],
);

export const contentJobs = pgTable(
  "content_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    briefId: uuid("brief_id")
      .notNull()
      .references(() => contentBriefs.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    state: contentJobStateEnum("state").notNull().default("briefed"),
    modelUsed: text("model_used"),
    tokenCostUsd: doublePrecision("token_cost_usd").notNull().default(0),
    qualityScoresJson: jsonb("quality_scores_json").$type<QualityScores>(),
    title: text("title"),
    slug: text("slug"),
    metaDescription: text("meta_description"),
    draftMd: text("draft_md"),
    frontmatterJson: jsonb("frontmatter_json").$type<Record<string, unknown>>(),
    critique: text("critique"),
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("content_jobs_site_state_idx").on(t.siteId, t.state)],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    jobId: uuid("job_id").references(() => contentJobs.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    frontmatterJson: jsonb("frontmatter_json").$type<Record<string, unknown>>().notNull(),
    pathInRepo: text("path_in_repo").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("articles_site_slug_uq").on(t.siteId, t.slug),
    index("articles_site_idx").on(t.siteId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => contentJobs.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    decision: reviewDecisionEnum("decision").notNull(),
    reasonsJson: jsonb("reasons_json").$type<string[]>(),
    editedDiff: text("edited_diff"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_reviewer_idx").on(t.reviewerId, t.at)],
);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  jobId: uuid("job_id").references(() => contentJobs.id),
  kind: mediaKindEnum("kind").notNull(),
  storageUrl: text("storage_url").notNull(),
  licenseJson: jsonb("license_json"),
  altText: text("alt_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seoAudits = pgTable(
  "seo_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    resultsJson: jsonb("results_json").notNull(),
  },
  (t) => [index("seo_audits_site_idx").on(t.siteId, t.runAt)],
);

export const gscSnapshots = pgTable(
  "gsc_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    date: date("date").notNull(),
    indexedPages: integer("indexed_pages").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    topQueriesJson: jsonb("top_queries_json"),
  },
  (t) => [uniqueIndex("gsc_snapshots_site_date_uq").on(t.siteId, t.date)],
);

export const gaSnapshots = pgTable(
  "ga_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    date: date("date").notNull(),
    sessions: integer("sessions").notNull().default(0),
    users: integer("users").notNull().default(0),
    engagementJson: jsonb("engagement_json"),
  },
  (t) => [uniqueIndex("ga_snapshots_site_date_uq").on(t.siteId, t.date)],
);

export const revenueSnapshots = pgTable(
  "revenue_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    date: date("date").notNull(),
    adsenseRevenueUsd: doublePrecision("adsense_revenue_usd").notNull().default(0),
    rpm: doublePrecision("rpm").notNull().default(0),
    adImpressions: integer("ad_impressions").notNull().default(0),
  },
  (t) => [uniqueIndex("revenue_snapshots_site_date_uq").on(t.siteId, t.date)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id),
    severity: alertSeverityEnum("severity").notNull(),
    type: alertTypeEnum("type").notNull(),
    payloadJson: jsonb("payload_json"),
    ackedBy: uuid("acked_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_created_idx").on(t.createdAt)],
);

export const provisionRuns = pgTable(
  "provision_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    step: provisionStepEnum("step").notNull(),
    status: provisionStatusEnum("status").notNull(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("provision_runs_site_idx").on(t.siteId, t.step)],
);

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type KeywordCluster = typeof keywordClusters.$inferSelect;
export type ContentBrief = typeof contentBriefs.$inferSelect;
export type ContentJob = typeof contentJobs.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type ProvisionRun = typeof provisionRuns.$inferSelect;
