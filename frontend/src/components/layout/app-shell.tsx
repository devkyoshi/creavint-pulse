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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[]; // omit = everyone (admin always passes)
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
      { to: "/alerts", label: "Alerts", icon: <Bell className="size-4" /> },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/sites", label: "Sites", icon: <Globe className="size-4" /> },
      {
        to: "/review",
        label: "Content Desk",
        icon: <ClipboardCheck className="size-4" />,
        roles: ["content_reviewer", "site_manager"],
      },
      { to: "/keywords", label: "Keywords", icon: <Search className="size-4" /> },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/admin", label: "Admin", icon: <Settings className="size-4" />, roles: [] }],
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
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Creavint Pulse</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const visible = group.items.filter((i) => canSee(i, user.role));
          if (visible.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
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
      <div className="border-t px-5 py-3">
        <p className="text-[11px] text-muted-foreground">Internal platform · Phase 1a</p>
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
    <span className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
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
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card lg:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2">
            <KillSwitchIndicator />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent" aria-label="Account">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-[11px] font-normal text-muted-foreground capitalize">
                    {user?.role.replace("_", " ")}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
