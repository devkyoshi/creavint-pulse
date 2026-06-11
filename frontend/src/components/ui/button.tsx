import * as React from "react"
import * as Slot from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon"

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-accent text-text-on-primary hover:bg-accent-hover",
  outline: "border border-border bg-transparent text-text-primary hover:bg-surface-raised",
  ghost: "bg-transparent text-text-secondary hover:bg-accent-subtle hover:text-text-primary",
  destructive: "bg-destructive text-text-on-primary hover:bg-destructive/90",
  link: "bg-transparent text-accent underline-offset-4 hover:underline p-0 h-auto",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-8 px-3.5 py-1.5 text-sm gap-1.5",
  sm: "h-7 px-2.5 py-1 text-xs gap-1",
  lg: "h-10 px-5 py-2.5 text-sm gap-2",
  icon: "size-8 p-0",
}

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
        "rounded-[--radius] transition-all active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "disabled:opacity-40 disabled:pointer-events-none",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        variantClasses[variant ?? "default"],
        sizeClasses[size ?? "default"],
        className,
      )}
      {...props}
    />
  )
}

export { Button }
export type { ButtonVariant, ButtonSize }
