import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline"

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-accent-subtle text-accent",
  secondary: "bg-surface-raised text-text-secondary",
  destructive: "bg-destructive-subtle text-destructive-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  outline: "border border-border text-text-secondary bg-transparent",
}

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius-sm] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeVariant }
