"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Industry } from "@/lib/supabase";

const EMOJI_SUGGESTIONS = ["📣", "⚖️", "📈", "🎵", "🏥", "🏗️", "🛒", "🎓", "🏛️", "🚀", "🎮", "🏭"];

export default function AdminPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New industry form
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📰");
  const [newFocus, setNewFocus] = useState("");

  useEffect(() => { loadIndustries(); }, []);

  async function loadIndustries() {
    setLoading(true);
    const res = await fetch("/api/industries");
    const data = await res.json();
    setIndustries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function toggleActive(slug: string, current: boolean) {
    await fetch(`/api/industries/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    loadIndustries();
  }

  async function deleteIndustry(slug: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all its saved digests. This cannot be undone.`)) return;
    setDeleting(slug);
    await fetch(`/api/industries/${slug}`, { method: "DELETE" });
    setDeleting(null);
    loadIndustries();
  }

  async function addIndustry() {
    if (!newName.trim() || !newFocus.trim()) {
      setError("Name and focus areas are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/industries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, icon: newIcon, focus: newFocus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create industry");
    } else {
      setNewName("");
      setNewIcon("📰");
      setNewFocus("");
      setSuccess(`"${data.name}" added successfully.`);
      setTimeout(() => setSuccess(""), 3000);
      loadIndustries();
    }
    setSaving(false);
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "sans-serif",
    border: "0.5px solid #ddd", borderRadius: 6, background: "#fff",
    color: "#111", boxSizing: "border-box", outline: "none",
  };

  const label: React.CSSProperties = {
    display: "block", fontSize: 10, fontFamily: "monospace", color: "#aaa",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Header */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>
                Admin Panel
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                AI Signal — RepresentAI
              </p>
            </div>
            <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none" }}>
              ← Back to dashboard
            </Link>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {/* Current industries */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>
            Active industries
          </p>

          {loading ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#ccc" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {industries.map((ind) => (
                <div
                  key={ind.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8,
                    opacity: ind.active ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{ind.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "#111" }}>{ind.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, fontFamily: "monospace", color: "#bbb" }}>
                      /{ind.slug}
                    </p>
                  </div>
                  <Link
                    href={`/digest/${ind.slug}`}
                    style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none", padding: "5px 10px", border: "0.5px solid #e5e5e5", borderRadius: 4 }}
                  >
                    View ↗
                  </Link>
                  <button
                    onClick={() => toggleActive(ind.slug, ind.active)}
                    style={{
                      fontSize: 11, fontFamily: "monospace", cursor: "pointer", padding: "5px 10px",
                      border: "0.5px solid #e5e5e5", borderRadius: 4, background: "transparent",
                      color: ind.active ? "#888" : "#22c55e",
                    }}
                  >
                    {ind.active ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => deleteIndustry(ind.slug, ind.name)}
                    disabled={deleting === ind.slug}
                    style={{
                      fontSize: 11, fontFamily: "monospace", cursor: "pointer", padding: "5px 10px",
                      border: "0.5px solid #fca5a5", borderRadius: 4, background: "transparent",
                      color: "#ef4444", opacity: deleting === ind.slug ? 0.5 : 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new industry */}
        <div style={{ padding: "24px", background: "#fff", borderRadius: 10, border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 20px" }}>
            Add new industry
          </p>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontFamily: "sans-serif", marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontSize: 13, fontFamily: "sans-serif", marginBottom: 16 }}>
              {success}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Industry name</label>
              <input
                style={input}
                placeholder="e.g. Music & Entertainment"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div style={{ width: 80 }}>
              <label style={label}>Icon</label>
              <input
                style={{ ...input, textAlign: "center", fontSize: 20 }}
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                maxLength={2}
              />
            </div>
          </div>

          {/* Emoji suggestions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setNewIcon(e)}
                style={{
                  fontSize: 18, padding: "4px 6px", cursor: "pointer",
                  border: newIcon === e ? "1px solid #111" : "0.5px solid #e5e5e5",
                  borderRadius: 6, background: newIcon === e ? "#f5f5f4" : "transparent",
                }}
              >
                {e}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={label}>Search focus areas</label>
            <textarea
              style={{ ...input, minHeight: 100, resize: "vertical" }}
              placeholder="Describe what the AI should search for. e.g.&#10;AI tools for music production and composition&#10;AI royalties and copyright in music&#10;Streaming platform AI recommendations..."
              value={newFocus}
              onChange={e => setNewFocus(e.target.value)}
            />
            <p style={{ margin: "6px 0 0", fontSize: 11, fontFamily: "monospace", color: "#ccc" }}>
              These focus areas shape what the AI searches for when generating the digest.
            </p>
          </div>

          <button
            onClick={addIndustry}
            disabled={saving}
            style={{
              width: "100%", padding: "12px 0", fontSize: 14, fontFamily: "sans-serif",
              cursor: saving ? "not-allowed" : "pointer", border: "1px solid #111",
              borderRadius: 8, background: "#111", color: "#fff", fontWeight: 500,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Adding..." : "Add industry"}
          </button>
        </div>

      </div>
    </main>
  );
}
