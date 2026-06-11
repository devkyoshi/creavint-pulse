import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { ContentJobState, SiteState } from "@/lib/types";

const SITE_STATE_STYLES: Record<SiteState, string> = {
  created: "bg-muted text-muted-foreground",
  provisioning: "bg-chart-1/10 text-chart-1",
  seeding: "bg-chart-3/15 text-chart-3",
  live: "bg-success/10 text-success",
  indexed: "bg-success/10 text-success",
  adsense_applied: "bg-chart-1/10 text-chart-1",
  adsense_approved: "bg-success/10 text-success",
  monetized: "bg-success/15 text-success font-semibold",
  adsense_rejected: "bg-destructive/10 text-destructive",
  remediation: "bg-warning/15 text-warning",
  flagged: "bg-destructive/10 text-destructive",
  paused: "bg-muted text-muted-foreground",
  provisioning_failed: "bg-destructive/10 text-destructive",
};

export function SiteStateBadge({ state, className }: { state: SiteState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        SITE_STATE_STYLES[state] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {titleCase(state)}
    </span>
  );
}

const JOB_STATE_STYLES: Partial<Record<ContentJobState, string>> = {
  in_review: "bg-warning/15 text-warning",
  auto_approved: "bg-chart-1/10 text-chart-1",
  published: "bg-success/10 text-success",
  indexed: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
};

export function JobStateBadge({ state, className }: { state: ContentJobState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        JOB_STATE_STYLES[state] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {titleCase(state)}
    </span>
  );
}
