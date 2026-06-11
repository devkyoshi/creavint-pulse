import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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

  const total = data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Desk"
        description={`${total} article${total === 1 ? "" : "s"} awaiting human review.`}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Review queue is clear"
          description="Articles land here when the quality gate routes them to human review."
        />
      ) : (
        <div className="space-y-7">
          {Object.entries(grouped).map(([siteName, items]) => (
            <section key={siteName} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-text-primary">{siteName}</h2>
                <span className="text-sm text-text-tertiary">{items?.length}</span>
              </div>
              <div className="rounded-[--radius-md] border border-border overflow-hidden bg-surface">
                <ul className="divide-y divide-border-subtle">
                  {(items ?? [])
                    .slice()
                    .sort((a, b) => (b.qualityScores?.overall ?? 0) - (a.qualityScores?.overall ?? 0))
                    .map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/review/${item.id}`}
                          className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-raised"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{item.title ?? "Untitled draft"}</p>
                            <p className="text-xs text-text-tertiary">
                              queued {timeAgo(item.createdAt)}
                              {item.retryCount > 0 ? ` · ${item.retryCount} auto-retr${item.retryCount === 1 ? "y" : "ies"}` : ""}
                              {item.critique ? " · escalated by quality gate" : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {item.qualityScores ? (
                              <span
                                className={cn(
                                  "rounded-[--radius-sm] px-2 py-0.5 text-xs font-mono tabular-nums font-semibold",
                                  item.qualityScores.overall >= 75
                                    ? "bg-success-subtle text-success-text"
                                    : item.qualityScores.overall < 50
                                      ? "bg-destructive-subtle text-destructive-text"
                                      : "bg-surface-raised text-text-secondary",
                                )}
                              >
                                Q {item.qualityScores.overall}
                              </span>
                            ) : (
                              <span className="rounded-[--radius-sm] bg-surface-raised px-2 py-0.5 text-xs text-text-tertiary">No scores</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
