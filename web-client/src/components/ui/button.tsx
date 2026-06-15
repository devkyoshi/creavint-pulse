import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 cursor-pointer select-none rounded-[--radius] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:     "bg-primary text-text-on-brand hover:bg-primary-hover",
  secondary:   "bg-surface-raised text-text-primary hover:bg-surface-hover border border-border",
  ghost:       "text-text-secondary hover:text-text-primary hover:bg-surface-raised",
  destructive: "bg-destructive text-text-on-brand hover:bg-destructive/90",
  outline:     "border border-border text-text-primary hover:bg-surface-raised",
};

const sizes: Record<Size, string> = {
  sm:   "h-7 px-2.5 text-xs",
  md:   "h-8 px-3.5 text-sm",
  lg:   "h-10 px-5 text-sm",
  icon: "h-8 w-8 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <svg className="animate-spin size-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
