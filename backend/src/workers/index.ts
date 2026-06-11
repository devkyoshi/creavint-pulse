import type { Worker } from "bullmq";
import { startProvisioningWorker } from "./provisioning.ts";
import { startContentWorker } from "./content.ts";
import { startSeoWorker } from "./seo.ts";
import { startAnalyticsWorker } from "./analytics.ts";
import { startScheduler } from "../scheduler/index.ts";

export function startAllWorkers(): Worker[] {
  const workers = [
    startProvisioningWorker(),
    startContentWorker(),
    startSeoWorker(),
    startAnalyticsWorker(),
  ];
  for (const w of workers) {
    w.on("failed", (job, err) => {
      console.error(`[${w.name}] job ${job?.name}#${job?.id} failed: ${err.message}`);
    });
    w.on("completed", (job) => {
      console.log(`[${w.name}] job ${job.name}#${job.id} completed`);
    });
  }
  console.log("workers started: provisioning, content, seo, analytics");
  return workers;
}

// Standalone worker entry: `pnpm --filter @creavint/backend workers`
const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("workers/index.ts");
if (isMain) {
  startAllWorkers();
  startScheduler().catch((e) => {
    console.error("scheduler failed to start:", e);
    process.exit(1);
  });
}
