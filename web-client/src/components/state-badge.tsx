import { Badge } from "@/components/ui/badge";
import type { SiteState, ContentJobState } from "@/lib/types";

type BadgeV = "success" | "warning" | "destructive" | "info" | "purple" | "muted" | "default" | "primary";

const SITE_STATE_MAP: Record<SiteState, { label: string; variant: BadgeV }> = {
  created:           { label: "Created",          variant: "muted" },
  provisioning:      { label: "Provisioning",     variant: "info" },
  seeding:           { label: "Seeding",          variant: "info" },
  live:              { label: "Live",             variant: "success" },
  indexed:           { label: "Indexed",          variant: "success" },
  adsense_applied:   { label: "AdSense Applied",  variant: "purple" },
  adsense_approved:  { label: "AdSense Approved", variant: "purple" },
  monetized:         { label: "Monetized",        variant: "success" },
  adsense_rejected:  { label: "AdSense Rejected", variant: "destructive" },
  remediation:       { label: "Remediation",      variant: "warning" },
  flagged:           { label: "Flagged",          variant: "warning" },
  paused:            { label: "Paused",           variant: "muted" },
  provisioning_failed: { label: "Failed",         variant: "destructive" },
};

const JOB_STATE_MAP: Record<ContentJobState, { label: string; variant: BadgeV }> = {
  briefed:        { label: "Briefed",       variant: "muted" },
  drafted:        { label: "Drafted",       variant: "info" },
  seo_passed:     { label: "SEO Pass",      variant: "info" },
  media_attached: { label: "Media",         variant: "info" },
  quality_checked:{ label: "Quality OK",    variant: "info" },
  in_review:      { label: "In Review",     variant: "warning" },
  auto_approved:  { label: "Auto-approved", variant: "success" },
  published:      { label: "Published",     variant: "success" },
  indexed:        { label: "Indexed",       variant: "success" },
  rejected:       { label: "Rejected",      variant: "destructive" },
  failed:         { label: "Failed",        variant: "destructive" },
};

export function SiteStateBadge({ state }: { state: SiteState }) {
  const m = SITE_STATE_MAP[state] ?? { label: state, variant: "muted" as BadgeV };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}

export function JobStateBadge({ state }: { state: ContentJobState }) {
  const m = JOB_STATE_MAP[state] ?? { label: state, variant: "muted" as BadgeV };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
