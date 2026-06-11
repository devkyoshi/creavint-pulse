-- Site state machine guard (§6.3). Mirrors SITE_TRANSITIONS in src/lib/stateMachine.ts — keep in sync.
CREATE OR REPLACE FUNCTION sites_state_guard() RETURNS trigger AS $$
DECLARE
  allowed text[];
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;
  allowed := CASE OLD.state::text
    WHEN 'created'             THEN ARRAY['provisioning','flagged','paused']
    WHEN 'provisioning'        THEN ARRAY['seeding','provisioning_failed','flagged','paused']
    WHEN 'seeding'             THEN ARRAY['live','flagged','paused']
    WHEN 'live'                THEN ARRAY['indexed','flagged','paused']
    WHEN 'indexed'             THEN ARRAY['adsense_applied','flagged','paused']
    WHEN 'adsense_applied'     THEN ARRAY['adsense_approved','adsense_rejected','flagged','paused']
    WHEN 'adsense_approved'    THEN ARRAY['monetized','flagged','paused']
    WHEN 'monetized'           THEN ARRAY['flagged','paused']
    WHEN 'adsense_rejected'    THEN ARRAY['remediation','flagged','paused']
    WHEN 'remediation'         THEN ARRAY['adsense_applied','flagged','paused']
    WHEN 'flagged'             THEN ARRAY['paused','live']
    WHEN 'paused'              THEN ARRAY['live','seeding','provisioning']
    WHEN 'provisioning_failed' THEN ARRAY['provisioning','paused']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (NEW.state::text = ANY(allowed)) THEN
    RAISE EXCEPTION 'invalid site state transition: % -> %', OLD.state, NEW.state;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sites_state_guard_trg ON sites;
--> statement-breakpoint
CREATE TRIGGER sites_state_guard_trg BEFORE UPDATE OF state ON sites
FOR EACH ROW EXECUTE FUNCTION sites_state_guard();
--> statement-breakpoint

-- site_economics: revenue minus content cost per site per day
CREATE OR REPLACE VIEW site_economics AS
WITH costs AS (
  SELECT site_id, created_at::date AS date, sum(token_cost_usd) AS content_cost_usd
  FROM content_jobs
  GROUP BY site_id, created_at::date
),
days AS (
  SELECT site_id, date FROM revenue_snapshots
  UNION
  SELECT site_id, date FROM costs
)
SELECT
  d.site_id,
  s.name  AS site_name,
  s.state AS state,
  d.date,
  COALESCE(r.adsense_revenue_usd, 0) AS revenue_usd,
  COALESCE(r.rpm, 0)                 AS rpm,
  COALESCE(c.content_cost_usd, 0)    AS content_cost_usd,
  COALESCE(r.adsense_revenue_usd, 0) - COALESCE(c.content_cost_usd, 0) AS margin_usd
FROM days d
JOIN sites s ON s.id = d.site_id
LEFT JOIN revenue_snapshots r ON r.site_id = d.site_id AND r.date = d.date
LEFT JOIN costs c ON c.site_id = d.site_id AND c.date = d.date;
--> statement-breakpoint

-- network_rollup: all sites aggregated per day
CREATE OR REPLACE VIEW network_rollup AS
SELECT
  e.date,
  count(DISTINCT e.site_id)  AS sites,
  sum(e.revenue_usd)         AS revenue_usd,
  sum(e.content_cost_usd)    AS content_cost_usd,
  sum(e.margin_usd)          AS margin_usd,
  COALESCE(sum(g.sessions), 0)       AS sessions,
  COALESCE(sum(gs.indexed_pages), 0) AS indexed_pages
FROM site_economics e
LEFT JOIN ga_snapshots g   ON g.site_id = e.site_id AND g.date = e.date
LEFT JOIN gsc_snapshots gs ON gs.site_id = e.site_id AND gs.date = e.date
GROUP BY e.date;
--> statement-breakpoint

-- indexation_trend: GSC indexed_pages with a 7-day rolling average (early-warning metric)
CREATE OR REPLACE VIEW indexation_trend AS
SELECT
  site_id,
  date,
  indexed_pages,
  round(avg(indexed_pages) OVER (
    PARTITION BY site_id ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 1) AS indexed_pages_7d_avg
FROM gsc_snapshots;
--> statement-breakpoint

-- reviewer_throughput: reviews per reviewer per day
CREATE OR REPLACE VIEW reviewer_throughput AS
SELECT
  r.reviewer_id,
  u.name AS reviewer_name,
  r.at::date AS day,
  count(*) AS reviews,
  count(*) FILTER (WHERE r.decision = 'approve') AS approved,
  count(*) FILTER (WHERE r.decision = 'reject')  AS rejected,
  count(*) FILTER (WHERE r.decision = 'edit')    AS edited
FROM reviews r
JOIN users u ON u.id = r.reviewer_id
GROUP BY r.reviewer_id, u.name, r.at::date;
