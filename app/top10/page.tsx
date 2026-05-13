"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Top10Story = {
  headline: string;
  source: string;
  tag: string;
  summary: string;
  url: string;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function buildWhatsApp(selected: Top10Story[]): string {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  let msg = `Daily AI News - Top 10\n${date}\n\n`;
  selected.forEach((s, i) => {
    msg += `[${s.tag}] *${s.headline}*\n${s.summary}`;
    if (s.url) msg += `\n\n${s.url}`;
    if (i < selected.length - 1) msg += "\n\n";
  });
  msg += "\n\nDigest via RepresentAI / AI Signal";
  return msg;
}

const FRESH_MS = 24 * 60 * 60 * 1000;

export default function Top10Page() {
  const [stories, setStories] = useState<Top10Story[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadLatest = useCallback(async () => {
    setPageLoading(true);
    const { data } = await supabase
      .from("top10")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setStories(data.stories);
      setGeneratedAt(data.created_at);
    }
    setPageLoading(false);
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  function toggleStory(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function storyKey(s: Top10Story) {
    return s.url || s.headline;
  }

  function copyWhatsApp() {
    const sel = stories.filter(s => selected.has(storyKey(s)));
    navigator.clipboard.writeText(buildWhatsApp(sel)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const isFresh = generatedAt
    ? Date.now() - new Date(generatedAt).getTime() < FRESH_MS
    : false;

  const selectedStories = stories.filter(s => selected.has(storyKey(s)));
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (pageLoading) {
    return (
      <main style={{ minHeight: "100vh", background: "#fafaf9", display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
        <div style={{ maxWidth: 720, width: "100%", fontFamily: "monospace", fontSize: 12, color: "#aaa", paddingTop: 60 }}>
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Masthead */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <div>
              <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none" }}>← AI Signal</Link>
              <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>
                Top 10 Daily News
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Daily Roundup — RepresentAI
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#999", margin: 0 }}>{today}</p>
              {generatedAt && (
                <p style={{ fontSize: 10, fontFamily: "monospace", color: isFresh ? "#4ade80" : "#f9a8d4", margin: "4px 0 0" }}>
                  {isFresh ? "● Fresh" : "● Stale"} · {timeAgo(generatedAt)}
                </p>
              )}
            </div>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {/* Empty state */}
        {stories.length === 0 && (
          <p style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa", textAlign: "center", padding: "2rem 0" }}>
            No Top 10 generated yet.{" "}
            <Link href="/admin" style={{ color: "#aaa" }}>Go to Admin to generate.</Link>
          </p>
        )}

        {/* Stories */}
        {stories.length > 0 && (
          <>
            {/* Selection counter */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa" }}>
                {selected.size > 0
                  ? `${selected.size} of ${stories.length} selected`
                  : "Tap stories to select them for the WhatsApp roundup"}
              </p>
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Story list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stories.map((s, idx) => {
                const key = storyKey(s);
                const isSelected = selected.has(key);
                return (
                  <div
                    key={key}
                    onClick={() => toggleStory(key)}
                    style={{
                      padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                      border: isSelected ? "1.5px solid #111" : "0.5px solid #e5e5e5",
                      background: isSelected ? "#f9f9f8" : "#fff",
                      transition: "all 0.1s", position: "relative",
                    }}
                  >
                    {/* Rank / tick badge */}
                    <div style={{
                      position: "absolute", top: 10, right: 12,
                      width: 20, height: 20, borderRadius: "50%",
                      background: isSelected ? "#111" : "#f5f5f4",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected
                        ? <span style={{ color: "#fff", fontSize: 10 }}>✓</span>
                        : <span style={{ color: "#bbb", fontSize: 9, fontFamily: "monospace" }}>{idx + 1}</span>
                      }
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {s.source}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, background: "#f5f5f4", color: "#666", padding: "2px 6px", borderRadius: 3 }}>
                        {s.tag}
                      </span>
                    </div>

                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ textDecoration: "none" }}>
                        <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 28 }}>
                          {s.headline} ↗
                        </p>
                      </a>
                    ) : (
                      <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 28 }}>
                        {s.headline}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: 12, color: "#777", lineHeight: 1.6, fontFamily: "sans-serif" }}>
                      {s.summary}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Sticky WhatsApp preview + copy */}
            {selectedStories.length > 0 && (
              <div style={{ position: "sticky", bottom: 0, background: "#fafaf9", paddingTop: 12, paddingBottom: 16, borderTop: "0.5px solid #e5e5e5", marginTop: 8 }}>
                <div style={{ padding: "12px 16px", background: "#fff", borderRadius: 10, border: "0.5px solid #e5e5e5", marginBottom: 10, maxHeight: 180, overflowY: "auto" }}>
                  <p style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
                    WhatsApp preview · {selectedStories.length} {selectedStories.length === 1 ? "story" : "stories"}
                  </p>
                  <pre style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                    {buildWhatsApp(selectedStories)}
                  </pre>
                </div>
                <button
                  onClick={copyWhatsApp}
                  style={{
                    width: "100%", padding: "13px 0", fontSize: 14, fontFamily: "sans-serif",
                    cursor: "pointer", fontWeight: 500, borderRadius: 8,
                    border: copied ? "1px solid #86efac" : "1px solid #111",
                    background: copied ? "#f0fdf4" : "#111",
                    color: copied ? "#15803d" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? "Copied to clipboard ✓" : "Copy for WhatsApp"}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}
