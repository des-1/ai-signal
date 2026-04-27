"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Industry, DigestRecord } from "@/lib/supabase";
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
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function freshnessStatus(date: string | null): "today" | "week" | "stale" | "never" {
  if (!date) return "never";
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 24 * 60 * 60 * 1000) return "today";
  if (diff < 7 * 24 * 60 * 60 * 1000) return "week";
  return "stale";
}

const STATUS_COLORS = {
  today: "#4ade80",
  week: "#fbbf24",
  stale: "#d1d5db",
  never: "#e5e7eb",
};

const STATUS_LABELS = {
  today: "Updated today",
  week: "Updated this week",
  stale: "Not updated recently",
  never: "Never generated",
};

type IndustryWithStats = Industry & {
  latestDigest: DigestRecord | null;
  digestCount: number;
};

export default function Home() {
  const [industries, setIndustries] = useState<IndustryWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedToday, setUpdatedToday] = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);

    const { data: inds } = await supabase
      .from("industries")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (!inds) { setLoading(false); return; }

    const enriched: IndustryWithStats[] = [];
    let todayCount = 0;

    for (const ind of inds) {
      const { data: latest } = await supabase
        .from("digests")
        .select("*")
        .eq("industry_slug", ind.slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await supabase
        .from("digests")
        .select("*", { count: "exact", head: true })
        .eq("industry_slug", ind.slug);

      if (latest && freshnessStatus(latest.created_at) === "today") todayCount++;

      enriched.push({
        ...ind,
        latestDigest: latest || null,
        digestCount: count || 0,
      });
    }

    // Sort by digest count descending for activity insight
    const sorted = [...enriched].sort((a, b) => b.digestCount - a.digestCount);

    setIndustries(enriched);
    setUpdatedToday(todayCount);
    setLoading(false);

    // Store sorted separately for chart
    setSortedByActivity(sorted);
  }

  const [sortedByActivity, setSortedByActivity] = useState<IndustryWithStats[]>([]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const maxCount = sortedByActivity[0]?.digestCount || 1;

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
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#999", margin: 0 }}>{today}</p>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {loading ? (
          <p style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa" }}>Loading...</p>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: "flex", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Industries</p>
                <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: "normal", color: "#111" }}>{industries.length}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Updated today</p>
                <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: "normal", color: updatedToday > 0 ? "#111" : "#ccc" }}>
                  {updatedToday} <span style={{ fontSize: 13, color: "#aaa" }}>of {industries.length}</span>
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total digests</p>
                <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: "normal", color: "#111" }}>
                  {industries.reduce((acc, i) => acc + i.digestCount, 0)}
                </p>
              </div>
            </div>

            {/* Industry list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 40 }}>
              {industries.map((ind) => {
                const status = freshnessStatus(ind.latestDigest?.created_at || null);
                return (
                  <Link key={ind.slug} href={`/digest/${ind.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "14px 16px", background: "#fff",
                        border: "0.5px solid #e5e5e5", borderRadius: 8,
                        transition: "background 0.1s, border-color 0.1s",
                        cursor: "pointer",
                      }}
                      onMouseOver={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "#f9f9f8";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#d5d5d5";
                      }}
                      onMouseOut={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "#fff";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e5e5";
                      }}
                    >
                      {/* Status dot */}
                      <div title={STATUS_LABELS[status]} style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: STATUS_COLORS[status],
                      }} />

                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: "#f5f5f4",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        color: "#555",
                      }}>
                        <IndustryIcon iconId={ind.icon} size={18} />
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, color: "#111", fontFamily: "'Georgia', serif" }}>{ind.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, fontFamily: "monospace", color: "#bbb" }}>
                          {ind.latestDigest ? timeAgo(ind.latestDigest.created_at) : "No digest yet"}
                        </p>
                      </div>

                      {/* Digest count */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#aaa", fontFamily: "monospace" }}>
                          {ind.digestCount > 0 ? `${ind.digestCount} ${ind.digestCount === 1 ? "digest" : "digests"}` : "—"}
                        </p>
                      </div>

                      {/* Arrow */}
                      <span style={{ color: "#ccc", fontSize: 14, flexShrink: 0 }}>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Activity chart */}
            {sortedByActivity.some(i => i.digestCount > 0) && (
              <div style={{ padding: "20px 24px", background: "#fff", borderRadius: 10, border: "0.5px solid #e5e5e5", marginBottom: 32 }}>
                <p style={{ margin: "0 0 16px", fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Most active industries
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sortedByActivity.filter(i => i.digestCount > 0).map((ind) => (
                    <div key={ind.slug} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, width: 180, flexShrink: 0 }}>
                        <div style={{ color: "#aaa" }}><IndustryIcon iconId={ind.icon} size={14} /></div>
                        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ind.name}
                        </span>
                      </div>
                      <div style={{ flex: 1, height: 6, background: "#f5f5f4", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${(ind.digestCount / maxCount) * 100}%`,
                          background: "#111",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#bbb", width: 24, textAlign: "right", flexShrink: 0 }}>
                        {ind.digestCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status legend */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {(Object.entries(STATUS_LABELS) as [keyof typeof STATUS_LABELS, string][]).map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[key] }} />
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#bbb" }}>{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
