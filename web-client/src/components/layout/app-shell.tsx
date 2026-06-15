import { useState, useRef, useEffect, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
  exact?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { to: "/",         label: "Dashboard",    icon: <LayoutDashboard className="size-4" />, exact: true },
      { to: "/alerts",   label: "Alerts",       icon: <AlertTriangle className="size-4" /> },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/sites",    label: "Sites",        icon: <Globe className="size-4" /> },
      { to: "/review",   label: "Content Desk", icon: <ClipboardCheck className="size-4" />, roles: ["content_reviewer", "site_manager", "admin"] },
      { to: "/keywords", label: "Keywords",     icon: <Search className="size-4" /> },
      { to: "/templates",label: "Templates",    icon: <LayoutTemplate className="size-4" /> },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin",    label: "Admin",        icon: <Settings className="size-4" />, roles: ["admin"] },
    ],
  },
];

function canSee(item: NavItem, role: Role): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex h-full flex-col bg-sidebar-bg thin-scrollbar overflow-y-auto">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-6 items-center justify-center rounded-[--radius-sm] bg-sidebar-brand-dot/20 shrink-0">
          <span className="size-2 rounded-full bg-sidebar-brand-dot" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-sidebar-item-active-text tracking-tight leading-none">
            Creavint Pulse
          </div>
          <div className="text-[10px] text-sidebar-text-muted mt-0.5 font-mono">Phase 1a · internal</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map((group, gi) => {
          const visible = group.items.filter((i) => canSee(i, user.role));
          if (visible.length === 0) return null;
          return (
            <div key={gi}>
              {group.label && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text-muted">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-[--radius] px-2.5 py-2 text-[13px] transition-colors duration-100",
                          isActive
                            ? "bg-sidebar-item-active text-sidebar-item-active-text font-medium"
                            : "text-sidebar-text hover:bg-sidebar-item-hover hover:text-sidebar-item-active-text",
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-[--radius] px-2 py-2">
          <div className="size-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-sidebar-brand-dot">
              {user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-sidebar-text truncate">{user.name}</div>
            <div className="text-[10px] text-sidebar-text-muted truncate capitalize">
              {user.role.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KillSwitchBadge() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["kill-switch"],
    queryFn: api.admin.killSwitch,
    enabled: user?.role === "admin",
    refetchInterval: 60_000,
    retry: false,
  });
  if (!data?.active) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-warning-subtle border border-warning/30 px-2.5 py-1 text-[11px] text-warning-text font-medium">
      <Activity className="size-3 shrink-0 animate-pulse" />
      Network paused
    </div>
  );
}

function UserDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-[--radius] px-2 py-1.5 transition-colors duration-150",
          "hover:bg-surface-hover text-text-secondary hover:text-text-primary",
          open && "bg-surface-hover",
        )}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="size-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-primary">{initials}</span>
        </div>
        <span className="hidden text-[13px] font-medium sm:block">{user.name}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-150 hidden sm:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1.5 w-52 menu-enter">
          <div className="rounded-[--radius-md] border border-border bg-surface-overlay shadow-xl ring-1 ring-black/5 overflow-hidden">
            {/* User info */}
            <div className="px-3.5 py-3 border-b border-border-subtle">
              <p className="text-[13px] font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-[11px] text-text-tertiary capitalize mt-0.5">{user.role.replace(/_/g, " ")}</p>
            </div>

            {/* Actions */}
            <div className="py-1">
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                onClick={() => { setOpen(false); navigate("/admin"); }}
              >
                <User className="size-3.5" />
                Profile
              </button>
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-destructive-text hover:bg-destructive-subtle transition-colors"
                onClick={async () => { setOpen(false); await logout(); navigate("/login"); }}
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar — always dark, theme-independent */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[var(--z-backdrop)] bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[var(--z-modal)] w-60 border-r border-sidebar-border transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Desktop header */}
        <header className="sticky top-0 z-[var(--z-sticky)] hidden h-14 items-center gap-4 border-b border-border header-glass px-6 lg:flex">
          <KillSwitchBadge />
          <div className="flex-1" />
          <ThemeToggle />
          <div className="h-5 w-px bg-border-subtle" />
          <UserDropdown />
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-[var(--z-sticky)] flex h-12 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
          <span className="flex-1 text-sm font-semibold text-text-primary">Creavint Pulse</span>
          <ThemeToggle />
          <KillSwitchBadge />
        </header>

        <main className="flex-1 px-6 py-7 sm:px-8 sm:py-8 max-w-[1440px] w-full mx-auto page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
