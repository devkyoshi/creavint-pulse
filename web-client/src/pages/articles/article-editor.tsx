import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Save, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownEditor } from "@/components/markdown-editor";
import { JobStateBadge } from "@/components/state-badge";
import { relativeTime } from "@/lib/utils";

function buildInitialMd(job: {
  draftMd: string | null;
  title: string | null;
  slug: string | null;
  metaDescription: string | null;
  createdAt: string;
}): string {
  if (!job.draftMd) return "";

  const hasFm = /^---\n[\s\S]*?\n---/.test(job.draftMd);
  if (hasFm) return job.draftMd;

  /* Prepend reconstructed frontmatter when SEO_PASS has run */
  if (job.title && job.slug) {
    const date = job.createdAt.slice(0, 10);
    const fm = [
      "---",
      `title: "${job.title.replace(/"/g, '\\"')}"`,
      `slug: "${job.slug}"`,
      job.metaDescription ? `description: "${job.metaDescription.replace(/"/g, '\\"')}"` : `description: ""`,
      `date: "${date}"`,
      "---",
      "",
    ].join("\n");
    return fm + job.draftMd;
  }

  return job.draftMd;
}

export function ArticleEditorPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["review-article", jobId],
    queryFn: () => api.review.article(jobId!),
  });

  const [md, setMd] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (data?.job) {
      setMd(buildInitialMd(data.job));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) => api.articles.saveDraft(jobId!, md, submit),
    onSuccess: (result, submit) => {
      qc.invalidateQueries({ queryKey: ["review-article", jobId] });
      if (submit) {
        navigate("/review");
      } else {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    },
    onError: () => setSaveStatus("error"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!data) return <p className="text-text-tertiary text-sm">Article not found.</p>;

  const { job } = data;
  const isSubmittable = !["published", "indexed", "rejected"].includes(job.state);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/review"
            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-2 transition-colors"
          >
            <ChevronLeft className="size-3" /> Review queue
          </Link>
          <h1 className="line-clamp-1">{job.title ?? "Untitled article"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <JobStateBadge state={job.state} />
            <span className="text-xs text-text-tertiary">{relativeTime(job.createdAt)}</span>
            {job.slug && <span className="text-xs mono text-text-disabled">/{job.slug}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-6">
          {saveStatus === "saved" && (
            <Badge variant="success" className="text-[10px]">Saved</Badge>
          )}
          {saveStatus === "error" && (
            <Badge variant="destructive" className="text-[10px]">Save failed</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            loading={saveMutation.isPending && !saveMutation.variables}
            onClick={() => saveMutation.mutate(false)}
          >
            <Save className="size-3.5" />Save draft
          </Button>
          {isSubmittable && (
            <Button
              variant="primary"
              size="sm"
              loading={saveMutation.isPending && !!saveMutation.variables}
              onClick={() => saveMutation.mutate(true)}
            >
              <Send className="size-3.5" />Submit for review
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardBody className="py-3">
          <div className="flex items-start gap-4 flex-wrap text-xs text-text-tertiary">
            <p>
              Edit the markdown below. The left pane is the raw source; the right pane shows a live preview.
              <strong className="text-text-secondary font-medium"> Save draft</strong> preserves edits without changing state.
              <strong className="text-text-secondary font-medium"> Submit for review</strong> moves the article to the review queue.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Editor */}
      <MarkdownEditor
        value={md}
        onChange={setMd}
        onFileImport={(content) => setMd(content)}
        minHeight={560}
      />
    </div>
  );
}
