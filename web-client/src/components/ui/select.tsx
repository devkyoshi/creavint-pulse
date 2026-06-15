import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, style, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        style={style}
        className={cn(
          "w-full appearance-none rounded-[--radius] border bg-surface-raised px-3 py-2 pr-8 text-sm text-text-primary",
          "transition-colors duration-150 cursor-pointer",
          "focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          error ? "border-destructive" : "border-border hover:border-border-focus/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* Custom chevron — pointer-events-none so clicks pass through to select */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-tertiary">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M3 5L7 9L11 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  ),
);
Select.displayName = "Select";
