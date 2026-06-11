import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster"
      toastOptions={{
        classNames: {
          toast: "bg-surface-overlay border border-border text-text-primary shadow-lg rounded-[--radius-md] text-sm",
          description: "text-text-secondary",
          actionButton: "bg-accent text-text-on-primary",
          cancelButton: "bg-surface-raised text-text-secondary",
          error: "text-destructive-text",
          success: "text-success-text",
          warning: "text-warning-text",
        },
      }}
      style={
        {
          "--normal-bg": "var(--surface-overlay)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-md)",
          "--success-bg": "var(--success-subtle)",
          "--success-text": "var(--success-text)",
          "--success-border": "var(--success)",
          "--error-bg": "var(--destructive-subtle)",
          "--error-text": "var(--destructive-text)",
          "--error-border": "var(--destructive)",
          "--warning-bg": "var(--warning-subtle)",
          "--warning-text": "var(--warning-text)",
          "--warning-border": "var(--warning)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
