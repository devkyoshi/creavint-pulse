import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { SiteState } from "@/lib/types";

const HAPPY_PATH: SiteState[] = [
  "created",
  "provisioning",
  "seeding",
  "live",
  "indexed",
  "adsense_applied",
  "adsense_approved",
  "monetized",
];

const EXCEPTION_STATES: SiteState[] = [
  "adsense_rejected",
  "remediation",
  "flagged",
  "paused",
  "provisioning_failed",
];

export function SiteStateFlow({ current }: { current: SiteState }) {
  const currentIdx = HAPPY_PATH.indexOf(current);
  const isException = EXCEPTION_STATES.includes(current);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        {HAPPY_PATH.map((state, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <Fragment key={state}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    done  ? "bg-success" :
                    active ? "bg-accent ring-2 ring-accent/30 ring-offset-1 ring-offset-background" :
                             "bg-border",
                  )}
                />
              </div>
              {i < HAPPY_PATH.length - 1 && (
                <div className={cn("flex-1 h-px mx-1", currentIdx > i ? "bg-success" : "bg-border")} />
              )}
            </Fragment>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary">
        Current:{" "}
        <span className={cn("font-medium", isException ? "text-destructive-text" : "text-text-primary")}>
          {titleCase(current)}
        </span>
      </p>
      {isException && (
        <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">
          This site is outside the standard monetization path.
        </p>
      )}
    </div>
  );
}
