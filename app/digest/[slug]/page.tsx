"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, DigestRecord, Story, TAG_ICONS } from "@/lib/supabase";
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

function IndustryIcon({ iconId, size = 20 }: { iconId: string; size?: number }) {
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
  return `${days}d ago`;
}

function storyKey(s: Story) {
  return s.url || s.headline;
}

function buildWhatsApp(digest: DigestRecord, industryName: string, selected: Set<string>): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const allStories = digest.stories ?? [];
  const selectedStories = allStories.filter(s => selected.has(storyKey(s)));
  const allSelected = selectedStories.length === allStories.length;

  let msg = `Daily AI News - RepresentAI | ${industryName}\n${date}\n\n`;

  // Only include the AI-generated overview when all stories are selected —
  // if the user has deselected any, the TL;DR may reference stories not in the message.
  if (allSelected) {
    if (digest.highlight) msg += `⚡ *This week's highlight:* ${digest.highlight}\n\n`;
    if (digest.tldr) msg += `${digest.tldr}\n\n`;
  }

  selectedStories.forEach((s: Story, i: number) => {
    const icon = TAG_ICONS[s.tag] || "📌";
    msg += `${icon} *${s.headline}*\n${s.summary}`;
    if (s.url) msg += `\n\n${s.url}`;
    if (i < selectedStories.length - 1) msg += "\n\n";
  });
  msg += "\n\nDigest via RepresentAI / AI Signal";
  return msg;
}

const FRESH_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export default function DigestPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const [industryName, setIndustryName] = useState("");
  const [industryIcon, setIndustryIcon] = useState("📰");
  const [currentDigest, setCurrentDigest] = useState<DigestRecord | null>(null);
  const [archive, setArchive] = useState<DigestRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

    const { data: ind } = await supabase
      .from("industries")
      .select("name, icon")
      .eq("slug", slug)
      .single();

    if (ind) {
      setIndustryName(ind.name);
      setIndustryIcon(ind.icon);
    }

    const { data: digests } = await supabase
      .from("digests")
      .select("*")
      .eq("industry_slug", slug)
      .order("created_at", { ascending: false })
      .limit(6);

    if (digests && digests.length > 0) {
      setCurrentDigest(digests[0]);
      setSelected(new Set(digests[0].stories?.map((s: Story) => storyKey(s)) ?? []));
      setArchive(digests.slice(1));
    }

    setPageLoading(false);
  }, [slug]);

  useEffect(() => { loadFromDB(); }, [loadFromDB]);

  function switchDigest(d: DigestRecord) {
    setCurrentDigest(d);
    setSelected(new Set(d.stories?.map((s: Story) => storyKey(s)) ?? []));
  }

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
      await loadFromDB();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  function toggleStory(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function copyToClipboard() {
    if (!currentDigest) return;
    navigator.clipboard.writeText(buildWhatsApp(currentDigest, industryName, selected)).then(() => {
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

  const selectedStories = currentDigest?.stories?.filter(s => selected.has(storyKey(s))) ?? [];
  const totalStories = currentDigest?.stories?.length ?? 0;

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
                <IndustryIcon iconId={industryIcon} size={22} /> {industryName}
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

        {/* Generate button */}
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

            {/* Notice when TL;DR is omitted from the WhatsApp message */}
            {selected.size > 0 && selected.size < totalStories && (
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fafaf9", border: "0.5px solid #e5e5e5", marginBottom: 16, fontFamily: "monospace", fontSize: 10, color: "#aaa" }}>
                TL;DR and highlight omitted from WhatsApp — they cover all stories. Reselect all to include them.
              </div>
            )}

            {/* Selection counter */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa" }}>
                {selected.size > 0
                  ? `${selected.size} of ${totalStories} selected for WhatsApp`
                  : "Tap stories to select them for the WhatsApp roundup"}
              </p>
              {selected.size > 0 && selected.size < totalStories && (
                <button
                  onClick={() => setSelected(new Set(currentDigest.stories?.map(s => storyKey(s)) ?? []))}
                  style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Select all
                </button>
              )}
              {selected.size === totalStories && totalStories > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Stories */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {currentDigest.stories?.map((s: Story, i: number) => {
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
                    {/* Tick / index badge */}
                    <div style={{
                      position: "absolute", top: 10, right: 12,
                      width: 20, height: 20, borderRadius: "50%",
                      background: isSelected ? "#111" : "#f5f5f4",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected
                        ? <span style={{ color: "#fff", fontSize: 10 }}>✓</span>
                        : <span style={{ color: "#bbb", fontSize: 9, fontFamily: "monospace" }}>{i + 1}</span>
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
                        <h2 style={{ margin: "0 0 5px", fontSize: 16, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 28 }}>
                          {TAG_ICONS[s.tag] || "📌"} {s.headline} ↗
                        </h2>
                      </a>
                    ) : (
                      <h2 style={{ margin: "0 0 5px", fontSize: 16, fontWeight: "normal", color: "#111", lineHeight: 1.3, paddingRight: 28 }}>
                        {TAG_ICONS[s.tag] || "📌"} {s.headline}
                      </h2>
                    )}

                    <p style={{ margin: 0, fontSize: 12, color: "#777", lineHeight: 1.6, fontFamily: "sans-serif" }}>
                      {s.summary}
                    </p>

                    {s.url && (
                      <p style={{ margin: "6px 0 0", fontSize: 10, fontFamily: "monospace", color: "#bbb", wordBreak: "break-all" }}>
                        {s.url}
                      </p>
                    )}
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
                    {buildWhatsApp(currentDigest, industryName, selected)}
                  </pre>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      flex: 1, padding: "13px 0", fontSize: 14, fontFamily: "sans-serif",
                      cursor: "pointer", fontWeight: 500, borderRadius: 8,
                      border: copied ? "1px solid #86efac" : "1px solid #111",
                      background: copied ? "#f0fdf4" : "#111",
                      color: copied ? "#15803d" : "#fff",
                      transition: "all 0.15s",
                    }}
                  >
                    {copied ? "Copied to clipboard ✓" : "Copy for WhatsApp"}
                  </button>
                  <button
                    onClick={copyShareLink}
                    style={{
                      padding: "13px 16px", fontSize: 13, fontFamily: "sans-serif",
                      cursor: "pointer", border: "1px solid #ccc", borderRadius: 8,
                      background: "transparent", color: "#666",
                    }}
                    title="Copy link to this page"
                  >
                    🔗
                  </button>
                </div>
              </div>
            )}

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
                        onClick={() => switchDigest(d)}
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
