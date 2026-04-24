"use client";

import { useState } from "react";

type Story = {
  headline: string;
  source: string;
  tag: string;
  summary: string;
  url?: string;
};

const TAG_ICONS: Record<string, string> = {
  Advertising: "📢",
  Content: "✍️",
  Search: "🔍",
  Social: "📱",
  "Generative AI": "🤖",
  Tools: "🛠️",
  Regulation: "⚖️",
  Strategy: "📊",
};

function buildWhatsApp(stories: Story[], tldr: string, highlight: string): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  let msg = `*Daily AI News — RepresentAI | Media & Marketing*\n_${date}_\n\n`;
  if (highlight) msg += `⚡ *This week's highlight:* ${highlight}\n\n`;
  if (tldr) msg += `*TL;DR* — ${tldr}\n\n---\n\n`;
  stories.forEach((s, i) => {
    const icon = TAG_ICONS[s.tag] || "📌";
    msg += `${icon} *${s.headline}*\n${s.summary}`;
    if (s.url) msg += `\n${s.url}`;
    if (i < stories.length - 1) msg += "\n\n";
  });
  msg += "\n\n_Digest via RepresentAI / AI Signal_";
  return msg;
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [tldr, setTldr] = useState("");
  const [highlight, setHighlight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("Searching the web...");

  const phrases = ["Searching the web...", "Scanning industry sources...", "Filtering for signal...", "Building your digest..."];

  async function fetchDigest() {
    setLoading(true);
    setError("");
    setStories([]);
    setTldr("");
    setHighlight("");
    setCopied(false);

    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setLoadingPhrase(phrases[idx]);
    }, 2500);

    try {
      const res = await fetch("/api/digest");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");
      setStories(data.stories);
      setTldr(data.tldr || "");
      setHighlight(data.highlight || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(buildWhatsApp(stories, tldr, highlight)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 640, fontFamily: "'Georgia', serif" }}>

        {/* Masthead */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>AI Signal</h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Media &amp; Marketing Edition — RepresentAI
              </p>
            </div>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#999", margin: 0 }}>{today}</p>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {/* Fetch button */}
        {!loading && stories.length === 0 && (
          <button
            onClick={fetchDigest}
            style={{
              width: "100%", padding: "14px 0", fontSize: 14, fontFamily: "sans-serif",
              cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
              background: "#fff", color: "#111", fontWeight: 500,
              transition: "background 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#f5f5f4")}
            onMouseOut={e => (e.currentTarget.style.background = "#fff")}
          >
            Fetch this week&apos;s digest
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#888", marginBottom: 12 }}>{loadingPhrase}</p>
            <div style={{ height: 2, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#111", borderRadius: 2, animation: "progress 3s ease-in-out infinite alternate" }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 12, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontFamily: "sans-serif", marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* Digest content */}
        {stories.length > 0 && (
          <>
            {/* Highlight banner */}
            {highlight && (
              <div style={{ padding: "12px 16px", background: "#111", borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  This week&apos;s highlight
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "#fff", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                  ⚡ {highlight}
                </p>
              </div>
            )}

            {/* TL;DR */}
            {tldr && (
              <div style={{ padding: "12px 16px", background: "#f5f5f4", borderRadius: 8, marginBottom: 24, borderLeft: "3px solid #ccc" }}>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  TL;DR
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#444", fontFamily: "sans-serif", lineHeight: 1.65 }}>
                  {tldr}
                </p>
              </div>
            )}

            {/* Stories */}
            <div>
              {stories.map((s, i) => (
                <div key={i} style={{ padding: "1rem 0", borderBottom: i < stories.length - 1 ? "0.5px solid #e5e5e5" : "none" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {s.source}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, background: "#f5f5f4", color: "#666", padding: "2px 7px", borderRadius: 3 }}>
                      {s.tag}
                    </span>
                  </div>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: "normal", color: "#111", lineHeight: 1.3, cursor: "pointer" }}>
                        {s.headline} ↗
                      </h2>
                    </a>
                  ) : (
                    <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: "normal", color: "#111", lineHeight: 1.3 }}>{s.headline}</h2>
                  )}
                  <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.65, fontFamily: "sans-serif" }}>{s.summary}</p>
                  {s.url && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, fontFamily: "monospace", color: "#aaa", wordBreak: "break-all" }}>
                      {s.url}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* WhatsApp preview */}
            <div style={{ marginTop: 28, padding: "1rem 1.25rem", background: "#f5f5f4", borderRadius: 10, border: "0.5px solid #e5e5e5" }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
                WhatsApp preview
              </p>
              <pre style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65, maxHeight: 220, overflowY: "auto" }}>
                {buildWhatsApp(stories, tldr, highlight)}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={copyToClipboard}
                style={{
                  flex: 1, padding: "12px 0", fontSize: 13, fontFamily: "sans-serif",
                  cursor: "pointer", border: copied ? "1px solid #86efac" : "1px solid #ccc",
                  borderRadius: 8, background: "#fff",
                  color: copied ? "#15803d" : "#111", fontWeight: 500, transition: "all 0.15s",
                }}
              >
                {copied ? "Copied to clipboard ✓" : "Copy for WhatsApp"}
              </button>
              <button
                onClick={fetchDigest}
                style={{
                  padding: "12px 16px", fontSize: 13, fontFamily: "sans-serif",
                  cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
                  background: "transparent", color: "#666",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "#f5f5f4")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                Refresh
              </button>
            </div>

            <p style={{ fontFamily: "monospace", fontSize: 10, color: "#bbb", marginTop: 20, paddingTop: 16, borderTop: "0.5px solid #e5e5e5" }}>
              Stories sourced via live web search. Verify before sharing.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes progress {
          from { width: 10%; margin-left: 0; }
          to { width: 60%; margin-left: 40%; }
        }
      `}</style>
    </main>
  );
}
