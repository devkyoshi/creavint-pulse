import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ReviewQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => api.review.queue(),
    refetchInterval: 30_000,
  });

  const grouped = (data ?? []).reduce<Record<string, typeof data>>((acc, item) => {
    (acc[item.siteName] ??= [] as never).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Desk"
        description={`${data?.length ?? 0} article${(data?.length ?? 0) === 1 ? "" : "s"} awaiting human review.`}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Review queue is clear"
          description="Articles land here when the quality gate routes them to human review."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([siteName, items]) => (
            <section key={siteName} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{siteName}</h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {(items ?? [])
                      .slice()
                      .sort((a, b) => (b.qualityScores?.overall ?? 0) - (a.qualityScores?.overall ?? 0))
                      .map((item) => (
                        <li key={item.id}>
                          <Link
                            to={`/review/${item.id}`}
                            className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.title ?? "Untitled draft"}</p>
                              <p className="text-xs text-muted-foreground">
                                queued {timeAgo(item.createdAt)}
                                {item.retryCount > 0 ? ` · ${item.retryCount} auto-retr${item.retryCount === 1 ? "y" : "ies"}` : ""}
                                {item.critique ? " · escalated by quality gate" : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {item.qualityScores ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "tabular-nums",
                                    item.qualityScores.overall >= 75
                                      ? "bg-success/10 text-success"
                                      : item.qualityScores.overall < 50
                                        ? "bg-destructive/10 text-destructive"
                                        : "",
                                  )}
                                >
                                  Quality {item.qualityScores.overall}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">No scores</Badge>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
