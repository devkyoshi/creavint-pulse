CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('INDEXATION_DROP', 'ADSENSE_POLICY', 'REVENUE_ANOMALY', 'CI_BUILD_FAILURE', 'CERT_EXPIRY', 'PROVISIONING_FAILED', 'QUALITY_ESCALATION', 'KILL_SWITCH');--> statement-breakpoint
CREATE TYPE "public"."brief_kind" AS ENUM('new', 'refresh');--> statement-breakpoint
CREATE TYPE "public"."brief_status" AS ENUM('pending', 'enqueued', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cluster_status" AS ENUM('active', 'pinned', 'banned');--> statement-breakpoint
CREATE TYPE "public"."content_job_state" AS ENUM('briefed', 'drafted', 'seo_passed', 'media_attached', 'quality_checked', 'in_review', 'auto_approved', 'published', 'indexed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('available', 'assigned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('ai_generated', 'stock', 'upload');--> statement-breakpoint
CREATE TYPE "public"."provision_status" AS ENUM('running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."provision_step" AS ENUM('SCAFFOLD', 'TRUST_PAGES', 'SEED_BRIEFS', 'DNS', 'TLS', 'WEB_SERVER', 'SEARCH_WIRING', 'STATE_TRANSITION');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approve', 'reject', 'edit');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'site_manager', 'content_reviewer', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."site_state" AS ENUM('created', 'provisioning', 'seeding', 'live', 'indexed', 'adsense_applied', 'adsense_approved', 'monetized', 'adsense_rejected', 'remediation', 'flagged', 'paused', 'provisioning_failed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"severity" "alert_severity" NOT NULL,
	"type" "alert_type" NOT NULL,
	"payload_json" jsonb,
	"acked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"job_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"frontmatter_json" jsonb NOT NULL,
	"path_in_repo" text NOT NULL,
	"embedding" vector(1536),
	"published_at" timestamp with time zone,
	"indexed_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_json" jsonb,
	"after_json" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"cluster_id" uuid,
	"kind" "brief_kind" DEFAULT 'new' NOT NULL,
	"title" text,
	"outline_json" jsonb NOT NULL,
	"internal_link_candidates_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "brief_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"state" "content_job_state" DEFAULT 'briefed' NOT NULL,
	"model_used" text,
	"token_cost_usd" double precision DEFAULT 0 NOT NULL,
	"quality_scores_json" jsonb,
	"title" text,
	"slug" text,
	"meta_description" text,
	"draft_md" text,
	"frontmatter_json" jsonb,
	"critique" text,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fqdn" text NOT NULL,
	"registrar" text,
	"acquired_at" timestamp with time zone,
	"is_aged" boolean DEFAULT false NOT NULL,
	"history_check_json" jsonb,
	"status" "domain_status" DEFAULT 'available' NOT NULL,
	CONSTRAINT "domains_fqdn_unique" UNIQUE("fqdn")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ga_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"users" integer DEFAULT 0 NOT NULL,
	"engagement_json" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gsc_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"date" date NOT NULL,
	"indexed_pages" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"top_queries_json" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keyword_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche" text NOT NULL,
	"label" text NOT NULL,
	"keywords_json" jsonb NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"difficulty" integer DEFAULT 50 NOT NULL,
	"rpm_estimate" double precision DEFAULT 0 NOT NULL,
	"opportunity_score" double precision DEFAULT 0 NOT NULL,
	"status" "cluster_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"job_id" uuid,
	"kind" "media_kind" NOT NULL,
	"storage_url" text NOT NULL,
	"license_json" jsonb,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provision_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"step" "provision_step" NOT NULL,
	"status" "provision_status" NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"date" date NOT NULL,
	"adsense_revenue_usd" double precision DEFAULT 0 NOT NULL,
	"rpm" double precision DEFAULT 0 NOT NULL,
	"ad_impressions" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"reasons_json" jsonb,
	"edited_diff" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"results_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"niche" text NOT NULL,
	"domain_id" uuid,
	"template_id" uuid,
	"state" "site_state" DEFAULT 'created' NOT NULL,
	"content_policy_json" jsonb NOT NULL,
	"theme_config_json" jsonb NOT NULL,
	"seo_defaults_json" jsonb NOT NULL,
	"gtm_container_id" text,
	"adsense_client_id" text,
	"ga4_property_id" text,
	"review_policy_json" jsonb NOT NULL,
	"cadence_json" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"manifest_json" jsonb NOT NULL,
	"lint_passed" boolean DEFAULT false NOT NULL,
	"lint_results_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts" ADD CONSTRAINT "alerts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acked_by_users_id_fk" FOREIGN KEY ("acked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "articles" ADD CONSTRAINT "articles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "articles" ADD CONSTRAINT "articles_job_id_content_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."content_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_cluster_id_keyword_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."keyword_clusters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_jobs" ADD CONSTRAINT "content_jobs_brief_id_content_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."content_briefs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_jobs" ADD CONSTRAINT "content_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ga_snapshots" ADD CONSTRAINT "ga_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gsc_snapshots" ADD CONSTRAINT "gsc_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_job_id_content_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."content_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provision_runs" ADD CONSTRAINT "provision_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "revenue_snapshots" ADD CONSTRAINT "revenue_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_content_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."content_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sites" ADD CONSTRAINT "sites_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sites" ADD CONSTRAINT "sites_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_created_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_site_slug_uq" ON "articles" USING btree ("site_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_site_idx" ON "articles" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_briefs_site_idx" ON "content_briefs" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_jobs_site_state_idx" ON "content_jobs" USING btree ("site_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ga_snapshots_site_date_uq" ON "ga_snapshots" USING btree ("site_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gsc_snapshots_site_date_uq" ON "gsc_snapshots" USING btree ("site_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "keyword_clusters_niche_label_uq" ON "keyword_clusters" USING btree ("niche","label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provision_runs_site_idx" ON "provision_runs" USING btree ("site_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_snapshots_site_date_uq" ON "revenue_snapshots" USING btree ("site_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_reviewer_idx" ON "reviews" USING btree ("reviewer_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_audits_site_idx" ON "seo_audits" USING btree ("site_id","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "templates_name_version_uq" ON "templates" USING btree ("name","version");