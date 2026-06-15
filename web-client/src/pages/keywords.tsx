import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Pin, Ban, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { fmt } from "@/lib/utils";
import type { KeywordCluster } from "@/lib/types";

const STATUS_VARIANTS: Record<KeywordCluster["status"], "success" | "primary" | "destructive"> = {
  active: "success",
  pinned: "primary",
  banned: "destructive",
};

export function KeywordsPage() {
  const qc = useQueryClient();
  const [nicheFilter, setNicheFilter] = useState("");
  const [refreshNiche, setRefreshNiche] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["keywords", nicheFilter],
    queryFn: () => api.keywords.list(nicheFilter || undefined),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: KeywordCluster["status"] }) =>
      api.keywords.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });

  const refreshMutation = useMutation({
    mutationFn: (niche: string) => api.keywords.refresh(niche),
    onSuccess: () => setRefreshNiche(""),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>Keywords</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Keyword clusters ranked by opportunity score. Pin high-priority terms, ban irrelevant ones.
            {data && data.length > 0 && <span className="ml-1 text-text-secondary">{data.length} clusters.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={refreshNiche}
            onChange={(e) => setRefreshNiche(e.target.value)}
            placeholder="niche to refresh…"
            className="w-44"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!refreshNiche}
            loading={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate(refreshNiche)}
          >
            <RefreshCw className="size-3.5" />Refresh
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
          <Input
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            placeholder="Filter by niche…"
            className="pl-8 w-56"
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <Table>
            <Thead><Tr><Th>Keyword</Th><Th>Niche</Th><Th>Volume</Th><Th>Difficulty</Th><Th>RPM est.</Th><Th>Score</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</Tbody>
          </Table>
        ) : !data?.length ? (
          <EmptyState
            icon={<Search className="size-10" />}
            title="No keyword clusters"
            description="Enter a niche and click Refresh to pull keyword data."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Keyword cluster</Th>
                <Th>Niche</Th>
                <Th className="text-right">Volume</Th>
                <Th className="text-right">Difficulty</Th>
                <Th className="text-right">RPM est.</Th>
                <Th className="text-right">Opportunity</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {data.map((kw) => (
                <Tr key={kw.id}>
                  <Td className="text-text-primary font-medium max-w-[220px]">
                    <div className="truncate">{kw.label}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {kw.keywordsJson.slice(0, 3).map((k) => (
                        <span key={k} className="text-[10px] mono text-text-disabled">{k}</span>
                      ))}
                      {kw.keywordsJson.length > 3 && <span className="text-[10px] text-text-disabled">+{kw.keywordsJson.length - 3}</span>}
                    </div>
                  </Td>
                  <Td className="text-text-tertiary text-xs">{kw.niche}</Td>
                  <Td className="text-right mono text-xs">{fmt(kw.volume, 0)}</Td>
                  <Td className="text-right">
                    <span className={kw.difficulty > 70 ? "text-destructive-text mono text-xs" : kw.difficulty > 40 ? "text-warning-text mono text-xs" : "text-success-text mono text-xs"}>
                      {fmt(kw.difficulty, 0)}
                    </span>
                  </Td>
                  <Td className="text-right mono text-xs">${fmt(kw.rpmEstimate, 2)}</Td>
                  <Td className="text-right mono text-xs">{fmt(kw.opportunityScore, 1)}</Td>
                  <Td>
                    <Badge variant={STATUS_VARIANTS[kw.status]}>{kw.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {kw.status !== "pinned" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: kw.id, status: "pinned" })}
                          className="p-1 text-text-tertiary hover:text-primary transition-colors"
                          title="Pin"
                        >
                          <Pin className="size-3.5" />
                        </button>
                      )}
                      {kw.status !== "active" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: kw.id, status: "active" })}
                          className="p-1 text-text-tertiary hover:text-success transition-colors"
                          title="Activate"
                        >
                          <CheckCircle className="size-3.5" />
                        </button>
                      )}
                      {kw.status !== "banned" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: kw.id, status: "banned" })}
                          className="p-1 text-text-tertiary hover:text-destructive transition-colors"
                          title="Ban"
                        >
                          <Ban className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
