import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-[22px] font-semibold tabular-nums tracking-tight text-text-primary leading-none">{value}</p>
      {hint ? <p className="text-[11px] text-text-tertiary mt-1">{hint}</p> : null}
    </div>
  );
}
