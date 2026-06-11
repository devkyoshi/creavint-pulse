import { buildApp } from "./app.ts";
import { config } from "./config.ts";
import { startAllWorkers } from "./workers/index.ts";
import { startScheduler } from "./scheduler/index.ts";

async function main() {
  const app = await buildApp();

  if (config.WORKERS_INLINE) {
    startAllWorkers();
    await startScheduler();
  }

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  console.log(`Creavint Pulse API listening on http://${config.API_HOST}:${config.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
