import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { SiteState } from "@/lib/types";

/** The monetization happy path; exception states are rendered as a note below. */
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
    <div className="space-y-3">
      <ol className="flex flex-wrap items-center gap-y-3">
        {HAPPY_PATH.map((state, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <li key={state} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done && "border-success bg-success text-white",
                    active && "border-primary bg-primary text-primary-foreground",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {titleCase(state)}
                </span>
              </div>
              {i < HAPPY_PATH.length - 1 && (
                <span className={cn("mx-2 h-px w-4 sm:w-6", currentIdx > i ? "bg-success" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
      {isException && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          Site is currently in the <span className="font-semibold">{titleCase(current)}</span> state, outside the
          standard monetization path.
        </p>
      )}
    </div>
  );
}
