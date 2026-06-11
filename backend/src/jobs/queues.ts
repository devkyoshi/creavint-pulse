import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.ts";
import type { QueueName } from "./types.ts";

export const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

function makeQueue(name: QueueName): Queue {
  return new Queue(name, { connection: redis, defaultJobOptions });
}

export const provisioningQueue = makeQueue("provisioning");
export const contentQueue = makeQueue("content");
export const seoQueue = makeQueue("seo");
export const analyticsQueue = makeQueue("analytics");

export const allQueues: Queue[] = [provisioningQueue, contentQueue, seoQueue, analyticsQueue];

const KILL_SWITCH_KEY = "creavint:kill-switch";

export async function activateKillSwitch(): Promise<void> {
  await redis.set(KILL_SWITCH_KEY, new Date().toISOString());
  await Promise.all(allQueues.map((q) => q.pause()));
}

export async function releaseKillSwitch(): Promise<void> {
  await redis.del(KILL_SWITCH_KEY);
  await Promise.all(allQueues.map((q) => q.resume()));
}

export async function killSwitchActive(): Promise<string | null> {
  return redis.get(KILL_SWITCH_KEY);
}
