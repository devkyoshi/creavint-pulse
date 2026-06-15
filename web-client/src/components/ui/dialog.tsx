import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "w-full max-w-md",
  md: "w-full max-w-lg",
  lg: "w-full max-w-2xl",
  xl: "w-full max-w-3xl",
};

export function Dialog({ open, onClose, title, description, children, className, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return createPortal(
    <dialog
      ref={ref}
      className="fixed inset-0 m-auto p-0 rounded-[--radius-lg] bg-surface border border-border shadow-2xl"
      style={{ zIndex: "var(--z-modal)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={cn(sizes[size], className)}>
        {title && (
          <div className="flex items-start justify-between border-b border-border-subtle px-6 py-4 gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary leading-snug">{title}</h2>
              {description && (
                <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded p-0.5 text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
