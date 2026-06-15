import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ChevronLeft, CheckCircle, XCircle, Edit2, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fmt, fmtDatetime } from "@/lib/utils";

const REJECTION_REASONS = [
  "Off-topic or wrong niche",
  "Quality too low",
  "Duplicate content detected",
  "Policy violation",
  "Factual errors",
  "Poor structure",
];

function QualityGauge({ score, pass }: { score: number; pass: boolean }) {
  const pct = Math.round(score * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={pass ? "text-success-text font-medium mono text-sm" : "text-warning-text font-medium mono text-sm"}>
          {pct}%
        </span>
        <Badge variant={pass ? "success" : "warning"}>{pass ? "Pass" : "Fail"}</Badge>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pass ? "bg-success" : "bg-warning"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ReviewDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["review-article", jobId],
    queryFn: () => api.review.article(jobId!),
  });

  const [mode, setMode] = useState<"approve" | "reject" | "edit" | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [editedContent, setEditedContent] = useState("");

  const submitMutation = useMutation({
    mutationFn: () =>
      api.review.submit(
        jobId!,
        mode!,
        selectedReasons.length ? selectedReasons : undefined,
        mode === "edit" ? editedContent : undefined,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      navigate("/review");
    },
  });

  function toggleReason(r: string) {
    setSelectedReasons((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!data) return <p className="text-text-tertiary text-sm">Article not found.</p>;

  const { job, brief, reviews } = data;
  const qs = job.qualityScoresJson;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/review" className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-2 transition-colors">
            <ChevronLeft className="size-3" /> Review queue
          </Link>
          <h1 className="line-clamp-2">{job.title ?? "(untitled)"}</h1>
          <p className="text-xs text-text-tertiary mono mt-0.5">/{job.slug ?? "—"}</p>
        </div>
        <Link
          to={`/articles/${jobId}/edit`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-[--radius] text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-border transition-colors shrink-0 mt-6"
        >
          <Pencil className="size-3.5" />Open editor
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main: article */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              {mode === "edit" && <TabsTrigger value="edit">Edit</TabsTrigger>}
              <TabsTrigger value="brief">Brief</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <Card>
                <CardBody>
                  <div className="article-prose">
                    <ReactMarkdown>{job.draftMd ?? "*No content.*"}</ReactMarkdown>
                  </div>
                </CardBody>
              </Card>
            </TabsContent>

            {mode === "edit" && (
              <TabsContent value="edit">
                <Card>
                  <CardBody>
                    <Textarea
                      value={editedContent || (job.draftMd ?? "")}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[500px] text-xs"
                      placeholder="Edit the markdown…"
                    />
                  </CardBody>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="brief">
              <Card>
                <CardBody className="space-y-3 text-sm">
                  <div>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Target keyword</p>
                    <p className="mono text-text-secondary">{brief.outlineJson.targetKeyword}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Intent</p>
                    <p className="text-text-secondary">{brief.outlineJson.intent}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Outline</p>
                    <ul className="space-y-1">
                      {brief.outlineJson.headings.map((h, i) => (
                        <li key={i} className="text-text-secondary text-xs">
                          <span className="text-text-disabled mono mr-2">{(i + 1).toString().padStart(2, "0")}</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {brief.outlineJson.keywords.length > 0 && (
                    <div>
                      <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brief.outlineJson.keywords.map((kw) => (
                          <Badge key={kw} variant="muted">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: quality + actions */}
        <div className="space-y-4">
          {/* Quality scores */}
          {qs && (
            <Card>
              <CardHeader><CardTitle>Quality scores</CardTitle></CardHeader>
              <CardBody className="space-y-4">
                <QualityGauge score={qs.overall} pass={qs.pass} />
                <div className="space-y-2.5 pt-1 border-t border-border-subtle">
                  <ScoreRow label="Duplication" value={`${fmt(qs.duplication.maxSimilarity * 100, 0)}% sim`} pass={qs.duplication.pass} />
                  <ScoreRow label="Readability" value={`Flesch ${fmt(qs.readability.fleschReadingEase, 0)}`} pass={qs.readability.pass} />
                  <ScoreRow label="Policy" value={qs.policy.forbiddenTopicHits.length ? qs.policy.forbiddenTopicHits.join(", ") : "Clean"} pass={qs.policy.pass} />
                  <ScoreRow label="Critic" value={`${fmt(qs.critic.score * 100, 0)}/100`} pass={qs.critic.pass} />
                </div>
                {job.critique && (
                  <div className="pt-2 border-t border-border-subtle">
                    <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1.5">LLM critique</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{job.critique}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Review actions */}
          <Card>
            <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {!mode ? (
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => submitMutation.mutate()}
                    loading={submitMutation.isPending}
                  >
                    <CheckCircle className="size-3.5" />Approve & publish
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setMode("edit"); setEditedContent(job.draftMd ?? ""); }}
                  >
                    <Edit2 className="size-3.5" />Edit & approve
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive-text hover:text-destructive-text hover:bg-destructive-subtle"
                    onClick={() => setMode("reject")}
                  >
                    <XCircle className="size-3.5" />Reject
                  </Button>
                </div>
              ) : mode === "reject" ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-text-secondary">Select reasons:</p>
                  <div className="space-y-1.5">
                    {REJECTION_REASONS.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedReasons.includes(r)}
                          onChange={() => toggleReason(r)}
                          className="accent-primary"
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      loading={submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                    >
                      Confirm reject
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-tertiary">Edit the article in the preview tab, then submit.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      loading={submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                    >
                      Submit edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* History */}
          {reviews.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Review history</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={r.decision === "approve" ? "success" : r.decision === "reject" ? "destructive" : "info"}>
                        {r.decision}
                      </Badge>
                      <span className="text-text-tertiary mono">{fmtDatetime(r.at)}</span>
                    </div>
                    {r.reasonsJson?.length ? (
                      <p className="text-text-tertiary mt-1 pl-1">{r.reasonsJson.join(", ")}</p>
                    ) : null}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-tertiary">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="mono text-text-secondary">{value}</span>
        {pass
          ? <CheckCircle className="size-3 text-success-text" />
          : <XCircle className="size-3 text-destructive-text" />
        }
      </div>
    </div>
  );
}
