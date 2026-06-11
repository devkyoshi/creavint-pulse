import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full min-h-20 resize-y rounded-[--radius] border border-border bg-surface",
        "px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary",
        "transition-colors outline-none",
        "focus:border-border-focus focus:ring-2 focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
