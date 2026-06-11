import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OctagonAlert, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dateShort } from "@/lib/format";
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
      toast.success("Template registered — lint passed");
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
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No templates registered.</p>
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
                      <Badge variant="secondary" className={cn(t.lintPassed && "bg-success/10 text-success")}>
                        {t.lintPassed ? "passed" : "failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.manifestJson.parameters.map((p) => p.key).join(", ")}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{dateShort(t.createdAt)}</TableCell>
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
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Domain pool is empty.</p>
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
                    <TableCell className="text-muted-foreground">{d.registrar ?? "—"}</TableCell>
                    <TableCell>{d.isAged ? "yes" : "no"}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize",
                          d.status === "available" && "bg-success/10 text-success",
                          d.status === "expired" && "bg-destructive/10 text-destructive",
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
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>FQDN</Label>
              <Input value={fqdn} onChange={(e) => setFqdn(e.target.value)} placeholder="example.com" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Registrar (optional)</Label>
              <Input value={registrar} onChange={(e) => setRegistrar(e.target.value)} placeholder="namecheap" />
            </div>
            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Aged domain</p>
                <p className="text-xs text-muted-foreground">Previously registered domain with history.</p>
              </div>
              <Switch checked={isAged} onCheckedChange={setIsAged} />
            </div>
            {isAged && (
              <div className="space-y-1.5">
                <Label>History check notes</Label>
                <Input
                  value={historyNote}
                  onChange={(e) => setHistoryNote(e.target.value)}
                  placeholder="Wayback clean, no spam history, DR 12…"
                />
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
                    <p className="text-xs text-muted-foreground">{u.email}</p>
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
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
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
      toast.success(action === "pause" ? "Network paused — all queues stopped" : "Network resumed");
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
          Pauses every queue — provisioning, content, SEO, and analytics. Running jobs finish; nothing new starts.
          Use when Google flags the network or costs spike.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{active ? "Network is PAUSED" : "Network is running"}</p>
          {active && data?.since && (
            <p className="text-xs text-muted-foreground">since {new Date(data.since).toLocaleString()}</p>
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
      </Tabs>
    </div>
  );
}
