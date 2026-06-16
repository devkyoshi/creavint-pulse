import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, X, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, slugify } from "@/lib/utils";
import type { ScaffoldTemplatePayload, Template, TemplateParameter } from "@/lib/types";

const PARAM_TYPES = ["string", "color", "url", "boolean", "number"] as const;

const BASE_PARAMS: TemplateParameter[] = [
  { key: "primaryColor",  label: "Primary color",               type: "color",   required: false, default: "#1a73e8" },
  { key: "logoUrl",       label: "Logo URL",                    type: "url",     required: false, default: "" },
  { key: "description",   label: "Site tagline",                type: "string",  required: true,  default: "" },
  { key: "showAuthorBox", label: "Show author box on articles", type: "boolean", required: false, default: true },
];

const TYPE_COLOR: Record<string, string> = {
  color:   "bg-purple-subtle text-purple-text border-purple/20",
  url:     "bg-info-subtle text-info-text border-info/20",
  boolean: "bg-success-subtle text-success-text border-success/20",
  number:  "bg-warning-subtle text-warning-text border-warning/20",
  string:  "bg-surface-raised text-text-secondary border-border",
};

const COL_TEMPLATE = "120px 1fr 100px 150px 68px 28px";

export function TemplateNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: existingTemplates } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: api.admin.templates,
  });

  const baseTemplate = existingTemplates?.find((t) => t.name === "default-blog-v1");
  const initialParams: TemplateParameter[] =
    baseTemplate?.manifestJson?.parameters?.map((p) => ({
      key: p.key,
      label: p.label,
      type: p.type as TemplateParameter["type"],
      required: p.required,
      default: p.default as TemplateParameter["default"],
    })) ?? BASE_PARAMS;

  const [displayName, setDisplayName] = useState("");
  const [name, setName]               = useState("");
  const [nameManual, setNameManual]   = useState(false);
  const [version, setVersion]         = useState("1.0.0");
  const [params, setParams]           = useState<TemplateParameter[]>(initialParams);
  const [error, setError]             = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ScaffoldTemplatePayload = {
        name: name.trim(),
        displayName: displayName.trim(),
        version: version.trim(),
        parameters: params.filter((p) => p.key.trim()),
      };
      return api.admin.scaffoldTemplate(payload);
    },
    onSuccess: (data: Template) => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      navigate("/templates", { state: { created: data.id } });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onDisplayNameChange(v: string) {
    setDisplayName(v);
    if (!nameManual) setName(slugify(v));
  }

  function addParam() {
    setParams((ps) => [...ps, { key: "", label: "", type: "string", required: false, default: "" }]);
  }

  function removeParam(i: number) {
    setParams((ps) => ps.filter((_, idx) => idx !== i));
  }

  function updateParam(i: number, patch: Partial<TemplateParameter>) {
    setParams((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  const canSubmit =
    !!displayName.trim() &&
    !!name.trim() &&
    /^\d+\.\d+\.\d+$/.test(version.trim()) &&
    !mutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors mb-4"
        >
          <ChevronLeft className="size-4" />Back to templates
        </Link>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">New template</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Scaffolds a new Hugo template by cloning{" "}
          <span className="mono text-[12px] bg-surface-raised px-1.5 py-0.5 rounded border border-border-subtle">
            default-blog-v1
          </span>{" "}
          as the base and applying your customizations.
        </p>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid gap-8 items-start" style={{ gridTemplateColumns: "260px 1fr" }}>

        {/* Left: metadata + info + actions */}
        <div className="space-y-6">

          {/* Metadata card */}
          <div className="rounded-[--radius-lg] border border-border bg-surface p-5 space-y-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Template metadata
            </p>
            <div>
              <Label htmlFor="sc-display">Display name</Label>
              <Input
                id="sc-display"
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder="Tech Blog"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-name">
                Template ID <span className="text-text-disabled font-normal">(slug)</span>
              </Label>
              <Input
                id="sc-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameManual(true); }}
                placeholder="tech-blog-v1"
                className="mono mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-ver">Version</Label>
              <Input
                id="sc-ver"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="mono mt-1"
              />
            </div>
          </div>

          {/* Inherited from base */}
          <div className="rounded-[--radius-lg] border border-border bg-surface p-5 space-y-3">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Inherited from base
            </p>
            <p className="text-[11px] mono text-primary font-medium">default-blog-v1</p>
            <div className="space-y-2">
              {[
                "All 8 lint checks pass",
                "6 trust pages (about, contact, privacy, terms, editorial-policy, author)",
                "GTM · AdSense · Schema.org partials",
                "Sitemap · RSS · ads.txt",
                "Preview page generated with your colors",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-text-secondary">
                  <CheckCircle className="size-3 text-success-text shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              loading={mutation.isPending}
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
            >
              Create template
            </Button>
            <Button variant="ghost" onClick={() => navigate("/templates")}>
              Cancel
            </Button>
          </div>

        </div>
        {/* /Left */}

        {/* Right: parameters */}
        <div className="rounded-[--radius-lg] border border-border bg-surface p-5 space-y-4 min-w-0">

          {/* Section header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Parameters</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Pre-filled from the base template. Edit defaults, toggle required, or add new ones.
                These become the configurable variables when provisioning a site.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={addParam} className="shrink-0">
              <Plus className="size-3.5" />Add parameter
            </Button>
          </div>

          {/* Scroll wrapper so table never clips the card */}
          <div className="overflow-x-auto -mx-5 px-5 pb-1">
            <div className="min-w-[560px] space-y-2">

              {/* Column headers */}
              <div
                className="grid gap-2 px-1"
                style={{ gridTemplateColumns: COL_TEMPLATE }}
              >
                {["Key", "Label", "Type", "Default value", "Required", ""].map((h) => (
                  <p key={h} className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider">
                    {h}
                  </p>
                ))}
              </div>

              {/* Parameter rows */}
              {params.map((p, i) => (
                <div
                  key={i}
                  className="grid gap-2 items-center px-3 py-2.5 rounded-[--radius] bg-surface-raised border border-border-subtle hover:border-border transition-colors"
                  style={{ gridTemplateColumns: COL_TEMPLATE }}
                >
                  <Input
                    value={p.key}
                    onChange={(e) => updateParam(i, { key: e.target.value })}
                    placeholder="paramKey"
                    className="mono text-xs h-8"
                  />
                  <Input
                    value={p.label}
                    onChange={(e) => updateParam(i, { label: e.target.value })}
                    placeholder="Display label"
                    className="text-xs h-8"
                  />
                  <select
                    value={p.type}
                    onChange={(e) =>
                      updateParam(i, { type: e.target.value as TemplateParameter["type"], default: "" })
                    }
                    className={cn(
                      "text-xs h-8 px-2 rounded-[--radius] border font-medium",
                      TYPE_COLOR[p.type] ?? TYPE_COLOR.string,
                    )}
                  >
                    {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {p.type === "color" ? (
                    <div className="flex items-center gap-2 h-8 min-w-0">
                      <input
                        type="color"
                        value={typeof p.default === "string" && p.default.startsWith("#") ? p.default : "#1a73e8"}
                        onChange={(e) => updateParam(i, { default: e.target.value })}
                        className="h-7 w-9 rounded border border-border cursor-pointer bg-surface shrink-0"
                      />
                      <span className="mono text-[11px] text-text-secondary truncate">
                        {typeof p.default === "string" ? p.default : ""}
                      </span>
                    </div>
                  ) : p.type === "boolean" ? (
                    <div className="flex items-center gap-2 h-8">
                      <input
                        type="checkbox"
                        checked={p.default === true || p.default === "true"}
                        onChange={(e) => updateParam(i, { default: e.target.checked })}
                        className="accent-primary size-4 shrink-0"
                      />
                      <span className="text-xs text-text-secondary">
                        {p.default === true || p.default === "true" ? "true" : "false"}
                      </span>
                    </div>
                  ) : (
                    <Input
                      value={typeof p.default === "string" ? p.default : ""}
                      onChange={(e) => updateParam(i, { default: e.target.value })}
                      placeholder="default value"
                      className="text-xs h-8"
                    />
                  )}

                  <div className="flex items-center justify-center h-8">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!p.required}
                        onChange={(e) => updateParam(i, { required: e.target.checked })}
                        className="accent-primary size-3.5"
                      />
                      <span className="text-[11px] text-text-tertiary">req</span>
                    </label>
                  </div>

                  <button
                    onClick={() => removeParam(i)}
                    className="flex items-center justify-center text-text-disabled hover:text-destructive-text transition-colors h-8 w-7"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Empty state */}
              {params.length === 0 && (
                <div className="text-center py-10 border border-dashed border-border-subtle rounded-[--radius]">
                  <p className="text-sm text-text-disabled">No parameters defined</p>
                  <button onClick={addParam} className="text-xs text-primary mt-1.5 hover:underline">
                    Add a parameter
                  </button>
                </div>
              )}

            </div>
          </div>
          {/* /scroll wrapper */}

        </div>
        {/* /Right */}

      </div>
      {/* /grid */}

    </div>
  );
}
