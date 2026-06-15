import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppShell } from "@/components/layout/app-shell";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { AlertsPage } from "@/pages/alerts";
import { KeywordsPage } from "@/pages/keywords";
import { TemplatesPage } from "@/pages/templates";
import { AdminPage } from "@/pages/admin/admin";
import { SitesListPage } from "@/pages/sites/sites-list";
import { SiteNewPage } from "@/pages/sites/site-new";
import { SiteDetailPage } from "@/pages/sites/site-detail";
import { ArticleUploadPage } from "@/pages/sites/article-upload";
import { ReviewQueuePage } from "@/pages/review/review-queue";
import { ReviewDetailPage } from "@/pages/review/review-detail";
import { ArticleEditorPage } from "@/pages/articles/article-editor";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <span className="text-text-tertiary text-sm">Loading…</span>
    </div>
  );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="sites" element={<SitesListPage />} />
                <Route path="sites/new" element={<SiteNewPage />} />
                <Route path="sites/:id" element={<SiteDetailPage />} />
                <Route path="sites/:id/upload" element={<ArticleUploadPage />} />
                <Route path="review" element={<ReviewQueuePage />} />
                <Route path="review/:jobId" element={<ReviewDetailPage />} />
                <Route path="articles/:jobId/edit" element={<ArticleEditorPage />} />
                <Route path="keywords" element={<KeywordsPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
