import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { QualityScores } from "@/lib/types";

const REJECTION_REASONS = [
  "factual_accuracy",
  "thin_content",
  "off_topic",
  "tone_mismatch",
  "duplicate_angle",
  "policy_violation",
  "poor_structure",
  "weak_faq",
] as const;

function ScoreRow({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
          pass ? "bg-success-subtle text-success-text" : "bg-destructive-subtle text-destructive-text",
        )}
      >
        {pass ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <div>
        <p className="text-sm leading-tight font-medium">{label}</p>
        <p className="text-xs text-text-secondary">{detail}</p>
      </div>
    </li>
  );
}

function QualityPanel({ scores }: { scores: QualityScores }) {
  return (
    <ul className="space-y-2.5">
      <ScoreRow
        label="Duplication"
        pass={scores.duplication.pass}
        detail={`max similarity ${scores.duplication.maxSimilarity} (fail â‰¥ 0.85)`}
      />
      <ScoreRow
        label="Readability"
        pass={scores.readability.pass}
        detail={`Flesch ${scores.readability.fleschReadingEase}`}
      />
      <ScoreRow
        label="Policy compliance"
        pass={scores.policy.pass}
        detail={
          scores.policy.pass
            ? "no violations"
            : [
                scores.policy.forbiddenTopicHits.length > 0 && `forbidden: ${scores.policy.forbiddenTopicHits.join(", ")}`,
                scores.policy.ymylDetected && "YMYL content detected",
              ]
                .filter(Boolean)
                .join("; ")
        }
      />
      <ScoreRow
        label={`Critic (${scores.critic.source})`}
        pass={scores.critic.pass}
        detail={`${scores.critic.score}/100${scores.critic.issues.length > 0 ? ` â€” ${scores.critic.issues.join("; ")}` : ""}`}
      />
    </ul>
  );
}

export function ReviewDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["review", jobId],
    queryFn: () => api.review.article(jobId),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: (vars: { decision: "approve" | "reject" | "edit"; reasons?: string[]; editedContent?: string }) =>
      api.review.submit(jobId, vars.decision, vars.reasons, vars.editedContent),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.decision === "reject" ? "Article rejected" : "Approved â€” publish stage enqueued",
      );
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      navigate("/review");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const { job, brief, reviews } = data;
  const inReview = job.state === "in_review";
  const body = edited ?? job.draftMd ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title ?? "Untitled draft"}
        description={`Target keyword: ${brief.outlineJson.targetKeyword} Â· intent: ${brief.outlineJson.intent}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/review">
                <ArrowLeft className="size-4" />
                Queue
              </Link>
            </Button>
            {inReview && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                  <Pencil className="size-4" />
                  {editing ? "Preview" : "Edit"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                  <X className="size-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={submitMutation.isPending}
                  onClick={() =>
                    edited !== null && edited !== job.draftMd
                      ? submitMutation.mutate({ decision: "edit", editedContent: edited })
                      : submitMutation.mutate({ decision: "approve" })
                  }
                >
                  <Check className="size-4" />
                  {edited !== null && edited !== job.draftMd ? "Approve with edits" : "Approve & publish"}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Quality gate</CardTitle>
              {job.qualityScoresJson && (
                <Badge variant="secondary" className="tabular-nums">
                  Overall {job.qualityScoresJson.overall}/100
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {job.qualityScoresJson ? (
                <QualityPanel scores={job.qualityScoresJson} />
              ) : (
                <p className="text-sm text-text-secondary">No quality scores recorded.</p>
              )}
              {job.critique && (
                <p className="mt-3 rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-text">{job.critique}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-text-secondary">Keywords</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {brief.outlineJson.keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="font-normal">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
              {brief.internalLinkCandidatesJson.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-secondary">Internal link candidates</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-text-secondary">
                    {brief.internalLinkCandidatesJson.map((l) => (
                      <li key={l.slug}>{l.title}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-xs text-text-secondary">
                Kind: {brief.kind} Â· model: {job.modelUsed ?? "â€”"} Â· cost: ${job.tokenCostUsd.toFixed(3)}
              </div>
            </CardContent>
          </Card>

          {reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Review history</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {reviews.map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <span className="capitalize">{r.decision}</span>
                      <span className="text-xs text-text-secondary">
                        {(r.reasonsJson ?? []).join(", ") || "â€”"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{editing ? "Edit markdown" : "Article preview"}</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={body}
                onChange={(e) => setEdited(e.target.value)}
                rows={28}
                className="font-mono text-xs leading-relaxed"
              />
            ) : (
              <ScrollArea className="h-[36rem] pr-4">
                <article className="prose-sm max-w-none space-y-3 text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </article>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject article</DialogTitle>
            <DialogDescription>
              Structured reasons feed back into prompt templates â€” pick everything that applies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5 py-2">
            {REJECTION_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={reasons.includes(reason)}
                  onCheckedChange={(v) =>
                    setReasons((prev) => (v ? [...prev, reason] : prev.filter((r) => r !== reason)))
                  }
                />
                {reason.replace(/_/g, " ")}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reasons.length === 0 || submitMutation.isPending}
              onClick={() => submitMutation.mutate({ decision: "reject", reasons })}
            >
              Reject article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

