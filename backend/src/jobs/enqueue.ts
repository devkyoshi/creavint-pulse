import { analyticsQueue, contentQueue, provisioningQueue, seoQueue } from "./queues.ts";
import type {
  AnalyticsJobName,
  ContentStage,
  ProvisioningPayload,
  SeoJobName,
} from "./types.ts";

export async function enqueueProvisioning(siteId: string): Promise<string> {
  // jobId = siteId → duplicate enqueue while one is active/waiting is a no-op
  const job = await provisioningQueue.add(
    "PROVISIONING",
    { siteId } satisfies ProvisioningPayload,
    { jobId: `provision:${siteId}:${Date.now()}` },
  );
  return job.id!;
}

export async function enqueueContentStage(
  stage: Exclude<ContentStage, "CADENCE_TICK">,
  contentJobId: string,
  opts?: { priority?: number; delayMs?: number },
): Promise<void> {
  await contentQueue.add(
    stage,
    { contentJobId },
    {
      // Stage-scoped jobId keeps retries idempotent: re-enqueueing the same
      // stage for the same content job while it is pending is a no-op.
      jobId: `${stage}:${contentJobId}:${Date.now()}`,
      priority: opts?.priority,
      delay: opts?.delayMs,
    },
  );
}

export async function enqueueCadenceTick(siteId: string): Promise<void> {
  await contentQueue.add("CADENCE_TICK", { siteId });
}

export async function enqueueSeoJob(name: SeoJobName, payload: object): Promise<void> {
  await seoQueue.add(name, payload);
}

export async function enqueueAnalyticsJob(name: AnalyticsJobName, payload: object = {}): Promise<void> {
  await analyticsQueue.add(name, payload);
}
