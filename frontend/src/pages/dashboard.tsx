import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, FileSearch, Globe, Users } from "lucide-react";
import { api } from "@/lib/api";
import { dateShort, num, timeAgo, titleCase, usd } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { SiteStateBadge } from "@/components/state-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analytics", "network"], queryFn: api.analytics.network });
  const { data: alerts } = useQuery({ queryKey: ["alerts"], queryFn: api.alerts.list, refetchInterval: 30_000 });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: api.sites.list });

  const daily = (data?.daily ?? []).map((d) => ({
    date: d.date,
    revenue: Number(d.revenue_usd),
    cost: Number(d.content_cost_usd),
    margin: Number(d.margin_usd),
    indexed: Number(d.indexed_pages),
    sessions: Number(d.sessions),
  }));

  const totals = daily.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      cost: acc.cost + d.cost,
      sessions: acc.sessions + d.sessions,
    }),
    { revenue: 0, cost: 0, sessions: 0 },
  );
  const latestIndexed = daily.length > 0 ? daily[daily.length - 1].indexed : 0;
  const unacked = (alerts ?? []).filter((a) => !a.ackedBy);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network overview"
        description={data ? `${dateShort(data.range.from)} – ${dateShort(data.range.to)}` : "Last 30 days"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (30d)" value={usd(totals.revenue)} icon={<DollarSign className="size-4" />} />
        <StatCard
          label="Contribution margin"
          value={usd(totals.revenue - totals.cost)}
          hint={`content cost ${usd(totals.cost)}`}
          icon={<DollarSign className="size-4" />}
        />
        <StatCard label="Sessions (30d)" value={num(totals.sessions)} icon={<Users className="size-4" />} />
        <StatCard
          label="Indexed pages"
          value={num(latestIndexed)}
          hint="latest network snapshot"
          icon={<FileSearch className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue vs. content cost</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : daily.length === 0 ? (
              <EmptyState
                title="No analytics yet"
                description="Revenue and cost series appear once the analytics workers start pulling data."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={44} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="cost" stroke="var(--chart-5)" strokeWidth={2} dot={false} name="Content cost" />
                  <Line type="monotone" dataKey="margin" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Margin" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Alert feed</CardTitle>
          </CardHeader>
          <CardContent>
            {unacked.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No unacknowledged alerts.</p>
            ) : (
              <ul className="space-y-3">
                {unacked.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{titleCase(a.type)}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                    </div>
                    <Badge
                      variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "secondary"}
                      className="shrink-0 capitalize"
                    >
                      {a.severity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/alerts" className="mt-4 block text-xs font-medium text-primary hover:underline">
              View all alerts →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Site economics (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.sites ?? []).length === 0 ? (
            <EmptyState
              title="No sites with economics data"
              description="Per-site revenue and margin appear after the first analytics pulls."
              action={
                (sites ?? []).length === 0 ? (
                  <Link to="/sites/new" className="text-sm font-medium text-primary hover:underline">
                    Create your first site →
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Site</th>
                    <th className="pb-2 font-medium">State</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                    <th className="pb-2 text-right font-medium">Content cost</th>
                    <th className="pb-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.sites ?? []).map((s) => (
                    <tr key={s.site_id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <Link to={`/sites/${s.site_id}`} className="font-medium hover:underline">
                          {s.site_name}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <SiteStateBadge state={s.state} />
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{usd(s.revenue_usd)}</td>
                      <td className="py-2.5 text-right tabular-nums">{usd(s.content_cost_usd)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{usd(s.margin_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
