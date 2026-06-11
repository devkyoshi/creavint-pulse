import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { timeAgo, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types";

const SEVERITY_ORDER: Alert["severity"][] = ["critical", "high", "medium", "low"];

const SEVERITY_DOT: Record<Alert["severity"], string> = {
  critical: "bg-destructive",
  high: "bg-destructive/70",
  medium: "bg-warning",
  low: "bg-border",
};

const SEVERITY_CHIP: Record<Alert["severity"], string> = {
  critical: "text-destructive-text bg-destructive-subtle",
  high: "text-destructive-text bg-destructive-subtle",
  medium: "text-warning-text bg-warning-subtle",
  low: "text-text-tertiary bg-surface-raised",
};

const LEFT_BORDER: Record<Alert["severity"], string> = {
  critical: "border-l-2 border-l-destructive",
  high: "border-l-2 border-l-destructive/60",
  medium: "border-l-2 border-l-warning",
  low: "border-l-2 border-l-border",
};

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: api.alerts.list,
    refetchInterval: 15_000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.alerts.ack(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e) => toast.error(e.message),
  });

  const sorted = (data ?? [])
    .slice()
    .sort((a, b) => {
      if (!a.ackedBy !== !b.ackedBy) return a.ackedBy ? 1 : -1;
      const sev = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
      if (sev !== 0) return sev;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Indexation drops, provisioning failures, cost anomalies, and kill-switch events. Refreshes every 15s."
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : sorted.length === 0 ? (
        <EmptyState title="No alerts" description="The network is quiet. Alerts appear here and in Slack." />
      ) : (
        <div className="rounded-[--radius-md] border border-border overflow-hidden bg-surface">
          <ul className="divide-y divide-border-subtle">
            {sorted.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-raised",
                  LEFT_BORDER[a.severity],
                  a.ackedBy && "opacity-45",
                )}
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", SEVERITY_DOT[a.severity])} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{titleCase(a.type)}</p>
                    <span className={cn("rounded-[--radius-sm] px-1.5 py-0.5 text-[10px] font-medium capitalize", SEVERITY_CHIP[a.severity])}>
                      {a.severity}
                    </span>
                    {a.siteId && (
                      <Link to={`/sites/${a.siteId}`} className="text-xs text-accent hover:underline">
                        view site
                      </Link>
                    )}
                  </div>
                  {a.payloadJson && Object.keys(a.payloadJson).length > 0 && (
                    <p className="line-clamp-2 font-mono text-xs text-text-tertiary">
                      {JSON.stringify(a.payloadJson)}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary">{timeAgo(a.createdAt)}</p>
                </div>
                {!a.ackedBy && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => ackMutation.mutate(a.id)}
                    disabled={ackMutation.isPending}
                  >
                    <Check className="size-3.5" />
                    Ack
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
