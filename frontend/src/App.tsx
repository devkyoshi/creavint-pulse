import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { SitesListPage } from "@/pages/sites/sites-list";
import { SiteNewPage } from "@/pages/sites/site-new";
import { SiteDetailPage } from "@/pages/sites/site-detail";
import { ReviewQueuePage } from "@/pages/review/review-queue";
import { ReviewDetailPage } from "@/pages/review/review-detail";
import { KeywordsPage } from "@/pages/keywords";
import { AlertsPage } from "@/pages/alerts";
import { AdminPage } from "@/pages/admin/admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text-tertiary">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="cv-theme" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/sites" element={<SitesListPage />} />
                  <Route path="/sites/new" element={<SiteNewPage />} />
                  <Route path="/sites/:id" element={<SiteDetailPage />} />
                  <Route path="/review" element={<ReviewQueuePage />} />
                  <Route path="/review/:jobId" element={<ReviewDetailPage />} />
                  <Route path="/keywords" element={<KeywordsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
