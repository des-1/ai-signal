"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Industry, DigestRecord, Pulse } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const TAG_COLORS: Record<string, string> = {
  Advertising: "#e9d5ff",
  Content: "#d1fae5",
  Search: "#dbeafe",
  Social: "#fce7f3",
  "Generative AI": "#fef3c7",
  Tools: "#e0f2fe",
  Regulation: "#fee2e2",
  Strategy: "#f0fdf4",
  Legal: "#ede9fe",
  Finance: "#ecfdf5",
  Risk: "#fff7ed",
};

export default function Home() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [latestDigests, setLatestDigests] = useState<Record<string, DigestRecord>>({});
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [tagCounts, setTagCounts] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // Load industries
    const { data: inds } = await supabase
      .from("industries")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (!inds) { setLoading(false); return; }
    setIndustries(inds);

    // Load latest digest for each industry + tag counts
    const digestMap: Record<string, DigestRecord> = {};
    const allTags: string[] = [];

    for (const ind of inds) {
      const { data: digest } = await supabase
        .from("digests")
        .select("*")
        .eq("industry_slug", ind.slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (digest) {
        digestMap[ind.slug] = digest;
        digest.stories?.forEach((s: { tag: string }) => allTags.push(s.tag));
      }
    }

    // Also pull tags from last 30 days of all digests for the chart
    const { data: recentDigests } = await supabase
      .from("digests")
      .select("stories")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

    recentDigests?.forEach((d) =>
      d.stories?.forEach((s: { tag: string }) => allTags.push(s.tag))
    );

    const counts: Record<string, number> = {};
    allTags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    const sorted = Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    setLatestDigests(digestMap);
    setTagCounts(sorted);
    setLoading(false);

    // Load latest pulse (no API call, just DB read)
    const { data: latestPulse } = await supabase
      .from("pulses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPulse) setPulse(latestPulse);
  }

  async function generatePulse() {
    setLoadingPulse(true);
    try {
      const res = await fetch("/api/pulse");
      const data = await res.json();
      if (data.content) setPulse({ id: "", content: data.content, created_at: new Date().toISOString() });
    } finally {
      setLoadingPulse(false);
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const maxTagCount = tagCounts[0]?.count || 1;

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Masthead */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>
                AI Signal
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Industry Intelligence — RepresentAI
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#555", fontFamily: "sans-serif" }}>
              {today}
            </p>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {loading ? (
          <p style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa" }}>Loading...</p>
        ) : (
          <>
            {/* Cross-industry pulse */}
            <div style={{ marginBottom: 32, padding: "16px 20px", background: "#111", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, fontFamily: "monospace", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Cross-industry pulse
                  </p>
                  {pulse ? (
                    <>
                      <p style={{ margin: 0, fontSize: 14, color: "#fff", lineHeight: 1.6, fontFamily: "sans-serif" }}>
                        ⚡ {pulse.content}
                      </p>
                      <p style={{ margin: "6px 0 0", fontSize: 10, fontFamily: "monospace", color: "#555" }}>
                        {timeAgo(pulse.created_at)}
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "#555", fontFamily: "sans-serif" }}>
                      Generate digests across industries to see cross-industry themes.
                    </p>
                  )}
                </div>
                <button
                  onClick={generatePulse}
                  disabled={loadingPulse}
                  style={{
                    padding: "8px 14px", fontSize: 11, fontFamily: "monospace", cursor: "pointer",
                    border: "0.5px solid #333", borderRadius: 6, background: "transparent",
                    color: "#888", whiteSpace: "nowrap", opacity: loadingPulse ? 0.5 : 1,
                  }}
                >
                  {loadingPulse ? "..." : "Refresh pulse"}
                </button>
              </div>
            </div>

            {/* Industry cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 40 }}>
              {industries.map((ind) => {
                const digest = latestDigests[ind.slug];
                return (
                  <Link key={ind.slug} href={`/digest/${ind.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        padding: "20px", background: "#fff", borderRadius: 10,
                        border: "0.5px solid #e5e5e5", cursor: "pointer",
                        transition: "box-shadow 0.15s, border-color 0.15s",
                      }}
                      onMouseOver={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#ccc";
                      }}
                      onMouseOut={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e5e5";
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{ind.icon}</div>
                      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: "normal", color: "#111", lineHeight: 1.2 }}>
                        {ind.name}
                      </h2>
                      {digest ? (
                        <>
                          <p style={{ margin: "0 0 10px", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
                            Updated {timeAgo(digest.created_at)}
                          </p>
                          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#777", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                            {digest.highlight}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {[...new Set(digest.stories?.map((s: { tag: string }) => s.tag))].slice(0, 3).map((tag) => (
                              <span
                                key={tag as string}
                                style={{
                                  fontSize: 10, fontFamily: "monospace", padding: "2px 7px", borderRadius: 3,
                                  background: TAG_COLORS[tag as string] || "#f5f5f4", color: "#555",
                                }}
                              >
                                {tag as string}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: "#bbb", fontFamily: "sans-serif" }}>
                          No digest yet — click to generate
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Tag frequency chart */}
            {tagCounts.length > 0 && (
              <div style={{ padding: "20px 24px", background: "#fff", borderRadius: 10, border: "0.5px solid #e5e5e5" }}>
                <p style={{ margin: "0 0 16px", fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Topic frequency — last 30 days
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tagCounts.map(({ tag, count }) => (
                    <div key={tag} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#888", width: 110, flexShrink: 0 }}>{tag}</span>
                      <div style={{ flex: 1, height: 6, background: "#f5f5f4", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%", borderRadius: 3,
                            width: `${(count / maxTagCount) * 100}%`,
                            background: TAG_COLORS[tag] ? TAG_COLORS[tag].replace(")", ", 0.8)").replace("rgb", "rgba") : "#d1d5db",
                            backgroundColor: "#111",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#bbb", width: 20, textAlign: "right" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
