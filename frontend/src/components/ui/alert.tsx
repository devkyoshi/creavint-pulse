import * as React from "react"
import { cn } from "@/lib/utils"

type AlertVariant = "default" | "destructive" | "success" | "warning"

const variantClasses: Record<AlertVariant, string> = {
  default: "bg-accent-subtle border-accent-muted text-text-primary",
  destructive: "bg-destructive-subtle border-destructive/30 text-destructive-text",
  success: "bg-success-subtle border-success/30 text-success-text",
  warning: "bg-warning-subtle border-warning/30 text-warning-text",
}

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-[--radius-md] border px-4 py-3 text-sm",
        "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4",
        "[&>svg~*]:pl-7",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("font-semibold leading-none mb-1", className)} {...props} />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-sm opacity-90", className)} {...props} />
  )
}

export { Alert, AlertTitle, AlertDescription }
