import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-[--radius] text-text-tertiary",
        "hover:bg-surface-hover hover:text-text-primary",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:outline-offset-2",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
