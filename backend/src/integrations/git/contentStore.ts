import fs from "node:fs";
import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { config } from "../../config.ts";

/**
 * The git content store (sites/ monorepo). When GIT_REPO_URL is set the local
 * path is a clone that is pulled before writes and pushed after commits; when
 * unset (dev/pilot bootstrap) it operates on a local-only repo.
 */
class ContentStore {
  readonly repoPath = config.sitesRepoLocalPath;
  private git: SimpleGit | null = null;
  private ready = false;

  private sshEnv(): Record<string, string> {
    if (!config.GIT_SERVICE_ACCOUNT_KEY) return {};
    return {
      GIT_SSH_COMMAND: `ssh -i "${config.GIT_SERVICE_ACCOUNT_KEY}" -o StrictHostKeyChecking=accept-new`,
    };
  }

  async ensureReady(): Promise<SimpleGit> {
    if (this.ready && this.git) return this.git;
    fs.mkdirSync(this.repoPath, { recursive: true });

    const isRepo = fs.existsSync(path.join(this.repoPath, ".git"));
    if (!isRepo && config.GIT_REPO_URL) {
      await simpleGit({ baseDir: path.dirname(this.repoPath) })
        .env(this.sshEnv())
        .clone(config.GIT_REPO_URL, this.repoPath);
    }
    this.git = simpleGit({ baseDir: this.repoPath }).env(this.sshEnv());
    if (!isRepo && !config.GIT_REPO_URL) {
      await this.git.init();
    }
    this.ready = true;
    return this.git;
  }

  async pull(): Promise<void> {
    const git = await this.ensureReady();
    if (config.GIT_REPO_URL) {
      await git.pull(["--rebase", "--autostash"]).catch((e) => {
        // First push hasn't happened yet on a fresh remote — tolerable.
        console.warn(`content store pull failed (continuing): ${e.message}`);
      });
    }
  }

  async commitAndPush(message: string): Promise<void> {
    const git = await this.ensureReady();
    await git.add(["-A"]);
    const status = await git.status();
    if (status.files.length === 0 && status.staged.length === 0) return;
    await git
      .addConfig("user.email", "pulse-bot@creavint.com")
      .addConfig("user.name", "Creavint Pulse");
    await git.commit(message);
    if (config.GIT_REPO_URL) {
      await git.push(["-u", "origin", "HEAD"]);
    }
  }

  siteDir(slug: string): string {
    return path.join(this.repoPath, slug);
  }
}

export const contentStore = new ContentStore();
