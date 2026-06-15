import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | ReactNode;
  sub?: string | ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, trend, accent, className }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-success-text" :
    trend === "down" ? "text-destructive-text" :
    "text-text-tertiary";

  return (
    <div
      className={cn(
        "rounded-[--radius-lg] border border-border bg-surface p-5 flex flex-col gap-1.5 shadow-sm",
        accent && "border-primary/25 bg-primary-subtle",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest">{label}</span>
      <div className="text-2xl font-semibold text-text-primary leading-tight tracking-tight font-mono">{value}</div>
      {sub && (
        <span className={cn("text-xs font-medium mt-0.5", trendColor)}>{sub}</span>
      )}
    </div>
  );
}
