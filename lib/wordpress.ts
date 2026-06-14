const WP_API = "https://representai.co.uk/wp-json/wp/v2/posts";

export interface WpPublishResult {
  published: boolean;
  wpPostId?: number;
  wpError?: string;
}

export interface WpPostOptions {
  title: string;
  content: string;
  categoryId: number;
  authorId?: number;
}

export async function publishToWordPress(options: WpPostOptions): Promise<WpPublishResult> {
  const { title, content, categoryId, authorId = 9 } = options;

  const username = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;

  if (!username || !password) {
    console.warn("[wordpress] WORDPRESS_USERNAME or WORDPRESS_APP_PASSWORD not set — skipping publish");
    return { published: false, wpError: "WordPress credentials not configured" };
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const res = await fetch(WP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title,
        content,
        status: "publish",
        categories: [categoryId],
        author: authorId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[wordpress] Publish failed (${res.status}): ${text}`);
      return { published: false, wpError: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    console.log(`[wordpress] Published post ID ${data.id} (category ${categoryId})`);
    return { published: true, wpPostId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[wordpress] Publish error: ${message}`);
    return { published: false, wpError: message };
  }
}

export function todayLabel(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = now.toLocaleString("en-GB", { month: "long" });
  return `${day} ${month} ${now.getFullYear()}`;
}

export function formatDigestAsHtml(stories: any[], tldr: string, highlight: string): string {
  const storiesHtml = stories
    .map(
      (s) => `<div style="margin-bottom:24px;">
<h3><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.headline}</a></h3>
<p><strong>${s.source}</strong> &middot; <em>${s.tag}</em></p>
<p>${s.summary}</p>
</div>`
    )
    .join("\n");

  return `<p><strong>${tldr}</strong></p>
<p><em>Top story: ${highlight}</em></p>
<hr />
${storiesHtml}`;
}

export function formatTop10AsHtml(stories: any[]): string {
  const storiesHtml = stories
    .map(
      (s, i) => `<div style="margin-bottom:24px;">
<h3>${i + 1}. <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.headline}</a></h3>
<p><strong>${s.source}</strong> &middot; <em>${s.tag}</em></p>
<p>${s.summary}</p>
</div>`
    )
    .join("\n");

  return storiesHtml;
}

// Slug → WordPress category mapping for industry digests
export const DIGEST_WP_CATEGORIES: Record<string, number> = {
  "media-marketing": 481,
  "law-legal": 483,
  "finance": 484,
  "defense-security": 485,
};

export const TOP10_WP_CATEGORY = 486;
