import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border/50 rounded-[--radius-md]">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description ? (
        <p className="text-sm text-text-tertiary mt-1 max-w-xs">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
