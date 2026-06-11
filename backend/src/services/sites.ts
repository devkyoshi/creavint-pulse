import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { domains, sites, templates, type Site } from "../db/schema.ts";
import { canTransition, InvalidTransitionError } from "../lib/stateMachine.ts";
import { slugify } from "../lib/text.ts";
import { writeAudit } from "./audit.ts";
import type { CreateSiteRequest, SiteState } from "../types.ts";

export async function getSite(siteId: string): Promise<Site | undefined> {
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  return site;
}

export async function getSiteOrThrow(siteId: string): Promise<Site> {
  const site = await getSite(siteId);
  if (!site) throw new Error(`site not found: ${siteId}`);
  return site;
}

export async function siteFqdn(site: Site): Promise<string | null> {
  if (!site.domainId) return null;
  const [domain] = await db.select().from(domains).where(eq(domains.id, site.domainId)).limit(1);
  return domain?.fqdn ?? null;
}

/**
 * Single choke point for site state changes. Validates against the state
 * machine (also enforced by the DB trigger) and audit-logs the transition.
 */
export async function transitionSiteState(
  siteId: string,
  to: SiteState,
  actorId: string | null = null,
): Promise<Site> {
  const site = await getSiteOrThrow(siteId);
  if (site.state === to) return site;
  if (!canTransition(site.state, to)) throw new InvalidTransitionError(site.state, to);

  const [updated] = await db.update(sites).set({ state: to }).where(eq(sites.id, siteId)).returning();
  await writeAudit({
    actorId,
    action: "site.state_transition",
    entityType: "site",
    entityId: siteId,
    before: { state: site.state },
    after: { state: to },
  });
  return updated!;
}

export async function createSite(req: CreateSiteRequest, actorId: string): Promise<Site> {
  const [template] = await db.select().from(templates).where(eq(templates.id, req.templateId)).limit(1);
  if (!template) throw new Error("template not found");
  if (!template.lintPassed) throw new Error("template has not passed lint — register it first");

  let domainId = req.domainId ?? null;
  if (!domainId && req.fqdn) {
    const [domain] = await db
      .insert(domains)
      .values({ fqdn: req.fqdn, status: "assigned" })
      .onConflictDoUpdate({ target: domains.fqdn, set: { status: "assigned" } })
      .returning();
    domainId = domain!.id;
  } else if (domainId) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error("domain not found");
    if (domain.status === "expired") throw new Error("domain is expired");
    await db.update(domains).set({ status: "assigned" }).where(eq(domains.id, domainId));
  }
  if (!domainId) throw new Error("either domainId or fqdn is required");

  const base = slugify(req.name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [existing] = await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, slug)).limit(1);
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const [site] = await db
    .insert(sites)
    .values({
      slug,
      name: req.name,
      niche: req.niche,
      domainId,
      templateId: req.templateId,
      state: "created",
      contentPolicyJson: req.contentPolicy,
      themeConfigJson: req.themeConfig,
      seoDefaultsJson: req.seoDefaults,
      gtmContainerId: req.gtmContainerId ?? null,
      adsenseClientId: req.adsenseClientId ?? null,
      ga4PropertyId: req.ga4PropertyId ?? null,
      reviewPolicyJson: req.reviewPolicy,
      cadenceJson: req.cadence,
      createdBy: actorId,
    })
    .returning();

  await writeAudit({
    actorId,
    action: "site.create",
    entityType: "site",
    entityId: site!.id,
    after: { slug, name: req.name, niche: req.niche },
  });
  return site!;
}
