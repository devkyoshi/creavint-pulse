import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ArrowRight, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { SiteStateBadge } from "@/components/state-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { fmtUsd, fmtDate, fmt } from "@/lib/utils";
import type { NetworkAnalytics } from "@/lib/types";

function sumField(data: NetworkAnalytics["daily"], key: keyof NetworkAnalytics["daily"][number]): number {
  return data.reduce((acc, d) => acc + parseFloat(String(d[key] ?? 0)), 0);
}

const CHART_COLORS = {
  revenue: "var(--chart-3)",
  cost: "var(--chart-5)",
  margin: "var(--chart-1)",
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[--radius] border border-border bg-surface-overlay px-3 py-2 text-xs shadow-xl">
      <p className="text-text-tertiary mb-1.5 font-mono">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-mono font-medium">{fmtUsd(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "network"],
    queryFn: api.analytics.network,
  });

  const totalRevenue = data ? sumField(data.daily, "revenue_usd") : 0;
  const totalCost = data ? sumField(data.daily, "content_cost_usd") : 0;
  const totalMargin = totalRevenue - totalCost;
  const totalSessions = data ? sumField(data.daily, "sessions") : 0;

  const chartData = data?.daily.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Revenue: parseFloat(String(d.revenue_usd)),
    Cost: parseFloat(String(d.content_cost_usd)),
    Margin: parseFloat(String(d.margin_usd)),
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Network Overview</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Revenue, cost, and traffic across all active sites.
          {data?.range && (
            <span className="ml-1 font-mono text-xs text-text-disabled">
              {fmtDate(data.range.from)} – {fmtDate(data.range.to)}
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[--radius-lg] border border-border bg-surface p-5 space-y-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Revenue (30d)" value={fmtUsd(totalRevenue)} accent />
            <StatCard label="Content Cost" value={fmtUsd(totalCost)} />
            <StatCard label="Margin" value={fmtUsd(totalMargin)} trend={totalMargin >= 0 ? "up" : "down"} />
            <StatCard label="Sessions" value={fmt(totalSessions, 0)} />
          </>
        )}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-text-tertiary" />
            Revenue vs Cost
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.margin} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.margin} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={42} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke={CHART_COLORS.revenue} strokeWidth={1.5} fill="url(#gradRevenue)" />
                <Area type="monotone" dataKey="Margin" stroke={CHART_COLORS.margin} strokeWidth={1.5} fill="url(#gradMargin)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Site breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Sites (30d)</CardTitle>
          <Link to="/sites" className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
            All sites <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Site</Th>
                <Th>State</Th>
                <Th className="text-right">Revenue</Th>
                <Th className="text-right">Cost</Th>
                <Th className="text-right">Margin</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(data?.sites ?? []).map((s) => (
                <Tr key={s.site_id}>
                  <Td className="text-text-primary font-medium">{s.site_name}</Td>
                  <Td><SiteStateBadge state={s.state} /></Td>
                  <Td className="text-right mono">{fmtUsd(s.revenue_usd)}</Td>
                  <Td className="text-right mono">{fmtUsd(s.content_cost_usd)}</Td>
                  <Td className="text-right mono">
                    <span className={parseFloat(String(s.margin_usd)) >= 0 ? "text-success-text" : "text-destructive-text"}>
                      {fmtUsd(s.margin_usd)}
                    </span>
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
