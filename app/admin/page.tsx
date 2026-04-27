"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Industry } from "@/lib/supabase";
import {
  Megaphone, Scale, TrendingUp, HeartPulse, Zap, Sprout, Cpu, Factory,
  HardHat, Truck, GraduationCap, Shield, Wrench, Music, ShoppingBag,
  Globe, Building2, Landmark, FlaskConical, Plane, LucideIcon
} from "lucide-react";

const ICON_OPTIONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "megaphone",    label: "Media",       Icon: Megaphone },
  { id: "scale",        label: "Legal",       Icon: Scale },
  { id: "trending-up",  label: "Finance",     Icon: TrendingUp },
  { id: "heart-pulse",  label: "Health",      Icon: HeartPulse },
  { id: "zap",          label: "Energy",      Icon: Zap },
  { id: "sprout",       label: "Agriculture", Icon: Sprout },
  { id: "cpu",          label: "Technology",  Icon: Cpu },
  { id: "factory",      label: "Manufacturing", Icon: Factory },
  { id: "hard-hat",     label: "Construction", Icon: HardHat },
  { id: "truck",        label: "Logistics",   Icon: Truck },
  { id: "graduation-cap", label: "Education", Icon: GraduationCap },
  { id: "shield",       label: "Defense",     Icon: Shield },
  { id: "wrench",       label: "Engineering", Icon: Wrench },
  { id: "music",        label: "Music",       Icon: Music },
  { id: "shopping-bag", label: "Retail",      Icon: ShoppingBag },
  { id: "globe",        label: "Global",      Icon: Globe },
  { id: "building-2",   label: "Property",    Icon: Building2 },
  { id: "landmark",     label: "Government",  Icon: Landmark },
  { id: "flask",        label: "Science",     Icon: FlaskConical },
  { id: "plane",        label: "Aviation",    Icon: Plane },
];

function IconPreview({ iconId, size = 20 }: { iconId: string; size?: number }) {
  const found = ICON_OPTIONS.find(o => o.id === iconId);
  if (!found) return <Globe size={size} color="currentColor" />;
  return <found.Icon size={size} color="currentColor" />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: 6 }}>
      {ICON_OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "9px 4px 7px", cursor: "pointer", borderRadius: 8,
            border: value === id ? "1.5px solid #111" : "0.5px solid #e5e5e5",
            background: value === id ? "#f5f5f4" : "#fff",
            transition: "all 0.1s",
          }}
        >
          <Icon size={18} color={value === id ? "#111" : "#aaa"} strokeWidth={1.5} />
          <span style={{ fontSize: 9, fontFamily: "sans-serif", color: value === id ? "#555" : "#bbb", lineHeight: 1.2, textAlign: "center" }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", icon: "globe", focus: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("globe");
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
    setEditForm({ name: "", icon: "globe", focus: "" });
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
      setNewName(""); setNewIcon("globe"); setNewFocus("");
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
  const labelStyle: React.CSSProperties = {
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

        {/* Feedback */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {industries.map((ind) => (
                <div key={ind.id} style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 10, overflow: "hidden", opacity: ind.active ? 1 : 0.6 }}>
                  {editingSlug === ind.slug ? (
                    /* Edit mode */
                    <div style={{ padding: "18px 20px" }}>
                      <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Industry name</label>
                        <input style={input} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Icon</label>
                        <IconPicker value={editForm.icon} onChange={icon => setEditForm(f => ({ ...f, icon }))} />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Search focus areas</label>
                        <textarea style={{ ...input, minHeight: 100, resize: "vertical" }} value={editForm.focus} onChange={e => setEditForm(f => ({ ...f, focus: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => saveEdit(ind.slug)} disabled={saving}
                          style={{ flex: 1, padding: "10px 0", fontSize: 13, fontFamily: "sans-serif", cursor: "pointer", border: "1px solid #111", borderRadius: 7, background: "#111", color: "#fff", fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                        <button onClick={cancelEdit}
                          style={{ padding: "10px 16px", fontSize: 13, fontFamily: "sans-serif", cursor: "pointer", border: "0.5px solid #ddd", borderRadius: 7, background: "transparent", color: "#888" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <IconPreview iconId={ind.icon} size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ margin: 0, fontSize: 15, color: "#111" }}>{ind.name}</p>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#ccc" }}>/{ind.slug}</span>
                          {!ind.active && (
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#f9a8d4", background: "#fdf2f8", padding: "1px 6px", borderRadius: 3 }}>hidden</span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#aaa", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                          {ind.focus.length > 160 ? ind.focus.slice(0, 160) + "…" : ind.focus}
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

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Industry name</label>
            <input style={input} placeholder="e.g. Music & Entertainment" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Icon</label>
            <IconPicker value={newIcon} onChange={setNewIcon} />
          </div>

          {/* Preview */}
          {newName && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f9f9f8", borderRadius: 8, border: "0.5px solid #e5e5e5", marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", border: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconPreview iconId={newIcon} size={18} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: "#111", fontFamily: "sans-serif" }}>{newName}</p>
                <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#bbb" }}>
                  /{newName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")}
                </p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Search focus areas</label>
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

          <button onClick={addIndustry} disabled={addSaving}
            style={{ width: "100%", padding: "12px 0", fontSize: 14, fontFamily: "sans-serif", cursor: addSaving ? "not-allowed" : "pointer", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 500, opacity: addSaving ? 0.6 : 1 }}>
            {addSaving ? "Adding..." : "Add industry"}
          </button>
        </div>

        {/* Hidden admin link */}
        <p style={{ textAlign: "center", marginTop: 40 }}>
          <Link href="/" style={{ fontSize: 10, fontFamily: "monospace", color: "#ddd", textDecoration: "none" }}>
            ← back to dashboard
          </Link>
        </p>

      </div>
    </main>
  );
}
