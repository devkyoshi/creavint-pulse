import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 text-text-tertiary opacity-40">{icon}</div>
      )}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-text-tertiary max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
