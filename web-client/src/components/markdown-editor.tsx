import { useRef, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, FileText, Upload } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/* ─── Copy button ─────────────────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* browser blocked */ }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-[--radius] text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
      title="Copy markdown"
    >
      {copied ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy MD"}
    </button>
  );
}

/* ─── Frontmatter badge ───────────────────────────────────────────────────── */
function FrontmatterBadge({ value }: { value: string }) {
  const has = /^---\n[\s\S]*?\n---/.test(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
        has
          ? "bg-success-subtle text-success-text border-success/20"
          : "bg-warning-subtle text-warning-text border-warning/20",
      )}
    >
      {has ? "FM ✓" : "No FM"}
    </span>
  );
}

/* ─── Word count ──────────────────────────────────────────────────────────── */
function wordCount(md: string): number {
  const body = md.replace(/^---\n[\s\S]*?\n---\n?/, "");
  return body.trim().split(/\s+/).filter(Boolean).length;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
export interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  onFileImport?: (content: string, filename: string) => void;
  className?: string;
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your article in markdown…",
  minHeight = 480,
  onFileImport,
  className,
}: MarkdownEditorProps) {
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) { alert("File must be under 512 KB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string ?? "";
      if (onFileImport) onFileImport(text, file.name);
      else onChange(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [onChange, onFileImport]);

  const wc = wordCount(value);

  return (
    <div className={cn("flex flex-col border border-border rounded-[--radius-lg] overflow-hidden", className)}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-surface-raised shrink-0">
        <div className="flex items-center gap-2">
          <FrontmatterBadge value={value} />
          <span className="text-[11px] text-text-tertiary mono">{wc.toLocaleString()} words</span>
        </div>
        <div className="flex items-center gap-1">
          {onFileImport !== undefined && (
            <>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-[--radius] text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
                title="Import .md file"
              >
                <Upload className="size-3.5" />Import
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".md,text/markdown"
                className="sr-only"
                onChange={handleImport}
              />
            </>
          )}
          <CopyButton text={value} />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-col lg:flex-row flex-1 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Source */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-1.5 bg-surface border-b border-border-subtle shrink-0">
            <span className="text-[10px] font-semibold text-text-disabled uppercase tracking-widest">Markdown</span>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(
              "flex-1 w-full resize-none bg-surface text-sm text-text-primary leading-relaxed",
              "font-mono p-4 focus:outline-none",
              "placeholder:text-text-disabled",
            )}
            style={{ minHeight }}
          />
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-1.5 bg-surface border-b border-border-subtle shrink-0">
            <span className="text-[10px] font-semibold text-text-disabled uppercase tracking-widest">Preview</span>
          </div>
          <div
            className="flex-1 overflow-auto p-4"
            style={{ minHeight }}
          >
            {value.trim() ? (
              <div className="article-prose text-sm leading-relaxed">
                <ReactMarkdown>{value}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <FileText className="size-8 text-text-tertiary opacity-20 mb-3" />
                <p className="text-xs text-text-disabled">Preview will appear here as you write</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
