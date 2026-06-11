import crypto from "node:crypto";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function shortId(): string {
  return crypto.randomBytes(3).toString("hex");
}

/** Strip markdown syntax for plain-text analysis (readability, embeddings). */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** First-paragraph-derived meta description, hard capped at 160 chars. */
export function deriveMetaDescription(md: string): string {
  const plain = stripMarkdown(md);
  return truncate(plain, 158);
}

/** Extract the first H1 as title; returns null when absent. */
export function extractTitle(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

/** Remove the first H1 line (Hugo renders the title from frontmatter). */
export function stripFirstH1(md: string): string {
  return md.replace(/^#\s+.+$/m, "").trimStart();
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Parse a "## FAQ" section where each question is an H3 — used to build
 * FAQPage JSON-LD at the SEO pass.
 */
export function extractFaq(md: string): FaqEntry[] {
  const faqMatch = md.match(/^##\s+(?:FAQ|Frequently Asked Questions)\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/im);
  if (!faqMatch?.[1]) return [];
  const section = faqMatch[1];
  const entries: FaqEntry[] = [];
  const parts = section.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const [q, ...rest] = part.split("\n");
    const answer = stripMarkdown(rest.join("\n"));
    if (q && answer) entries.push({ question: q.trim().replace(/\?*$/, "?"), answer });
  }
  return entries;
}
