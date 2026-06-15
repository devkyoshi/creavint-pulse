import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { fmtDatetime, relativeTime } from "@/lib/utils";
import type { Role, SystemConfigRow } from "@/lib/types";

/* ─── Provider dropdown options (matches backend key names) ───────────────── */
const PROVIDER_OPTIONS: Record<string, { value: string; label: string }[]> = {
  llm_provider: [
    { value: "claude",  label: "Anthropic Claude (paid)" },
    { value: "groq",    label: "Groq (free tier)" },
    { value: "gemini",  label: "Google Gemini 2.5 Flash (free)" },
  ],
  image_provider: [
    { value: "replicate", label: "Replicate / Flux (paid)" },
    { value: "pexels",    label: "Pexels (free)" },
    { value: "unsplash",  label: "Unsplash (free)" },
  ],
  keywords_provider: [
    { value: "dataforseo", label: "DataForSEO (paid)" },
    { value: "serper",     label: "Serper.dev (free tier)" },
    { value: "llm",        label: "LLM estimate (fallback)" },
  ],
  embeddings_provider: [
    { value: "openai",       label: "OpenAI (paid)" },
    { value: "huggingface",  label: "HuggingFace (free)" },
    { value: "local",        label: "Local hash (no API)" },
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  llm:          "LLM Provider",
  image:        "Image Generation",
  keywords:     "Keyword Research",
  embeddings:   "Embeddings",
  integrations: "Integrations",
};

/* ─── Source badge ────────────────────────────────────────────────────────── */
function SourceBadge({ source }: { source: SystemConfigRow["source"] }) {
  if (source === "db")    return <Badge variant="success" className="text-[10px]">saved</Badge>;
  if (source === "env")   return <Badge variant="info"    className="text-[10px]">env var</Badge>;
  return <Badge variant="muted" className="text-[10px]">not set</Badge>;
}

/* ─── Config row ──────────────────────────────────────────────────────────── */
function ConfigRow({ row }: { row: SystemConfigRow }) {
  const qc = useQueryClient();
  const [localValue, setLocalValue] = useState("");
  const [revealed, setRevealed] = useState(false);

  const options = PROVIDER_OPTIONS[row.key];
  const isProvider = row.key.endsWith("_provider") && !!options;

  const saveMutation = useMutation({
    mutationFn: (value: string | null) => api.admin.setConfig(row.key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-config"] });
      setLocalValue("");
    },
  });

  /* Provider rows — always-visible Select, saves immediately on change */
  if (isProvider) {
    return (
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border-subtle last:border-0">
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{row.label}</span>
            <SourceBadge source={row.source} />
          </div>
          {row.description != null && (
            <p className="text-xs text-text-tertiary mt-0.5">{row.description}</p>
          )}
        </div>
        <Select
          value={row.value ?? ""}
          onChange={(e) => saveMutation.mutate(e.target.value)}
          disabled={saveMutation.isPending}
          className="w-56 text-sm shrink-0"
        >
          {!row.value && <option value="" disabled>Select provider…</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
    );
  }

  /* All other rows — inline Input + Save, Clear for secrets */
  const isConfigured = row.value === "***SET***";

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border-subtle last:border-0">
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary">{row.label}</span>
          <SourceBadge source={row.source} />
        </div>
        {row.description != null && (
          <p className="text-xs text-text-tertiary mt-0.5">{row.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Show current non-secret value */}
        {row.value && !row.isSecret && row.value !== "***SET***" && !localValue && (
          <code className="mono text-xs text-text-secondary bg-surface-raised px-2 py-1 rounded">
            {revealed ? row.value : row.value}
          </code>
        )}
        <div className="relative">
          <Input
            type={row.isSecret && !revealed ? "password" : "text"}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={
              isConfigured
                ? "•••••••• (blank = keep current)"
                : row.isSecret
                ? "Enter key…"
                : "Enter value…"
            }
            className="w-52 text-xs mono h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && localValue.trim()) saveMutation.mutate(localValue.trim());
            }}
          />
          {row.isSecret && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!localValue.trim() || saveMutation.isPending}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate(localValue.trim() || null)}
        >
          Save
        </Button>
        {isConfigured && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive-text hover:bg-destructive-subtle hover:text-destructive-text"
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

/* ─── System config tab ───────────────────────────────────────────────────── */
function ConfigTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-config"], queryFn: api.admin.config });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const byCategory = (data ?? []).reduce<Record<string, SystemConfigRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>System configuration</CardTitle>
          <span className="text-xs text-text-tertiary">
            Values saved here override environment variables. Secrets are never shown after saving — use Clear to remove.
          </span>
        </CardHeader>
      </Card>
      {Object.entries(byCategory).map(([cat, rows]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle>{CATEGORY_LABELS[cat] ?? cat}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {rows.map((row) => (
              <ConfigRow key={row.key} row={row} />
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ─── Kill switch ─────────────────────────────────────────────────────────── */
function KillSwitchSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["kill-switch"], queryFn: api.admin.killSwitch });

  const mutation = useMutation({
    mutationFn: (action: "pause" | "resume") => api.admin.setKillSwitch(action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kill-switch"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Activity className="size-3.5" />Kill switch
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-text-secondary">
              Status:{" "}
              <span className={data?.active ? "text-warning-text font-medium" : "text-success-text font-medium"}>
                {data?.active ? "Network paused" : "Running"}
              </span>
            </p>
            {data?.since && (
              <p className="text-xs text-text-tertiary mono mt-0.5">since {fmtDatetime(data.since)}</p>
            )}
          </div>
          {data?.active ? (
            <Button variant="primary" size="sm" loading={mutation.isPending} onClick={() => mutation.mutate("resume")}>
              Resume network
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-warning-text hover:bg-warning-subtle hover:text-warning-text"
              loading={mutation.isPending}
              onClick={() => mutation.mutate("pause")}
            >
              <AlertTriangle className="size-3.5" />Pause all
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/* ─── Users ───────────────────────────────────────────────────────────────── */
function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: api.admin.users });
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("analyst");
  const [newPw, setNewPw] = useState("");
  const [createError, setCreateError] = useState("");

  const createMutation = useMutation({
    mutationFn: () => api.admin.createUser({ email: newEmail, name: newName, role: newRole, password: newPw }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      setNewEmail(""); setNewName(""); setNewPw(""); setCreateError("");
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status?: string; role?: string }) =>
      api.admin.updateUser(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-tertiary">{users ? `${users.length} user${users.length !== 1 ? "s" : ""}` : ""}</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Invite user</Button>
      </div>
      <Card>
        {isLoading ? (
          <Table>
            <Thead><Tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</Tbody>
          </Table>
        ) : (
          <Table>
            <Thead><Tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>
              {(users ?? []).map((u) => (
                <Tr key={u.id}>
                  <Td className="text-text-primary font-medium">{u.name}</Td>
                  <Td className="mono text-xs text-text-tertiary">{u.email}</Td>
                  <Td>
                    <Select
                      value={u.role}
                      onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value })}
                      className="h-7 text-xs w-40"
                    >
                      <option value="admin">Admin</option>
                      <option value="site_manager">Site manager</option>
                      <option value="content_reviewer">Content reviewer</option>
                      <option value="analyst">Analyst</option>
                    </Select>
                  </Td>
                  <Td><Badge variant={u.status === "active" ? "success" : "muted"}>{u.status}</Badge></Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: u.id, status: u.status === "active" ? "disabled" : "active" })}
                    >
                      {u.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Invite user" description="Staff account with role-based access." size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="analyst">Analyst</option>
                <option value="content_reviewer">Content reviewer</option>
                <option value="site_manager">Site manager</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jane@creavint.com" />
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
            <p className="text-xs text-text-tertiary mt-1.5">The user should change this on first sign-in.</p>
          </div>
          {createError && (
            <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">{createError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="primary" className="flex-1" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create user
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ─── Audit log ───────────────────────────────────────────────────────────── */
function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => api.admin.auditLog({ limit: 100 }),
  });

  return (
    <Card>
      {isLoading ? (
        <Table>
          <Thead><Tr><Th>Action</Th><Th>Entity</Th><Th>Actor</Th><Th>When</Th></Tr></Thead>
          <Tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}</Tbody>
        </Table>
      ) : (
        <Table>
          <Thead><Tr><Th>Action</Th><Th>Entity</Th><Th>Actor</Th><Th>When</Th></Tr></Thead>
          <Tbody>
            {(data ?? []).map((log) => (
              <Tr key={log.id}>
                <Td className="mono text-xs text-text-secondary">{log.action}</Td>
                <Td className="text-xs text-text-tertiary">
                  <span>{log.entityType}</span>
                  {log.entityId && <span className="mono ml-1 text-text-disabled">#{log.entityId.slice(0, 8)}</span>}
                </Td>
                <Td className="mono text-xs text-text-tertiary">{log.actorId?.slice(0, 8) ?? "system"}</Td>
                <Td className="text-xs text-text-tertiary">{relativeTime(log.at)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  );
}

/* ─── Domains ─────────────────────────────────────────────────────────────── */
function DomainsTab() {
  const qc = useQueryClient();
  const { data: domains, isLoading } = useQuery({ queryKey: ["admin-domains"], queryFn: api.admin.domains });
  const [showAdd, setShowAdd] = useState(false);
  const [fqdn, setFqdn] = useState("");
  const [registrar, setRegistrar] = useState("");
  const [isAged, setIsAged] = useState(false);
  const [addError, setAddError] = useState("");

  const addMutation = useMutation({
    mutationFn: () => api.admin.addDomain({ fqdn: fqdn.trim(), registrar: registrar || undefined, isAged }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
      setShowAdd(false);
      setFqdn(""); setRegistrar(""); setIsAged(false); setAddError("");
    },
    onError: (err: Error) => setAddError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add domain</Button>
      </div>
      <Card>
        {isLoading ? (
          <Table>
            <Thead><Tr><Th>FQDN</Th><Th>Registrar</Th><Th>Aged</Th><Th>Status</Th></Tr></Thead>
            <Tbody>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}</Tbody>
          </Table>
        ) : (
          <Table>
            <Thead><Tr><Th>FQDN</Th><Th>Registrar</Th><Th>Aged</Th><Th>Status</Th></Tr></Thead>
            <Tbody>
              {(domains ?? []).map((d) => (
                <Tr key={d.id}>
                  <Td className="mono text-sm text-text-primary">{d.fqdn}</Td>
                  <Td className="text-text-tertiary text-xs">{d.registrar ?? "—"}</Td>
                  <Td>{d.isAged ? <Badge variant="success">Aged</Badge> : "—"}</Td>
                  <Td>
                    <Badge variant={d.status === "available" ? "success" : d.status === "assigned" ? "info" : "muted"}>
                      {d.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <Dialog open={showAdd} onClose={() => setShowAdd(false)} title="Add domain" description="Aged domains require a recorded history check." size="md">
        <div className="space-y-4">
          <div>
            <Label>FQDN</Label>
            <Input value={fqdn} onChange={(e) => setFqdn(e.target.value)} placeholder="blog.example.com" className="mono" />
            <p className="text-xs text-text-tertiary mt-1.5">Fully-qualified domain name, must be lowercase.</p>
          </div>
          <div>
            <Label>Registrar <span className="text-text-tertiary font-normal">(optional)</span></Label>
            <Input value={registrar} onChange={(e) => setRegistrar(e.target.value)} placeholder="Namecheap, Cloudflare…" />
          </div>
          <div className="flex items-start justify-between rounded-[--radius] border border-border bg-surface-raised px-4 py-3.5 gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Aged domain</p>
              <p className="text-xs text-text-tertiary mt-0.5">Previously registered domain with backlink history.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
              <input type="checkbox" checked={isAged} onChange={(e) => setIsAged(e.target.checked)} className="accent-primary size-4" />
              <span className="text-sm text-text-secondary">{isAged ? "Yes" : "No"}</span>
            </label>
          </div>
          {addError && (
            <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">{addError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="primary" className="flex-1" loading={addMutation.isPending} onClick={() => addMutation.mutate()}>
              Add domain
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Admin</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Platform configuration, user management, and system controls.
        </p>
      </div>

      <KillSwitchSection />

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="domains"><DomainsTab /></TabsContent>
        <TabsContent value="config"><ConfigTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
