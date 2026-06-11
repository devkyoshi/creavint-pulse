import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { contentBriefs, contentJobs, reviews, type ContentJob } from "../db/schema.ts";
import { enqueueContentStage } from "../jobs/enqueue.ts";
import { writeAudit } from "./audit.ts";
import type { ReviewRequest } from "../types.ts";

export async function submitReview(
  jobId: string,
  reviewerId: string,
  req: ReviewRequest,
): Promise<ContentJob> {
  const [job] = await db.select().from(contentJobs).where(eq(contentJobs.id, jobId)).limit(1);
  if (!job) throw new Error("content job not found");
  if (job.state !== "in_review") throw new Error(`job is not in review (state: ${job.state})`);

  await db.insert(reviews).values({
    jobId,
    reviewerId,
    decision: req.decision,
    reasonsJson: req.reasons ?? [],
    editedDiff: req.decision === "edit" ? req.editedContent ?? null : null,
  });

  let updated = job;
  if (req.decision === "reject") {
    [updated] = (await db
      .update(contentJobs)
      .set({ state: "rejected" })
      .where(eq(contentJobs.id, jobId))
      .returning()) as [ContentJob];
    await db.update(contentBriefs).set({ status: "cancelled" }).where(eq(contentBriefs.id, job.briefId));
  } else {
    if (req.decision === "edit") {
      if (!req.editedContent) throw new Error("editedContent required for edit decision");
      [updated] = (await db
        .update(contentJobs)
        .set({ draftMd: req.editedContent })
        .where(eq(contentJobs.id, jobId))
        .returning()) as [ContentJob];
    }
    await enqueueContentStage("PUBLISH", jobId, { priority: 1 });
  }

  await writeAudit({
    actorId: reviewerId,
    action: `review.${req.decision}`,
    entityType: "content_job",
    entityId: jobId,
    after: { reasons: req.reasons ?? [] },
  });
  return updated;
}
