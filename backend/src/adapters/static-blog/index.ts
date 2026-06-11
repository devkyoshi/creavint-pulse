import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { contentStore } from "../../integrations/git/contentStore.ts";
import type {
  CanonicalContent,
  ChannelAdapter,
  ChannelMetrics,
  ContentKind,
  PublishReceipt,
} from "../../types.ts";

interface StaticBlogPayload {
  siteSlug: string;
  relPath: string; // path inside the site dir, e.g. content/posts/foo.md
  fileContent: string;
  commitMessage: string;
}

/**
 * Phase 1 channel adapter: canonical content → markdown file with YAML
 * frontmatter, committed to the git content store. CI builds Hugo from there.
 */
export class StaticBlogAdapter implements ChannelAdapter {
  capabilities(): ContentKind[] {
    return ["article"];
  }

  async transform(
    content: CanonicalContent,
    channelConfig: Record<string, unknown>,
  ): Promise<StaticBlogPayload> {
    const siteSlug = String(channelConfig.siteSlug);
    const frontmatter = YAML.stringify({
      title: content.title,
      slug: content.slug,
      description: content.description,
      date: new Date().toISOString(),
      draft: false,
      ...content.frontmatter,
    });
    let body = content.bodyMarkdown;
    if (content.mediaRefs.length > 0) {
      const hero = content.mediaRefs[0]!;
      body = `![${hero.alt}](${hero.url})\n\n${body}`;
    }
    return {
      siteSlug,
      relPath: path.posix.join("content", "posts", `${content.slug}.md`),
      fileContent: `---\n${frontmatter}---\n\n${body}\n`,
      commitMessage: `content(${siteSlug}): publish "${content.title}"`,
    };
  }

  async publish(payload: unknown): Promise<PublishReceipt> {
    const p = payload as StaticBlogPayload;
    await contentStore.pull();
    const absPath = path.join(contentStore.siteDir(p.siteSlug), p.relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, p.fileContent, "utf8");
    await contentStore.commitAndPush(p.commitMessage);
    return {
      channel: "static-blog",
      externalRef: path.posix.join(p.siteSlug, p.relPath),
      publishedAt: new Date().toISOString(),
    };
  }

  async metrics(since: Date): Promise<ChannelMetrics> {
    // Static blogs report through GA4/GSC/AdSense ingestion, not the adapter.
    return { channel: "static-blog", since: since.toISOString(), metrics: {} };
  }
}

export const staticBlogAdapter = new StaticBlogAdapter();
