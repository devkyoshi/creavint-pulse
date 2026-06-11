import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { ContentJobState, SiteState } from "@/lib/types";

const SITE_STATE_CLASSES: Record<SiteState, string> = {
  created: "bg-surface-raised text-text-secondary",
  provisioning: "bg-accent-subtle text-accent",
  seeding: "bg-accent-subtle text-accent",
  live: "bg-success-subtle text-success-text",
  indexed: "bg-success-subtle text-success-text",
  adsense_applied: "bg-accent-subtle text-accent",
  adsense_approved: "bg-success-subtle text-success-text",
  monetized: "bg-success-subtle text-success-text font-semibold",
  adsense_rejected: "bg-destructive-subtle text-destructive-text",
  remediation: "bg-warning-subtle text-warning-text",
  flagged: "bg-destructive-subtle text-destructive-text",
  paused: "bg-surface-raised text-text-secondary",
  provisioning_failed: "bg-destructive-subtle text-destructive-text",
};

export function SiteStateBadge({ state, className }: { state: SiteState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius-sm] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        SITE_STATE_CLASSES[state] ?? "bg-surface-raised text-text-secondary",
        className,
      )}
    >
      {titleCase(state)}
    </span>
  );
}

const JOB_STATE_CLASSES: Partial<Record<ContentJobState, string>> = {
  in_review: "bg-warning-subtle text-warning-text",
  auto_approved: "bg-accent-subtle text-accent",
  published: "bg-success-subtle text-success-text",
  indexed: "bg-success-subtle text-success-text",
  rejected: "bg-destructive-subtle text-destructive-text",
  failed: "bg-destructive-subtle text-destructive-text",
};

export function JobStateBadge({ state, className }: { state: ContentJobState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius-sm] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        JOB_STATE_CLASSES[state] ?? "bg-surface-raised text-text-secondary",
        className,
      )}
    >
      {titleCase(state)}
    </span>
  );
}
