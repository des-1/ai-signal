"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Industry } from "@/lib/supabase";

const EMOJI_SUGGESTIONS = ["📣", "⚖️", "📈", "🎵", "🏥", "🏗️", "🛒", "🎓", "🏛️", "🚀", "🎮", "🏭"];

export default function AdminPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", icon: "", focus: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New industry form
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📰");
  const [newFocus, setNewFocus] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => { loadIndustries(); }, []);

  async function loadIndustries() {
    setLoading(true);
    const res = await fetch("/api/industries");
    const data = await res.json();
    setIndustries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function startEdit(ind: Industry) {
    setEditingSlug(ind.slug);
    setEditForm({ name: ind.name, icon: ind.icon, focus: ind.focus });
    setError("");
  }

  function cancelEdit() {
    setEditingSlug(null);
    setEditForm({ name: "", icon: "", focus: "" });
  }

  async function saveEdit(slug: string) {
    if (!editForm.name.trim() || !editForm.focus.trim()) {
      setError("Name and focus are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/industries/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, icon: editForm.icon, focus: editForm.focus }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
    } else {
      setEditingSlug(null);
      flash("Changes saved.");
      loadIndustries();
    }
    setSaving(false);
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
    setAddSaving(true);
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
      setNewName(""); setNewIcon("📰"); setNewFocus("");
      flash(`"${data.name}" added successfully.`);
      loadIndustries();
    }
    setAddSaving(false);
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "sans-serif",
    border: "0.5px solid #ddd", borderRadius: 6, background: "#fff",
    color: "#111", boxSizing: "border-box", outline: "none",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 10, fontFamily: "monospace", color: "#aaa",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Header */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>Admin Panel</h1>
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

        {/* Feedback banners */}
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

        {/* Industries list */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>
            Industries ({industries.filter(i => i.active).length} active)
          </p>

          {loading ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#ccc" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {industries.map((ind) => (
                <div
                  key={ind.id}
                  style={{
                    background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 10,
                    overflow: "hidden", opacity: ind.active ? 1 : 0.6,
                  }}
                >
                  {editingSlug === ind.slug ? (
                    /* ── Edit mode ── */
                    <div style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={label}>Name</label>
                          <input
                            style={input}
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div style={{ width: 70 }}>
                          <label style={label}>Icon</label>
                          <input
                            style={{ ...input, textAlign: "center", fontSize: 20 }}
                            value={editForm.icon}
                            onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                            maxLength={2}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                        {EMOJI_SUGGESTIONS.map(e => (
                          <button key={e} onClick={() => setEditForm(f => ({ ...f, icon: e }))}
                            style={{ fontSize: 17, padding: "3px 5px", cursor: "pointer", border: editForm.icon === e ? "1px solid #111" : "0.5px solid #e5e5e5", borderRadius: 5, background: editForm.icon === e ? "#f5f5f4" : "transparent" }}>
                            {e}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={label}>Search focus areas</label>
                        <textarea
                          style={{ ...input, minHeight: 100, resize: "vertical" }}
                          value={editForm.focus}
                          onChange={e => setEditForm(f => ({ ...f, focus: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => saveEdit(ind.slug)}
                          disabled={saving}
                          style={{ flex: 1, padding: "10px 0", fontSize: 13, fontFamily: "sans-serif", cursor: "pointer", border: "1px solid #111", borderRadius: 7, background: "#111", color: "#fff", fontWeight: 500, opacity: saving ? 0.6 : 1 }}
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: "10px 16px", fontSize: 13, fontFamily: "sans-serif", cursor: "pointer", border: "0.5px solid #ddd", borderRadius: 7, background: "transparent", color: "#888" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 24, marginTop: 2 }}>{ind.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <p style={{ margin: 0, fontSize: 15, color: "#111", fontWeight: "normal" }}>{ind.name}</p>
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#ccc" }}>/{ind.slug}</span>
                            {!ind.active && (
                              <span style={{ fontSize: 10, fontFamily: "monospace", color: "#f9a8d4", background: "#fdf2f8", padding: "1px 6px", borderRadius: 3 }}>hidden</span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "#aaa", fontFamily: "sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {ind.focus.length > 180 ? ind.focus.slice(0, 180) + "…" : ind.focus}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <Link href={`/digest/${ind.slug}`}
                            style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none", padding: "5px 10px", border: "0.5px solid #e5e5e5", borderRadius: 5 }}>
                            View ↗
                          </Link>
                          <button onClick={() => startEdit(ind)}
                            style={{ fontSize: 11, fontFamily: "monospace", cursor: "pointer", padding: "5px 10px", border: "0.5px solid #e5e5e5", borderRadius: 5, background: "transparent", color: "#666" }}>
                            Edit
                          </button>
                          <button onClick={() => toggleActive(ind.slug, ind.active)}
                            style={{ fontSize: 11, fontFamily: "monospace", cursor: "pointer", padding: "5px 10px", border: "0.5px solid #e5e5e5", borderRadius: 5, background: "transparent", color: ind.active ? "#888" : "#22c55e" }}>
                            {ind.active ? "Hide" : "Show"}
                          </button>
                          <button onClick={() => deleteIndustry(ind.slug, ind.name)} disabled={deleting === ind.slug}
                            style={{ fontSize: 11, fontFamily: "monospace", cursor: "pointer", padding: "5px 10px", border: "0.5px solid #fca5a5", borderRadius: 5, background: "transparent", color: "#ef4444", opacity: deleting === ind.slug ? 0.5 : 1 }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Industry name</label>
              <input style={input} placeholder="e.g. Music & Entertainment" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div style={{ width: 70 }}>
              <label style={label}>Icon</label>
              <input style={{ ...input, textAlign: "center", fontSize: 20 }} value={newIcon} onChange={e => setNewIcon(e.target.value)} maxLength={2} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {EMOJI_SUGGESTIONS.map(e => (
              <button key={e} onClick={() => setNewIcon(e)}
                style={{ fontSize: 17, padding: "3px 5px", cursor: "pointer", border: newIcon === e ? "1px solid #111" : "0.5px solid #e5e5e5", borderRadius: 5, background: newIcon === e ? "#f5f5f4" : "transparent" }}>
                {e}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Search focus areas</label>
            <textarea
              style={{ ...input, minHeight: 100, resize: "vertical" }}
              placeholder={"Describe what the AI should search for. e.g.\nAI tools for music production\nAI and music copyright\nStreaming platform AI recommendations..."}
              value={newFocus}
              onChange={e => setNewFocus(e.target.value)}
            />
            <p style={{ margin: "5px 0 0", fontSize: 11, fontFamily: "monospace", color: "#ccc" }}>
              These focus areas shape what the AI searches for when generating the digest.
            </p>
          </div>
          <button
            onClick={addIndustry} disabled={addSaving}
            style={{ width: "100%", padding: "12px 0", fontSize: 14, fontFamily: "sans-serif", cursor: addSaving ? "not-allowed" : "pointer", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 500, opacity: addSaving ? 0.6 : 1 }}
          >
            {addSaving ? "Adding..." : "Add industry"}
          </button>
        </div>

      </div>
    </main>
  );
}
