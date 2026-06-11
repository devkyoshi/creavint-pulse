import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pin, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<string, string> = {
  pinned: "bg-accent-subtle text-accent",
  banned: "bg-destructive-subtle text-destructive-text",
  active: "bg-surface-raised text-text-secondary",
};

export function KeywordsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["keywords"], queryFn: () => api.keywords.list() });
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [refreshNiche, setRefreshNiche] = useState("");

  const canManage = user?.role === "admin" || user?.role === "site_manager";
  const niches = useMemo(() => [...new Set((data ?? []).map((k) => k.niche))].sort(), [data]);
  const rows = (data ?? [])
    .filter((k) => nicheFilter === "all" || k.niche === nicheFilter)
    .sort((a, b) => {
      if (a.status === "pinned" && b.status !== "pinned") return -1;
      if (b.status === "pinned" && a.status !== "pinned") return 1;
      return b.opportunityScore - a.opportunityScore;
    });

  const maxScore = Math.max(...rows.map((k) => k.opportunityScore), 1);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "pinned" | "banned" }) =>
      api.keywords.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keywords"] }),
    onError: (e) => toast.error(e.message),
  });

  const refreshMutation = useMutation({
    mutationFn: (niche: string) => api.keywords.refresh(niche),
    onSuccess: (_r, niche) => toast.success(`Keyword refresh enqueued for "${niche}"`),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword backlog"
        description="Clusters scored by opportunity — volume × inverse difficulty × RPM estimate."
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Niche to refresh…"
                value={refreshNiche}
                onChange={(e) => setRefreshNiche(e.target.value)}
                className="w-44"
              />
              <Button
                variant="outline"
                disabled={refreshNiche.trim().length < 2 || refreshMutation.isPending}
                onClick={() => refreshMutation.mutate(refreshNiche.trim())}
              >
                <Sparkles className="size-3.5" />
                Refresh
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <Select value={nicheFilter} onValueChange={setNicheFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All niches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All niches</SelectItem>
            {niches.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No keyword clusters"
          description="Run a refresh for a niche to populate the backlog from keyword research."
        />
      ) : (
        <div className="rounded-[--radius-md] border border-border overflow-hidden bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cluster</TableHead>
                <TableHead className="hidden md:table-cell">Keywords</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Difficulty</TableHead>
                <TableHead className="text-right">Opportunity</TableHead>
                <TableHead className="w-24 text-right">Status</TableHead>
                {canManage && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.id} className={cn(k.status === "banned" && "opacity-50")}>
                  <TableCell>
                    <p className="font-medium text-text-primary">{k.label}</p>
                    <p className="text-xs text-text-tertiary">{k.niche}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-72 md:table-cell">
                    <p className="truncate text-xs text-text-tertiary">{k.keywordsJson.join(", ")}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-text-primary">{num(k.volume)}</TableCell>
                  <TableCell className="text-right tabular-nums text-text-secondary">{k.difficulty}</TableCell>
                  <TableCell className="text-right">
                    <div className="relative inline-flex items-center justify-end">
                      <span
                        className="absolute inset-y-0 left-0 rounded-[--radius-sm] bg-accent/8 transition-all"
                        style={{ width: `${(k.opportunityScore / maxScore) * 100}%` }}
                      />
                      <span className="relative font-medium tabular-nums text-text-primary">{num(k.opportunityScore)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("rounded-[--radius-sm] px-1.5 py-0.5 text-[11px] font-medium capitalize", STATUS_CHIP[k.status] ?? STATUS_CHIP.active)}>
                      {k.status}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {k.status !== "pinned" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"
                                onClick={() => statusMutation.mutate({ id: k.id, status: "pinned" })}>
                                <Pin className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pin — prioritised for briefs</TooltipContent>
                          </Tooltip>
                        )}
                        {k.status !== "banned" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"
                                onClick={() => statusMutation.mutate({ id: k.id, status: "banned" })}>
                                <Ban className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ban — never used for briefs</TooltipContent>
                          </Tooltip>
                        )}
                        {k.status !== "active" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"
                                onClick={() => statusMutation.mutate({ id: k.id, status: "active" })}>
                                <RotateCcw className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset to active</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
