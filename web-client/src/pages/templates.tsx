import { useState, useRef, useCallback, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Plus, Upload, File, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { cn, fmtDate } from "@/lib/utils";
import type { LintCheck, Template } from "@/lib/types";

/* ─── Color helpers ───────────────────────────────────────────────────────── */
function templateAccent(template: Template): string {
  const colorParam = template.manifestJson?.parameters?.find(
    (p) => p.key === "primaryColor" || p.key === "accentColor" || p.key === "brandColor",
  );
  if (colorParam?.default && typeof colorParam.default === "string") {
    return colorParam.default as string;
  }
  // Deterministic hue from template name
  let hash = 0;
  for (const ch of template.name) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  const hue = hash % 360;
  return `oklch(0.60 0.18 ${hue})`;
}

/* ─── SVG blog wireframe ──────────────────────────────────────────────────── */
function LayoutWireframe({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-hidden>
      {/* Header bar */}
      <rect x="0" y="0" width="100" height="10" fill={accent} opacity="0.9" rx="2" />
      {/* Nav dots */}
      <circle cx="80" cy="5" r="1.5" fill="white" opacity="0.6" />
      <circle cx="86" cy="5" r="1.5" fill="white" opacity="0.6" />
      <circle cx="92" cy="5" r="1.5" fill="white" opacity="0.6" />
      {/* Logo placeholder */}
      <rect x="5" y="2.5" width="20" height="5" fill="white" opacity="0.3" rx="1" />

      {/* Content area */}
      <rect x="0" y="12" width="65" height="42" fill={accent} opacity="0.05" />
      {/* Article text lines */}
      <rect x="4" y="15" width="40" height="3" fill={accent} opacity="0.4" rx="1" />
      <rect x="4" y="21" width="55" height="2" fill="currentColor" opacity="0.12" rx="1" />
      <rect x="4" y="25" width="50" height="2" fill="currentColor" opacity="0.12" rx="1" />
      <rect x="4" y="29" width="55" height="2" fill="currentColor" opacity="0.1" rx="1" />
      <rect x="4" y="33" width="48" height="2" fill="currentColor" opacity="0.1" rx="1" />
      <rect x="4" y="39" width="35" height="2.5" fill={accent} opacity="0.3" rx="1" />
      <rect x="4" y="44" width="55" height="2" fill="currentColor" opacity="0.1" rx="1" />
      <rect x="4" y="48" width="52" height="2" fill="currentColor" opacity="0.1" rx="1" />

      {/* Sidebar */}
      <rect x="68" y="12" width="32" height="42" fill={accent} opacity="0.04" />
      {/* Sidebar widgets */}
      <rect x="70" y="15" width="25" height="8" fill={accent} opacity="0.15" rx="1.5" />
      <rect x="70" y="26" width="25" height="2" fill="currentColor" opacity="0.12" rx="1" />
      <rect x="70" y="30" width="20" height="2" fill="currentColor" opacity="0.1" rx="1" />
      <rect x="70" y="36" width="25" height="8" fill={accent} opacity="0.1" rx="1.5" />
      <rect x="70" y="47" width="18" height="2" fill="currentColor" opacity="0.1" rx="1" />

      {/* Footer */}
      <rect x="0" y="55" width="100" height="5" fill={accent} opacity="0.25" rx="1" />
    </svg>
  );
}

/* ─── Lint dot grid ───────────────────────────────────────────────────────── */
const LINT_LABELS: Record<string, string> = {
  config_template:  "Config template",
  trust_pages:      "Trust pages",
  gtm_injection:    "GTM injection",
  adsense_injection:"AdSense injection",
  schema_partial:   "Schema JSON-LD",
  sitemap_rss:      "Sitemap + RSS",
  ads_txt:          "ads.txt",
  manifest_pages:   "Manifest pages",
};

function LintDotGrid({ checks }: { checks: LintCheck[] }) {
  return (
    <div className="flex flex-wrap gap-1" title="Lint checks">
      {checks.map((c) => (
        <span
          key={c.name}
          title={`${LINT_LABELS[c.name] ?? c.name}: ${c.detail}`}
          className={cn(
            "size-2 rounded-full cursor-help",
            c.pass ? "bg-success" : "bg-destructive",
          )}
        />
      ))}
    </div>
  );
}

/* ─── Param type chips ────────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  color:   "bg-purple-subtle text-purple-text border-purple/20",
  url:     "bg-info-subtle text-info-text border-info/20",
  boolean: "bg-success-subtle text-success-text border-success/20",
  number:  "bg-warning-subtle text-warning-text border-warning/20",
  string:  "bg-surface-raised text-text-secondary border-border",
};

function ParamChips({ params }: { params: Template["manifestJson"]["parameters"] }) {
  const grouped = params.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(grouped).map(([type, n]) => (
        <span
          key={type}
          className={cn(
            "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
            TYPE_COLORS[type] ?? TYPE_COLORS.string,
          )}
        >
          {type} ×{n}
        </span>
      ))}
    </div>
  );
}

/* ─── Template card ───────────────────────────────────────────────────────── */
function TemplateCard({ template }: { template: Template }) {
  const [expanded, setExpanded] = useState(false);
  const params   = template.manifestJson?.parameters ?? [];
  const pages    = template.manifestJson?.requiredPages ?? [];
  const checks   = template.lintResultsJson?.checks ?? [];
  const accent   = templateAccent(template);

  return (
    <div className="group rounded-[--radius-lg] border border-border bg-surface overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 hover:border-border-focus/30">
      {/* Visual header */}
      <div className="relative h-28 bg-surface-raised overflow-hidden">
        <div className="absolute inset-0 p-4">
          <LayoutWireframe accent={accent} />
        </div>
        {/* Lint dot grid overlaid top-right */}
        {checks.length > 0 && (
          <div className="absolute top-2 right-2 bg-surface/80 backdrop-blur-sm rounded-[--radius] px-1.5 py-1">
            <LintDotGrid checks={checks} />
          </div>
        )}
        {/* Lint overall badge bottom-left */}
        <div className="absolute bottom-2 left-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              template.lintPassed
                ? "bg-success/15 text-success-text border-success/30"
                : "bg-destructive/15 text-destructive-text border-destructive/30",
            )}
          >
            {template.lintPassed ? (
              <CheckCircle className="size-2.5" />
            ) : (
              <XCircle className="size-2.5" />
            )}
            {template.lintPassed ? "Lint pass" : "Lint fail"}
          </span>
        </div>
        {/* Sites count badge bottom-right */}
        {template.sitesCount > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="text-[10px] font-medium bg-surface/80 backdrop-blur-sm text-text-tertiary px-2 py-0.5 rounded-full border border-border">
              {template.sitesCount} site{template.sitesCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Name + version */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary text-sm truncate">{template.manifestJson?.name ?? template.name}</p>
            <p className="text-[11px] mono text-text-tertiary mt-0.5">{template.name} · v{template.version}</p>
          </div>
          <span className="text-[10px] text-text-disabled mono shrink-0">{fmtDate(template.createdAt)}</span>
        </div>

        {/* Param type chips */}
        {params.length > 0 && <ParamChips params={params} />}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors w-full text-left flex items-center gap-1"
        >
          <span className="flex-1">{pages.length} required pages · {params.length} params</span>
          <span className="text-text-disabled">{expanded ? "▲" : "▼"}</span>
        </button>

        {/* Expanded: lint checks + pages */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border-subtle">
            {checks.length > 0 && (
              <div>
                <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider mb-2">Lint checks</p>
                <div className="space-y-1">
                  {checks.map((c) => (
                    <div key={c.name} className="flex items-start gap-2 text-xs">
                      {c.pass
                        ? <CheckCircle className="size-3 text-success-text shrink-0 mt-0.5" />
                        : <XCircle className="size-3 text-destructive-text shrink-0 mt-0.5" />
                      }
                      <div className="min-w-0">
                        <span className={cn("font-medium", c.pass ? "text-text-secondary" : "text-destructive-text")}>
                          {LINT_LABELS[c.name] ?? c.name}
                        </span>
                        <span className="text-text-tertiary ml-1.5 text-[10px]">{c.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pages.length > 0 && (
              <div>
                <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider mb-2">Required pages</p>
                <div className="flex flex-wrap gap-1">
                  {pages.map((pg) => (
                    <span key={pg} className="mono text-[10px] bg-surface-raised border border-border-subtle text-text-secondary px-1.5 py-0.5 rounded">
                      {pg}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {params.length > 0 && (
              <div>
                <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider mb-2">Parameters</p>
                <div className="space-y-1">
                  {params.map((p) => (
                    <div key={p.key} className="flex items-center justify-between text-xs">
                      <span className="mono text-text-secondary">{p.key}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-tertiary text-[10px]">{p.type}</span>
                        <Badge variant={p.required ? "warning" : "muted"} className="text-[10px]">
                          {p.required ? "required" : "optional"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Lint result display (post-upload) ───────────────────────────────────── */
function LintResultList({ checks }: { checks: LintCheck[] }) {
  return (
    <div className="rounded-[--radius] border border-border overflow-hidden">
      {checks.map((c, i) => (
        <div
          key={c.name}
          className={cn(
            "flex items-start gap-2.5 px-3 py-2.5 text-xs border-b border-border-subtle last:border-0",
            i % 2 === 0 ? "bg-surface" : "bg-surface-raised/40",
          )}
        >
          {c.pass
            ? <CheckCircle className="size-3.5 text-success-text shrink-0 mt-0.5" />
            : <XCircle className="size-3.5 text-destructive-text shrink-0 mt-0.5" />
          }
          <div>
            <span className={cn("font-medium", c.pass ? "text-text-secondary" : "text-destructive-text")}>
              {LINT_LABELS[c.name] ?? c.name}
            </span>
            <span className="text-text-tertiary ml-1.5">{c.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export function TemplatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  /* Dialog state */
  const [showRegister, setShowRegister] = useState(false);
  const [lintResult, setLintResult] = useState<LintCheck[] | null>(null);

  /* ZIP upload state */
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const zipInputRef = useRef<HTMLInputElement>(null);

  /* Directory state */
  const [templateDir, setTemplateDir] = useState("");
  const [dirError, setDirError] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: api.admin.templates,
  });

  /* ZIP upload mutation */
  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!zipFile) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", zipFile);
      return api.admin.uploadTemplate(form);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      setLintResult(data.lintResultsJson?.checks ?? []);
      setZipFile(null);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
      /* Try to parse lint results from API error body */
      try {
        const body = (err as { body?: { lint?: { checks: LintCheck[] } } }).body;
        if (body?.lint?.checks) setLintResult(body.lint.checks);
      } catch { /* no lint data */ }
    },
  });

  /* Directory mutation */
  const registerMutation = useMutation({
    mutationFn: () => api.admin.registerTemplate(templateDir.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      closeDialog();
    },
    onError: (err: Error) => setDirError(err.message),
  });

  function closeDialog() {
    setShowRegister(false);
    setZipFile(null);
    setLintResult(null);
    setUploadError("");
    setTemplateDir("");
    setDirError("");
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setZipFile(f); setUploadError(""); setLintResult(null); }
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Hugo templates</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Versioned Hugo themes used to provision new sites. Each template is linted for AdSense compliance before registration.
            {templates && <span className="ml-1 text-text-secondary">{templates.length} registered.</span>}
          </p>
        </div>
        {user?.role === "admin" && (
          <Button variant="primary" size="sm" onClick={() => setShowRegister(true)} className="shrink-0">
            <Plus className="size-3.5" />Add template
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <div className="h-28 bg-surface-raised border-b border-border-subtle" />
              <CardBody className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : !templates?.length ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<div className="size-10 opacity-30"><LayoutWireframe accent="var(--primary)" /></div>}
              title="No templates registered"
              description="Upload a Hugo template ZIP or register one from the server filesystem."
              action={
                user?.role === "admin" ? (
                  <Button variant="primary" size="sm" onClick={() => setShowRegister(true)}>
                    <Plus className="size-3.5" />Add template
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      )}

      {/* Register / Upload dialog */}
      <Dialog
        open={showRegister}
        onClose={closeDialog}
        title="Add Hugo template"
        description="Upload a .zip file or register from the server filesystem."
        size="md"
      >
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload ZIP</TabsTrigger>
            <TabsTrigger value="directory">From directory</TabsTrigger>
          </TabsList>

          {/* ── ZIP upload tab ─────────────────────────────────────────────── */}
          <TabsContent value="upload">
            <div className="space-y-4 pt-1">
              {!lintResult ? (
                <>
                  {/* Drop zone */}
                  {!zipFile ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex flex-col items-center justify-center border-2 border-dashed rounded-[--radius-md] px-6 py-10 text-center cursor-pointer transition-colors duration-150",
                        isDragging
                          ? "border-primary bg-primary-subtle/30"
                          : "border-border hover:border-primary/40 hover:bg-primary-subtle/20",
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={onDrop}
                      onClick={() => zipInputRef.current?.click()}
                      onKeyDown={(e) => e.key === "Enter" && zipInputRef.current?.click()}
                    >
                      <Upload className="size-7 text-text-tertiary mb-2.5 opacity-50" />
                      <p className="text-sm font-medium text-text-secondary">Drop a .zip file here</p>
                      <p className="text-xs text-text-tertiary mt-1">or click to browse</p>
                      <p className="text-[11px] text-text-disabled mt-2">
                        Zip must contain <code className="mono bg-surface-raised px-1 rounded">manifest.json</code> and
                        the full template directory structure
                      </p>
                      <input
                        ref={zipInputRef}
                        type="file"
                        accept=".zip"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setZipFile(f); setUploadError(""); }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-[--radius] bg-surface-raised border border-border px-3 py-2.5">
                      <File className="size-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{zipFile.name}</p>
                        <p className="text-xs text-text-tertiary">{(zipFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={() => { setZipFile(null); setUploadError(""); }}
                        className="text-text-tertiary hover:text-text-primary transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">
                      {uploadError}
                    </p>
                  )}

                  {/* Lint results from a failed upload */}
                  {lintResult && (
                    <div>
                      <p className="text-xs font-medium text-destructive-text mb-2">Lint failures:</p>
                      <LintResultList checks={lintResult} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="flex-1"
                      loading={uploadMutation.isPending}
                      disabled={!zipFile}
                      onClick={() => uploadMutation.mutate()}
                    >
                      <Upload className="size-3.5" />Upload & lint
                    </Button>
                    <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
                  </div>
                </>
              ) : (
                /* Success: show lint results */
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-success-text" />
                    <span className="font-medium text-text-primary text-sm">Template registered successfully</span>
                  </div>
                  <LintResultList checks={lintResult} />
                  <Button variant="primary" className="w-full" onClick={closeDialog}>Done</Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Directory tab ──────────────────────────────────────────────── */}
          <TabsContent value="directory">
            <div className="space-y-4 pt-1">
              <p className="text-xs text-text-secondary">
                Enter the directory name inside{" "}
                <code className="mono bg-surface-raised px-1 py-0.5 rounded">hugo-templates/</code> on the server.
                The template will be linted and registered.
              </p>
              <div>
                <Label htmlFor="tdir">Template directory</Label>
                <Input
                  id="tdir"
                  value={templateDir}
                  onChange={(e) => setTemplateDir(e.target.value)}
                  placeholder="default-blog-v1"
                  className="mono"
                />
              </div>
              {dirError && (
                <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">
                  {dirError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  loading={registerMutation.isPending}
                  disabled={!templateDir.trim()}
                  onClick={() => registerMutation.mutate()}
                >
                  Register & lint
                </Button>
                <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Dialog>
    </div>
  );
}
