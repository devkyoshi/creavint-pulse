import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { TourButton } from "@/components/tour";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
  tourId?: string;
}

interface NavSection {
  items: NavItem[];
  dividerAfter?: boolean;
}

const NAV: NavSection[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: <LayoutDashboard className="size-3.5" />, tourId: "nav-dashboard" },
      { to: "/alerts", label: "Alerts", icon: <Bell className="size-3.5" />, tourId: "nav-alerts" },
    ],
    dividerAfter: true,
  },
  {
    items: [
      { to: "/sites", label: "Sites", icon: <Globe className="size-3.5" />, tourId: "nav-sites" },
      {
        to: "/review",
        label: "Content Desk",
        icon: <ClipboardCheck className="size-3.5" />,
        roles: ["content_reviewer", "site_manager"],
        tourId: "nav-review",
      },
      { to: "/keywords", label: "Keywords", icon: <Search className="size-3.5" />, tourId: "nav-keywords" },
    ],
    dividerAfter: true,
  },
  {
    items: [
      { to: "/admin", label: "Admin", icon: <Settings className="size-3.5" />, roles: [], tourId: "nav-admin" },
    ],
  },
];

function canSee(item: NavItem, role: Role): boolean {
  if (role === "admin") return true;
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex h-full flex-col bg-sidebar-bg">
      {/* Brand */}
      <div data-tour="sidebar-brand" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="size-2 rounded-full bg-sidebar-item-active-text shrink-0" />
        <span className="text-sm font-semibold text-sidebar-text">Creavint Pulse</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((section, si) => {
          const visible = section.items.filter((i) => canSee(i, user.role));
          if (visible.length === 0) return null;
          return (
            <div key={si}>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onNavigate}
                      data-tour={item.tourId}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-[--radius] px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-item-active text-sidebar-item-active-text font-medium"
                            : "text-sidebar-text-muted hover:bg-sidebar-item-hover hover:text-sidebar-text",
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              {section.dividerAfter && (
                <hr className="my-3 border-sidebar-border" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[11px] text-sidebar-text-muted">Phase 1a · internal</p>
      </div>
    </div>
  );
}

function KillSwitchIndicator() {
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
    <span className="inline-flex items-center gap-1.5 rounded-[--radius] bg-destructive-subtle px-2.5 py-1 text-xs font-medium text-destructive-text">
      <Activity className="size-3.5" />
      Network paused
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    user?.name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — always dark, theme-independent */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border lg:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0 bg-sidebar-bg border-r border-sidebar-border">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-1.5">
            <KillSwitchIndicator />
            <div data-tour="tour-trigger">
              <TourButton />
            </div>
            <div data-tour="theme-toggle">
              <ThemeToggle />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-tour="user-menu"
                  className="flex items-center rounded-[--radius] p-1 hover:bg-surface-raised transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="Account"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-medium text-text-primary">{user?.name}</p>
                  <p className="text-xs text-text-tertiary">{user?.email}</p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary capitalize">
                    {user?.role.replace("_", " ")}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-7 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
