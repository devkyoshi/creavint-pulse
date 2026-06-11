import { spawn } from "node:child_process";
import { config } from "../../config.ts";

export function vpsConfigured(): boolean {
  return Boolean(config.ORIGIN_VPS_HOST && config.ORIGIN_VPS_SSH_KEY);
}

/** Run a command on the origin VPS over SSH; resolves stdout, rejects on non-zero exit. */
export function runRemote(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      config.ORIGIN_VPS_SSH_KEY!,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "BatchMode=yes",
      `${config.ORIGIN_VPS_USER}@${config.ORIGIN_VPS_HOST}`,
      command,
    ];
    const proc = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`ssh exited ${code}: ${err || out}`));
    });
  });
}

/** Write a file on the origin VPS (vhost configs) via stdin + tee. */
export async function writeRemoteFile(remotePath: string, content: string): Promise<void> {
  const b64 = Buffer.from(content, "utf8").toString("base64");
  await runRemote(`echo '${b64}' | base64 -d | sudo tee '${remotePath}' > /dev/null`);
}
