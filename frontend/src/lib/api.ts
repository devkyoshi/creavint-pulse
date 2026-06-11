import type {
  Alert,
  ArticleReviewPayload,
  AuthUser,
  ChecklistResult,
  CreateSitePayload,
  Domain,
  IndexationPoint,
  KeywordCluster,
  NetworkAnalytics,
  ReviewQueueItem,
  SiteDetail,
  SiteEconomicsDaily,
  SiteListRow,
  Template,
  UserRow,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let body: unknown;
    try {
      body = await res.json();
      const b = body as { error?: string };
      if (b.error) message = b.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, body);
  }
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const api = {
  auth: {
    login: (email: string, password: string) => post<AuthUser>("/auth/login", { email, password }),
    logout: () => post<{ ok: boolean }>("/auth/logout"),
    me: () => get<AuthUser>("/auth/me"),
  },
  sites: {
    list: () => get<SiteListRow[]>("/sites"),
    detail: (id: string) => get<SiteDetail>(`/sites/${id}`),
    create: (payload: CreateSitePayload) =>
      post<{ siteId: string; slug: string; provisioningJobId: string }>("/sites", payload),
    pause: (id: string) => post<{ id: string; state: string }>(`/sites/${id}/pause`),
    resume: (id: string) => post<{ id: string; state: string }>(`/sites/${id}/resume`),
    checklist: (id: string) => get<ChecklistResult>(`/sites/${id}/checklist`),
    adsenseApply: (id: string) => post<{ id: string; state: string }>(`/sites/${id}/adsense/apply`),
    adsenseOutcome: (id: string, approved: boolean, reason?: string) =>
      post<{ id: string; state: string }>(`/sites/${id}/adsense/outcome`, { approved, reason }),
    addBriefs: (id: string, count: number, topic?: string) =>
      post<{ contentJobIds: string[] }>(`/sites/${id}/briefs`, { count, topic }),
  },
  review: {
    queue: (siteId?: string) =>
      get<ReviewQueueItem[]>(`/review-queue${siteId ? `?siteId=${siteId}` : ""}`),
    article: (jobId: string) => get<ArticleReviewPayload>(`/jobs/${jobId}/article`),
    submit: (jobId: string, decision: "approve" | "reject" | "edit", reasons?: string[], editedContent?: string) =>
      post<{ id: string; state: string }>(`/jobs/${jobId}/review`, { decision, reasons, editedContent }),
  },
  keywords: {
    list: (niche?: string) => get<KeywordCluster[]>(`/keywords${niche ? `?niche=${encodeURIComponent(niche)}` : ""}`),
    setStatus: (id: string, status: "active" | "pinned" | "banned") =>
      post<KeywordCluster>(`/keywords/${id}/status`, { status }),
    refresh: (niche: string) => post<{ enqueued: boolean }>(`/keywords/refresh`, { niche }),
  },
  analytics: {
    network: () => get<NetworkAnalytics>("/analytics/network"),
    site: (id: string) => get<{ daily: SiteEconomicsDaily[] }>(`/analytics/sites/${id}`),
    indexation: (id: string) =>
      get<{ trend: IndexationPoint[] }>(`/analytics/sites/${id}/indexation`),
  },
  alerts: {
    list: () => get<Alert[]>("/alerts"),
    ack: (id: string) => post<Alert>(`/alerts/${id}/ack`),
  },
  admin: {
    templates: () => get<Template[]>("/admin/templates"),
    registerTemplate: (templateDir: string) => post<Template>("/admin/templates", { templateDir }),
    domains: () => get<Domain[]>("/admin/domains"),
    addDomain: (payload: { fqdn: string; registrar?: string; isAged?: boolean; historyCheck?: Record<string, unknown> }) =>
      post<Domain>("/admin/domains", payload),
    users: () => get<UserRow[]>("/admin/users"),
    createUser: (payload: { email: string; name: string; role: string; password: string }) =>
      post<UserRow>("/admin/users", payload),
    updateUser: (id: string, payload: { role?: string; status?: string }) =>
      patch<UserRow>(`/admin/users/${id}`, payload),
    killSwitch: () => get<{ active: boolean; since: string | null }>("/admin/kill-switch"),
    setKillSwitch: (action: "pause" | "resume") => post<{ active: boolean }>("/admin/kill-switch", { action }),
  },
};
