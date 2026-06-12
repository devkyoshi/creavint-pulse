import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, OctagonAlert, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dateShort } from "@/lib/format";
import type { SystemConfigRow } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function TemplatesTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "templates"], queryFn: api.admin.templates });
  const [dir, setDir] = useState("");

  const registerMutation = useMutation({
    mutationFn: (templateDir: string) => api.admin.registerTemplate(templateDir),
    onSuccess: () => {
      toast.success("Template registered â€” lint passed");
      queryClient.invalidateQueries({ queryKey: ["admin", "templates"] });
      setDir("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Register template</CardTitle>
          <CardDescription>
            Directory name under <code className="font-mono text-xs">hugo-templates/</code>. Registration runs the
            lint (trust pages, GTM/AdSense hooks, sitemap, RSS, ads.txt) and rejects on failure.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="default-blog-v1"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            className="max-w-xs font-mono"
          />
          <Button disabled={!dir.trim() || registerMutation.isPending} onClick={() => registerMutation.mutate(dir.trim())}>
            Register & lint
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {(data ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-secondary">No templates registered.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Lint</TableHead>
                  <TableHead>Parameters</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.version}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn(t.lintPassed && "bg-success-subtle text-success-text")}>
                        {t.lintPassed ? "passed" : "failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {t.manifestJson.parameters.map((p) => p.key).join(", ")}
                    </TableCell>
                    <TableCell className="text-right text-xs text-text-secondary">{dateShort(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DomainsTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "domains"], queryFn: api.admin.domains });
  const [open, setOpen] = useState(false);
  const [fqdn, setFqdn] = useState("");
  const [registrar, setRegistrar] = useState("");
  const [isAged, setIsAged] = useState(false);
  const [historyNote, setHistoryNote] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      api.admin.addDomain({
        fqdn: fqdn.trim().toLowerCase(),
        registrar: registrar.trim() || undefined,
        isAged,
        historyCheck: isAged ? { note: historyNote, checkedAt: new Date().toISOString() } : undefined,
      }),
    onSuccess: () => {
      toast.success("Domain added to pool");
      queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
      setOpen(false);
      setFqdn("");
      setRegistrar("");
      setIsAged(false);
      setHistoryNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add domain
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {(data ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-secondary">Domain pool is empty.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Registrar</TableHead>
                  <TableHead>Aged</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.fqdn}</TableCell>
                    <TableCell className="text-text-secondary">{d.registrar ?? "â€”"}</TableCell>
                    <TableCell>{d.isAged ? "yes" : "no"}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize",
                          d.status === "available" && "bg-success-subtle text-success-text",
                          d.status === "expired" && "bg-destructive-subtle text-destructive-text",
                        )}
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add domain to pool</DialogTitle>
            <DialogDescription>Aged domains require a recorded history check (pool hygiene).</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>FQDN</Label>
              <Input value={fqdn} onChange={(e) => setFqdn(e.target.value)} placeholder="example.com" className="font-mono" />
              <p className="text-xs text-text-tertiary">Fully-qualified domain name. Must be lowercase.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Registrar <span className="text-text-tertiary font-normal">(optional)</span></Label>
              <Input value={registrar} onChange={(e) => setRegistrar(e.target.value)} placeholder="namecheap, cloudflare…" />
            </div>
            <div className="flex items-start justify-between rounded-[--radius] border border-border bg-surface-raised px-4 py-3.5 gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Aged domain</p>
                <p className="text-xs text-text-secondary mt-0.5">Previously registered domain with backlink history. Requires a history check note.</p>
              </div>
              <Switch checked={isAged} onCheckedChange={setIsAged} className="mt-0.5 shrink-0" />
            </div>
            {isAged && (
              <div className="space-y-1.5">
                <Label>History check notes</Label>
                <Input
                  value={historyNote}
                  onChange={(e) => setHistoryNote(e.target.value)}
                  placeholder="Wayback clean, no spam history, DR 12…"
                />
                <p className="text-xs text-text-tertiary">Document your Wayback Machine and spam check findings for the audit trail.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(fqdn.trim()) || (isAged && !historyNote.trim()) || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLES = ["admin", "site_manager", "content_reviewer", "analyst"] as const;

function UsersTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "users"], queryFn: api.admin.users });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "analyst", password: "" });

  const createMutation = useMutation({
    mutationFn: () => api.admin.createUser(form),
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setOpen(false);
      setForm({ email: "", name: "", role: "analyst", password: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { role?: string; status?: string } }) =>
      api.admin.updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add user
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-text-secondary">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(role) => updateMutation.mutate({ id: u.id, payload: { role } })}>
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: u.id,
                          payload: { status: u.status === "active" ? "disabled" : "active" },
                        })
                      }
                    >
                      {u.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Staff account with role-based access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Work email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(role) => setForm((f) => ({ ...f, role }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-tertiary">
                Admin — full access. Site manager — create/configure sites. Content reviewer — review queue only. Analyst — read-only.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
              <p className="text-xs text-text-tertiary">Minimum 8 characters. The user should change this on first sign-in.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name || !form.email.includes("@") || form.password.length < 8 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KillSwitchTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["kill-switch"], queryFn: api.admin.killSwitch, refetchInterval: 30_000 });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (action: "pause" | "resume") => api.admin.setKillSwitch(action),
    onSuccess: (_r, action) => {
      toast.success(action === "pause" ? "Network paused â€” all queues stopped" : "Network resumed");
      queryClient.invalidateQueries({ queryKey: ["kill-switch"] });
      setConfirmOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const active = data?.active ?? false;

  return (
    <Card className={cn(active && "border-destructive/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {active ? <OctagonAlert className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-success" />}
          Network kill switch
        </CardTitle>
        <CardDescription>
          Pauses every queue â€” provisioning, content, SEO, and analytics. Running jobs finish; nothing new starts.
          Use when Google flags the network or costs spike.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{active ? "Network is PAUSED" : "Network is running"}</p>
          {active && data?.since && (
            <p className="text-xs text-text-secondary">since {new Date(data.since).toLocaleString()}</p>
          )}
        </div>
        {active ? (
          <Button onClick={() => mutation.mutate("resume")} disabled={mutation.isPending}>
            Resume network
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Pause entire network
          </Button>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause the entire network?</DialogTitle>
            <DialogDescription>
              All four job queues stop accepting work. Content stops publishing across every site until resumed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => mutation.mutate("pause")} disabled={mutation.isPending}>
              Pause network
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const PROVIDER_OPTIONS: Record<string, { label: string; value: string }[]> = {
  llm_provider:        [{ value: "claude", label: "Anthropic Claude (paid)" }, { value: "groq", label: "Groq (free tier)" }, { value: "gemini", label: "Google Gemini 2.5 Flash (free)" }],
  image_provider:      [{ value: "replicate", label: "Replicate / Flux (paid)" }, { value: "pexels", label: "Pexels (free)" }, { value: "unsplash", label: "Unsplash (free)" }],
  keywords_provider:   [{ value: "dataforseo", label: "DataForSEO (paid)" }, { value: "serper", label: "Serper.dev (free tier)" }, { value: "llm", label: "LLM estimate (fallback)" }],
  embeddings_provider: [{ value: "openai", label: "OpenAI (paid)" }, { value: "huggingface", label: "HuggingFace (free)" }, { value: "local", label: "Local hash (no API)" }],
};

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM Provider",
  image: "Image Generation",
  keywords: "Keyword Research",
  embeddings: "Embeddings",
  integrations: "Integrations",
};

function SourceBadge({ source }: { source: SystemConfigRow["source"] }) {
  if (source === "db") return <Badge className="bg-success-subtle text-success-text text-xs">saved</Badge>;
  if (source === "env") return <Badge variant="secondary" className="text-xs">env var</Badge>;
  return <Badge variant="outline" className="text-xs text-text-tertiary">not set</Badge>;
}

function ConfigRow({ row }: { row: SystemConfigRow }) {
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState("");
  const isProvider = row.key.endsWith("_provider");
  const options = PROVIDER_OPTIONS[row.key];

  const saveMutation = useMutation({
    mutationFn: (value: string | null) => api.admin.setConfig(row.key, value),
    onSuccess: () => {
      toast.success(`${row.label} saved`);
      queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
      setLocalValue("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isProvider && options) {
    const currentValue = row.value ?? "";
    return (
      <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{row.label}</span>
            <SourceBadge source={row.source} />
          </div>
          {row.description && <p className="text-xs text-text-secondary mt-0.5">{row.description}</p>}
        </div>
        <Select
          value={currentValue}
          onValueChange={(v) => saveMutation.mutate(v)}
          disabled={saveMutation.isPending}
        >
          <SelectTrigger className="h-8 w-52 text-xs shrink-0">
            <SelectValue placeholder="Select provider…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const isConfigured = row.value === "***SET***";
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{row.label}</span>
          <SourceBadge source={row.source} />
        </div>
        {row.description && <p className="text-xs text-text-secondary mt-0.5">{row.description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type={row.isSecret ? "password" : "text"}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={isConfigured ? "•••••••• (leave blank = keep current)" : row.isSecret ? "Enter key…" : "Enter value…"}
          className="h-8 w-52 text-xs font-mono"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={!localValue.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate(localValue.trim() || null)}
        >
          Save
        </Button>
        {isConfigured && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => saveMutation.mutate(null)}
            disabled={saveMutation.isPending}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function SystemConfigTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "config"], queryFn: api.admin.config });

  if (isLoading) return <p className="py-10 text-center text-sm text-text-secondary">Loading…</p>;

  const byCategory = (data ?? []).reduce<Record<string, SystemConfigRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">System Configuration</CardTitle>
          <CardDescription>
            API keys and provider selection. Values saved here override environment variables.
            Secrets are never shown after saving — use Clear to remove.
          </CardDescription>
        </CardHeader>
      </Card>
      {Object.entries(byCategory).map(([category, rows]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{CATEGORY_LABELS[category] ?? category}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rows.map((row) => (
              <ConfigRow key={row.key} row={row} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AuditLogTab() {
  const [limit, setLimit] = useState(100);
  const [selected, setSelected] = useState<{ before: unknown; after: unknown; action: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-log", limit],
    queryFn: () => api.admin.auditLog({ limit }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Last {limit} entries · refreshes every 30 s</p>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100 rows</SelectItem>
            <SelectItem value="250">250 rows</SelectItem>
            <SelectItem value="500">500 rows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-text-secondary">Loading…</p>
          ) : (data ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-text-secondary">No audit entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelected({ before: entry.beforeJson, after: entry.afterJson, action: entry.action })}
                  >
                    <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                      {new Date(entry.at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                    <TableCell className="text-xs">{entry.entityType}</TableCell>
                    <TableCell className="font-mono text-xs text-text-secondary">
                      {entry.entityId ? entry.entityId.slice(0, 8) + "…" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(entry.beforeJson != null || entry.afterJson != null) && (
                        <Badge variant="outline" className="text-xs cursor-pointer">diff</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{selected?.action}</DialogTitle>
            <DialogDescription>Before / after diff for this audit entry.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary flex items-center gap-1">
                <Clock className="size-3" /> Before
              </p>
              <ScrollArea className="h-48 rounded border border-border bg-surface-sunken p-3">
                <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                  {selected?.before != null ? JSON.stringify(selected.before, null, 2) : "—"}
                </pre>
              </ScrollArea>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary flex items-center gap-1">
                <CheckCircle2 className="size-3 text-success" /> After
              </p>
              <ScrollArea className="h-48 rounded border border-border bg-surface-sunken p-3">
                <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                  {selected?.after != null ? JSON.stringify(selected.after, null, 2) : "—"}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Templates, domain pool, staff accounts, and emergency controls." />
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="kill-switch">Kill switch</TabsTrigger>
          <TabsTrigger value="config">System Config</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="domains">
          <DomainsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="kill-switch">
          <KillSwitchTab />
        </TabsContent>
        <TabsContent value="config">
          <SystemConfigTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

