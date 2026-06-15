import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-[--radius] border bg-surface-raised px-3 py-2 text-sm text-text-primary",
        "placeholder:text-text-tertiary",
        "transition-colors duration-150",
        "focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        error ? "border-destructive" : "border-border hover:border-border-focus/40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
