import { createContext, useContext, useState, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TabsCtx {
  active: string;
  set: (v: string) => void;
}
const Ctx = createContext<TabsCtx | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const set = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <Ctx.Provider value={{ active, set }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-0 border-b border-border-subtle", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = useContext(Ctx)!;
  const isActive = ctx.active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.set(value)}
      className={cn(
        "relative px-3.5 py-2.5 text-sm transition-colors duration-150 shrink-0",
        isActive
          ? "text-text-primary font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t"
          : "text-text-tertiary hover:text-text-secondary",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useContext(Ctx)!;
  if (ctx.active !== value) return null;
  return <div className={cn("pt-4", className)}>{children}</div>;
}
