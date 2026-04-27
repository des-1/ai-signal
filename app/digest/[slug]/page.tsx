"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, DigestRecord, Story, TAG_ICONS } from "@/lib/supabase";

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function buildWhatsApp(digest: DigestRecord, industryName: string): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  let msg = `*Daily AI News — RepresentAI | ${industryName}*\n_${date}_\n\n`;
  if (digest.highlight) msg += `⚡ *This week's highlight:* ${digest.highlight}\n\n`;
  if (digest.tldr) msg += `${digest.tldr}\n\n`;
  digest.stories?.forEach((s: Story, i: number) => {
    const icon = TAG_ICONS[s.tag] || "📌";
    msg += `${icon} *${s.headline}*\n${s.summary}`;
    if (s.url) msg += `\n\n${s.url}`;
    if (i < digest.stories.length - 1) msg += "\n\n";
  });
  msg += "\n\n_Digest via RepresentAI / AI Signal_";
  return msg;
}

const FRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function DigestPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const [industryName, setIndustryName] = useState("");
  const [industryIcon, setIndustryIcon] = useState("📰");
  const [currentDigest, setCurrentDigest] = useState<DigestRecord | null>(null);
  const [archive, setArchive] = useState<DigestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("Searching the web...");
  const [showArchive, setShowArchive] = useState(false);

  const phrases = [
    "Searching the web...",
    "Scanning industry sources...",
    "Filtering for signal...",
    "Building your digest...",
  ];

  const loadFromDB = useCallback(async () => {
    setPageLoading(true);

    // Fetch industry info
    const { data: ind } = await supabase
      .from("industries")
      .select("name, icon")
      .eq("slug", slug)
      .single();

    if (ind) {
      setIndustryName(ind.name);
      setIndustryIcon(ind.icon);
    }

    // Fetch digests (latest first)
    const { data: digests } = await supabase
      .from("digests")
      .select("*")
      .eq("industry_slug", slug)
      .order("created_at", { ascending: false })
      .limit(6);

    if (digests && digests.length > 0) {
      setCurrentDigest(digests[0]);
      setArchive(digests.slice(1));
    }

    setPageLoading(false);
  }, [slug]);

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  async function fetchDigest() {
    setLoading(true);
    setError("");
    setCopied(false);

    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setLoadingPhrase(phrases[idx]);
    }, 2500);

    try {
      const res = await fetch(`/api/digest?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");

      // Reload from DB to get the saved record
      await loadFromDB();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!currentDigest) return;
    navigator.clipboard.writeText(buildWhatsApp(currentDigest, industryName)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  const isFresh = currentDigest
    ? Date.now() - new Date(currentDigest.created_at).getTime() < FRESH_THRESHOLD_MS
    : false;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  if (pageLoading) {
    return (
      <main style={{ minHeight: "100vh", background: "#fafaf9", display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
        <div style={{ maxWidth: 640, width: "100%", fontFamily: "monospace", fontSize: 12, color: "#aaa", paddingTop: 60 }}>
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 640, fontFamily: "'Georgia', serif" }}>

        {/* Masthead */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none" }}>
                  ← AI Signal
                </Link>
              </div>
              <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>
                {industryIcon} {industryName}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                AI Intelligence — RepresentAI
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#999", margin: 0 }}>{today}</p>
              {currentDigest && (
                <p style={{ fontSize: 10, fontFamily: "monospace", color: isFresh ? "#86efac" : "#f9a8d4", margin: "4px 0 0" }}>
                  {isFresh ? "● Fresh" : "● Stale"} · {timeAgo(currentDigest.created_at)}
                </p>
              )}
            </div>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {/* Generate button (no digest yet, or stale) */}
        {!loading && (!currentDigest || !isFresh) && (
          <button
            onClick={fetchDigest}
            style={{
              width: "100%", padding: "14px 0", fontSize: 14, fontFamily: "sans-serif",
              cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
              background: "#fff", color: "#111", fontWeight: 500, marginBottom: currentDigest ? 20 : 0,
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#f5f5f4")}
            onMouseOut={e => (e.currentTarget.style.background = "#fff")}
          >
            {currentDigest ? "Generate fresh digest" : "Generate this week's digest"}
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

        {/* Current digest */}
        {currentDigest && (
          <>
            {/* Highlight banner */}
            {currentDigest.highlight && (
              <div style={{ padding: "12px 16px", background: "#111", borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  This week&apos;s highlight
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "#fff", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                  ⚡ {currentDigest.highlight}
                </p>
              </div>
            )}

            {/* TL;DR */}
            {currentDigest.tldr && (
              <div style={{ padding: "12px 16px", background: "#f5f5f4", borderRadius: 8, marginBottom: 24, borderLeft: "3px solid #ccc" }}>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  TL;DR
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#444", fontFamily: "sans-serif", lineHeight: 1.65 }}>
                  {currentDigest.tldr}
                </p>
              </div>
            )}

            {/* Stories */}
            <div>
              {currentDigest.stories?.map((s: Story, i: number) => (
                <div key={i} style={{ padding: "1rem 0", borderBottom: i < currentDigest.stories.length - 1 ? "0.5px solid #e5e5e5" : "none" }}>
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
                        {TAG_ICONS[s.tag] || "📌"} {s.headline} ↗
                      </h2>
                    </a>
                  ) : (
                    <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: "normal", color: "#111", lineHeight: 1.3 }}>
                      {TAG_ICONS[s.tag] || "📌"} {s.headline}
                    </h2>
                  )}
                  <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.65, fontFamily: "sans-serif" }}>{s.summary}</p>
                  {s.url && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, fontFamily: "monospace", color: "#bbb", wordBreak: "break-all" }}>
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
                {buildWhatsApp(currentDigest, industryName)}
              </pre>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={copyToClipboard}
                style={{
                  flex: 1, minWidth: 160, padding: "12px 0", fontSize: 13, fontFamily: "sans-serif",
                  cursor: "pointer", border: copied ? "1px solid #86efac" : "1px solid #ccc",
                  borderRadius: 8, background: "#fff", color: copied ? "#15803d" : "#111", fontWeight: 500,
                }}
              >
                {copied ? "Copied ✓" : "Copy for WhatsApp"}
              </button>
              <button
                onClick={copyShareLink}
                style={{
                  padding: "12px 16px", fontSize: 13, fontFamily: "sans-serif",
                  cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
                  background: "transparent", color: "#666",
                }}
                title="Copy link to this page"
              >
                🔗 Share
              </button>
              {isFresh && (
                <button
                  onClick={fetchDigest}
                  style={{
                    padding: "12px 16px", fontSize: 13, fontFamily: "sans-serif",
                    cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
                    background: "transparent", color: "#666",
                  }}
                >
                  Refresh
                </button>
              )}
            </div>

            {/* Archive */}
            {archive.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "0.5px solid #e5e5e5" }}>
                <button
                  onClick={() => setShowArchive(!showArchive)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontFamily: "monospace", fontSize: 11, color: "#aaa", textTransform: "uppercase",
                    letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {showArchive ? "▾" : "▸"} Past digests ({archive.length})
                </button>
                {showArchive && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {archive.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setCurrentDigest(d)}
                        style={{
                          padding: "10px 14px", background: "#fff", border: "0.5px solid #e5e5e5",
                          borderRadius: 8, cursor: "pointer",
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = "#f9f9f8")}
                        onMouseOut={e => (e.currentTarget.style.background = "#fff")}
                      >
                        <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#bbb" }}>
                          {new Date(d.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {timeAgo(d.created_at)}
                        </p>
                        {d.highlight && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666", fontFamily: "sans-serif", lineHeight: 1.4 }}>
                            {d.highlight}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
