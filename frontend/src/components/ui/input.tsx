import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "w-full rounded-[--radius] border border-border bg-surface",
        "px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary",
        "transition-colors outline-none",
        "focus:border-border-focus focus:ring-2 focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
