import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { dateShort, num, timeAgo, titleCase, usd } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SiteStateBadge } from "@/components/state-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types";

const SEVERITY_DOT: Record<Alert["severity"], string> = {
  critical: "bg-destructive",
  high: "bg-destructive/70",
  medium: "bg-warning",
  low: "bg-border",
};

const SEVERITY_TEXT: Record<Alert["severity"], string> = {
  critical: "text-destructive-text",
  high: "text-destructive-text",
  medium: "text-warning-text",
  low: "text-text-tertiary",
};

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
    (acc, d) => ({ revenue: acc.revenue + d.revenue, cost: acc.cost + d.cost, sessions: acc.sessions + d.sessions }),
    { revenue: 0, cost: 0, sessions: 0 },
  );
  const latestIndexed = daily.length > 0 ? daily[daily.length - 1].indexed : 0;
  const unacked = (alerts ?? []).filter((a) => !a.ackedBy);

  const metrics = [
    { label: "Revenue (30d)", value: usd(totals.revenue) },
    { label: "Contribution margin", value: usd(totals.revenue - totals.cost), hint: `cost ${usd(totals.cost)}` },
    { label: "Sessions (30d)", value: num(totals.sessions) },
    { label: "Indexed pages", value: num(latestIndexed), hint: "latest snapshot" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network overview"
        description={data ? `${dateShort(data.range.from)} – ${dateShort(data.range.to)}` : "Last 30 days"}
      />

      {/* Network metrics bar */}
      {isLoading ? (
        <Skeleton className="h-20" />
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-y divide-border xl:divide-y-0 border border-border rounded-[--radius-md] overflow-hidden">
          {metrics.map((m) => (
            <div key={m.label} className="px-6 py-5 bg-surface">
              <p className="text-xs text-text-tertiary mb-1">{m.label}</p>
              <p className="text-[22px] font-semibold tabular-nums tracking-tight text-text-primary leading-none">{m.value}</p>
              {m.hint && <p className="text-[11px] text-text-tertiary mt-1">{m.hint}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Revenue chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue vs. content cost</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
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
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                    stroke="transparent"
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                    stroke="transparent"
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-overlay)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                      color: "var(--text-primary)",
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="cost" stroke="var(--chart-5)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Content cost" />
                  <Line type="monotone" dataKey="margin" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Margin" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alert feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Alert feed
              {unacked.length > 0 && (
                <span className="ml-1.5 text-text-tertiary font-normal">({unacked.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unacked.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-tertiary">No unacknowledged alerts.</p>
            ) : (
              <ul className="space-y-3">
                {unacked.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", SEVERITY_DOT[a.severity])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{titleCase(a.type)}</p>
                      <p className="text-xs text-text-tertiary">{timeAgo(a.createdAt)}</p>
                    </div>
                    <span className={cn("shrink-0 text-[10px] font-medium capitalize", SEVERITY_TEXT[a.severity])}>
                      {a.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/alerts" className="mt-4 block text-xs font-medium text-accent hover:underline">
              View all alerts →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Site economics */}
      <Card>
        <CardHeader>
          <CardTitle>Site economics (30d)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.sites ?? []).length === 0 ? (
            <div className="px-5 py-4">
              <EmptyState
                title="No sites with economics data"
                description="Per-site revenue and margin appear after the first analytics pulls."
                action={
                  (sites ?? []).length === 0 ? (
                    <Link to="/sites/new" className="text-sm font-medium text-accent hover:underline">
                      Create your first site →
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Site</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Revenue</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Content cost</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Margin</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">State</th>
                </tr>
              </thead>
              <tbody>
                {(data?.sites ?? []).map((s) => (
                  <tr key={s.site_id} className="border-b border-border-subtle hover:bg-surface-raised transition-colors">
                    <td className="px-6 py-3.5">
                      <Link to={`/sites/${s.site_id}`} className="font-medium text-accent hover:underline">
                        {s.site_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-text-primary">{usd(s.revenue_usd)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-text-secondary">{usd(s.content_cost_usd)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-text-primary">{usd(s.margin_usd)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <SiteStateBadge state={s.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
