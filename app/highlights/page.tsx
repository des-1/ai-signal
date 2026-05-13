"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Megaphone, Scale, TrendingUp, HeartPulse, Zap, Sprout, Cpu, Factory,
  HardHat, Truck, GraduationCap, Shield, Wrench, Music, ShoppingBag,
  Globe, Building2, Landmark, FlaskConical, Plane, LucideIcon
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "megaphone": Megaphone, "scale": Scale, "trending-up": TrendingUp,
  "heart-pulse": HeartPulse, "zap": Zap, "sprout": Sprout, "cpu": Cpu,
  "factory": Factory, "hard-hat": HardHat, "truck": Truck,
  "graduation-cap": GraduationCap, "shield": Shield, "wrench": Wrench,
  "music": Music, "shopping-bag": ShoppingBag, "globe": Globe,
  "building-2": Building2, "landmark": Landmark, "flask": FlaskConical, "plane": Plane,
};

function IndustryIcon({ iconId, size = 16 }: { iconId: string; size?: number }) {
  const Icon = ICON_MAP[iconId] || Globe;
  return <Icon size={size} strokeWidth={1.5} color="currentColor" />;
}

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

type HighlightStory = {
  headline: string;
  source: string;
  tag: string;
  summary: string;
  url: string;
  industry_name: string;
  industry_slug: string;
  industry_icon: string;
};

function buildWhatsApp(selected: HighlightStory[]): string {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  let msg = `Daily AI News - Industry Highlights\n${date}\n\n`;
  selected.forEach((s, i) => {
    msg += `[${s.industry_name}] *${s.headline}*\n${s.summary}`;
    if (s.url) msg += `\n\n${s.url}`;
    if (i < selected.length - 1) msg += "\n\n";
  });
  msg += "\n\nDigest via RepresentAI / AI Signal";
  return msg;
}

const FRESH_MS = 24 * 60 * 60 * 1000;

export default function HighlightsPage() {
  const [stories, setStories] = useState<HighlightStory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("Searching across all industries...");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const phrases = [
    "Searching across all industries...",
    "Scanning for today's top stories...",
    "Deduplicating across industries...",
    "Saving industry digests...",
    "Building your highlights...",
  ];

  useEffect(() => { loadLatest(); }, []);

  async function loadLatest() {
    setLoading(true);
    const { data } = await supabase
      .from("highlights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setStories(data.stories);
      setGeneratedAt(data.created_at);
    }
    setLoading(false);
  }

  async function generate() {
    setGenerating(true);
    setError("");
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setLoadingPhrase(phrases[idx]);
    }, 4000);

    try {
      const res = await fetch("/api/highlights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setStories(data.stories);
      setGeneratedAt(data.generatedAt);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  function toggleStory(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function storyKey(s: HighlightStory) {
    return `${s.industry_slug}::${s.url}`;
  }

  function copyWhatsApp() {
    const sel = stories.filter(s => selected.has(storyKey(s)));
    navigator.clipboard.writeText(buildWhatsApp(sel)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // Group stories by industry
  const grouped = stories.reduce<Record<string, HighlightStory[]>>((acc, s) => {
    if (!acc[s.industry_slug]) acc[s.industry_slug] = [];
    acc[s.industry_slug].push(s);
    return acc;
  }, {});

  const isFresh = generatedAt
    ? Date.now() - new Date(generatedAt).getTime() < FRESH_MS
    : false;

  const selectedStories = stories.filter(s => selected.has(storyKey(s)));
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Masthead */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <div>
              <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none" }}>← AI Signal</Link>
              <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>
                Industry Highlights
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

        {/* Generate button */}
        {!generating && (!stories.length || !isFresh) && (
          <button
            onClick={generate}
            style={{
              width: "100%", padding: "14px 0", fontSize: 14, fontFamily: "sans-serif",
              cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
              background: "#fff", color: "#111", fontWeight: 500, marginBottom: stories.length ? 20 : 0,
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#f5f5f4")}
            onMouseOut={e => (e.currentTarget.style.background = "#fff")}
          >
            {stories.length ? "Generate fresh highlights" : "Generate today's highlights"}
          </button>
        )}

        {/* Loading */}
        {generating && (
          <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#888", marginBottom: 12 }}>{loadingPhrase}</p>
            <div style={{ height: 2, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#111", borderRadius: 2, animation: "progress 4s ease-in-out infinite alternate" }} />
            </div>
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#ccc", marginTop: 12 }}>
              This takes 60–90 seconds — searching all industries at once
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 12, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontFamily: "sans-serif", marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* Stories by industry */}
        {!loading && stories.length > 0 && (
          <>
            {/* Selection summary */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa" }}>
                {selected.size > 0
                  ? `${selected.size} ${selected.size === 1 ? "story" : "stories"} selected`
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

            {/* Industry groups */}
            {Object.entries(grouped).map(([slug, industryStories]) => {
              const first = industryStories[0];
              return (
                <div key={slug} style={{ marginBottom: 32 }}>
                  {/* Industry header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "0.5px solid #e5e5e5" }}>
                    <div style={{ color: "#888" }}>
                      <IndustryIcon iconId={first.industry_icon} size={15} />
                    </div>
                    <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {first.industry_name}
                    </p>
                  </div>

                  {/* Stories */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {industryStories.map((s) => {
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
                            transition: "all 0.1s",
                            position: "relative",
                          }}
                        >
                          {/* Selected tick */}
                          {isSelected && (
                            <div style={{
                              position: "absolute", top: 10, right: 12,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#111", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <span style={{ color: "#fff", fontSize: 10 }}>✓</span>
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {s.source}
                            </span>
                            <span style={{ fontFamily: "monospace", fontSize: 10, background: "#f5f5f4", color: "#666", padding: "2px 6px", borderRadius: 3 }}>
                              {s.tag}
                            </span>
                          </div>

                          {s.url ? (
                            <a
                              href={s.url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ textDecoration: "none" }}
                            >
                              <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 24 }}>
                                {s.headline} ↗
                              </p>
                            </a>
                          ) : (
                            <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 24 }}>
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
                </div>
              );
            })}

            {/* WhatsApp preview + copy */}
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

      <style>{`
        @keyframes progress {
          from { width: 5%; margin-left: 0; }
          to { width: 70%; margin-left: 30%; }
        }
      `}</style>
    </main>
  );
}
