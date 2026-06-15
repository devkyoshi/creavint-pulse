import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info" | "purple" | "muted" | "primary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default:     "bg-surface-raised text-text-secondary border border-border",
  primary:     "bg-primary-subtle text-primary border border-primary/20",
  success:     "bg-success-subtle text-success-text border border-success/20",
  warning:     "bg-warning-subtle text-warning-text border border-warning/20",
  destructive: "bg-destructive-subtle text-destructive-text border border-destructive/20",
  info:        "bg-info-subtle text-info-text border border-info/20",
  purple:      "bg-purple-subtle text-purple-text border border-purple/20",
  muted:       "bg-surface text-text-tertiary border border-border-subtle",
};

export function Badge({ variant = "default", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-80 shrink-0" />
      )}
      {children}
    </span>
  );
}
