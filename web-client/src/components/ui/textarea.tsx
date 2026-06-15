import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[--radius] border bg-surface px-3 py-2 text-sm text-text-primary font-mono",
        "placeholder:text-text-tertiary leading-relaxed resize-y min-h-[120px]",
        "transition-colors duration-150",
        "focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus/30",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        error ? "border-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
