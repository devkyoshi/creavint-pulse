import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { timeAgo, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types";

const SEVERITY_ORDER: Alert["severity"][] = ["critical", "high", "medium", "low"];

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
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {sorted.map((a) => (
                <li
                  key={a.id}
                  className={cn("flex items-start justify-between gap-3 px-5 py-3.5", a.ackedBy && "opacity-55")}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{titleCase(a.type)}</p>
                      <Badge
                        variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {a.severity}
                      </Badge>
                      {a.siteId && (
                        <Link to={`/sites/${a.siteId}`} className="text-xs text-primary hover:underline">
                          view site
                        </Link>
                      )}
                    </div>
                    {a.payloadJson && Object.keys(a.payloadJson).length > 0 && (
                      <p className="line-clamp-2 font-mono text-xs text-muted-foreground">
                        {JSON.stringify(a.payloadJson)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
