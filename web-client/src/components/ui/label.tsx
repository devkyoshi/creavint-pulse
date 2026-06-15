import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium text-text-secondary mb-1.5", className)}
      {...props}
    >
      {children}
    </label>
  );
}
