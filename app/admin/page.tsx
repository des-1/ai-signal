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
  { id: "megaphone",      label: "Media",         Icon: Megaphone },
  { id: "scale",          label: "Legal",         Icon: Scale },
  { id: "trending-up",    label: "Finance",       Icon: TrendingUp },
  { id: "heart-pulse",    label: "Health",        Icon: HeartPulse },
  { id: "zap",            label: "Energy",        Icon: Zap },
  { id: "sprout",         label: "Agriculture",   Icon: Sprout },
  { id: "cpu",            label: "Technology",    Icon: Cpu },
  { id: "factory",        label: "Manufacturing", Icon: Factory },
  { id: "hard-hat",       label: "Construction",  Icon: HardHat },
  { id: "truck",          label: "Logistics",     Icon: Truck },
  { id: "graduation-cap", label: "Education",     Icon: GraduationCap },
  { id: "shield",         label: "Defense",       Icon: Shield },
  { id: "wrench",         label: "Engineering",   Icon: Wrench },
  { id: "music",          label: "Music",         Icon: Music },
  { id: "shopping-bag",   label: "Retail",        Icon: ShoppingBag },
  { id: "globe",          label: "Global",        Icon: Globe },
  { id: "building-2",     label: "Property",      Icon: Building2 },
  { id: "landmark",       label: "Government",    Icon: Landmark },
  { id: "flask",          label: "Science",       Icon: FlaskConical },
  { id: "plane",          label: "Aviation",      Icon: Plane },
];

function IconPreview({ iconId, size = 20 }: { iconId: string; size?: number }) {
  const found = ICON_OPTIONS.find(o => o.id === iconId);
  if (!found) return <Globe size={size} color="currentColor" />;
  return <found.Icon size={size} color="currentColor" />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 6 }}>
      {ICON_OPTIONS.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "10px 4px 8px", cursor: "pointer", borderRadius: 8,
          border: value === id ? "1.5px solid #111" : "0.5px solid #e5e5e5",
          background: value === id ? "#f5f5f4" : "#fff", transition: "all 0.1s",
        }}>
          <Icon size={18} color={value === id ? "#111" : "#aaa"} strokeWidth={1.5} />
          <span style={{ fontSize: 9, fontFamily: "sans-serif", color: value === id ? "#555" : "#bbb", lineHeight: 1.2, textAlign: "center" }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontSize: 12, fontFamily: "monospace", cursor: "pointer",
  padding: "7px 12px", border: "0.5px solid #e5e5e5", borderRadius: 6,
  background: "transparent", color: "#666", whiteSpace: "nowrap" as const,
  ...extra,
});

export default function AdminPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
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
    if (!editForm.name.trim() || !editForm.focus.trim()) { setError("Name and focus are required."); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/industries/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, icon: editForm.icon, focus: editForm.focus }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to save"); }
    else { setEditingSlug(null); flash("Changes saved."); loadIndustries(); }
    setSaving(false);
  }

  async function toggleActive(slug: string, current: boolean) {
    await fetch(`/api/industries/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    loadIndustries();
  }

  async function deleteIndustry(slug: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all its saved digests. Cannot be undone.`)) return;
    setDeleting(slug);
    await fetch(`/api/industries/${slug}`, { method: "DELETE" });
    setDeleting(null); loadIndustries();
  }

  async function generateDigest(slug: string) {
    setGenerating(slug);
    try {
      const res = await fetch(`/api/digest?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      flash(`Digest generated for ${slug}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setGenerating(null); }
  }

  async function addIndustry() {
    if (!newName.trim() || !newFocus.trim()) { setError("Name and focus areas are required."); return; }
    setAddSaving(true); setError("");
    const res = await fetch("/api/industries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, icon: newIcon, focus: newFocus }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to create industry"); }
    else { setNewName(""); setNewIcon("globe"); setNewFocus(""); flash(`"${data.name}" added.`); loadIndustries(); }
    setAddSaving(false);
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(""), 3500); }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: "sans-serif",
    border: "0.5px solid #ddd", borderRadius: 8, background: "#fff",
    color: "#111", boxSizing: "border-box", outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 10, fontFamily: "monospace", color: "#aaa",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#fafaf9", padding: "1.5rem 1rem" }}>
      <style>{`
        @media (max-width: 600px) {
          .ind-card-inner { flex-direction: column !important; gap: 10px !important; }
          .ind-card-top { flex-direction: row; align-items: flex-start; }
          .ind-actions { flex-wrap: wrap !important; width: 100%; }
          .ind-actions button, .ind-actions a { flex: 1; text-align: center; justify-content: center; }
        }
      `}</style>

      <div style={{ maxWidth: 700, margin: "0 auto", fontFamily: "'Georgia', serif" }}>

        {/* Header */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 10, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: "normal", letterSpacing: "-0.02em", color: "#111" }}>Admin Panel</h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                AI Signal — RepresentAI
              </p>
            </div>
            <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", textDecoration: "none" }}>← Dashboard</Link>
          </div>
          <div style={{ borderBottom: "0.5px solid #ddd", marginTop: 10 }} />
        </div>

        {/* Feedback */}
        {error && <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontFamily: "sans-serif", marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontSize: 13, fontFamily: "sans-serif", marginBottom: 16 }}>{success}</div>}

        {/* Industries */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>
            Industries ({industries.filter(i => i.active).length} active)
          </p>

          {loading ? <p style={{ fontFamily: "monospace", fontSize: 12, color: "#ccc" }}>Loading...</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {industries.map((ind) => (
                <div key={ind.id} style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 10, overflow: "hidden", opacity: ind.active ? 1 : 0.6 }}>

                  {editingSlug === ind.slug ? (
                    <div style={{ padding: "18px 16px" }}>
                      <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Industry name</label>
                        <input style={input} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={lbl}>Search focus areas</label>
                        <textarea style={{ ...input, minHeight: 140, resize: "vertical" }} value={editForm.focus} onChange={e => setEditForm(f => ({ ...f, focus: e.target.value }))} />
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Icon</label>
                        <IconPicker value={editForm.icon} onChange={icon => setEditForm(f => ({ ...f, icon }))} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => saveEdit(ind.slug)} disabled={saving}
                          style={{ flex: 1, padding: "11px 0", fontSize: 14, fontFamily: "sans-serif", cursor: "pointer", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                        <button onClick={cancelEdit}
                          style={{ padding: "11px 16px", fontSize: 14, fontFamily: "sans-serif", cursor: "pointer", border: "0.5px solid #ddd", borderRadius: 8, background: "transparent", color: "#888" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ind-card-inner" style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Icon + name */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <IconPreview iconId={ind.icon} size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                            <p style={{ margin: 0, fontSize: 14, color: "#111" }}>{ind.name}</p>
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#ccc" }}>/{ind.slug}</span>
                            {!ind.active && <span style={{ fontSize: 10, fontFamily: "monospace", color: "#f9a8d4", background: "#fdf2f8", padding: "1px 6px", borderRadius: 3 }}>hidden</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "#aaa", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                            {ind.focus.length > 120 ? ind.focus.slice(0, 120) + "…" : ind.focus}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ind-actions" style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                        <Link href={`/digest/${ind.slug}`}
                          style={{ ...btn(), color: "#aaa", textDecoration: "none", display: "inline-block" }}>
                          View ↗
                        </Link>
                        <button onClick={() => startEdit(ind)} style={btn()}>Edit</button>
                        <button onClick={() => generateDigest(ind.slug)} disabled={generating === ind.slug}
                          style={btn({ color: "#16a34a", borderColor: "#bbf7d0", opacity: generating === ind.slug ? 0.5 : 1 })}>
                          {generating === ind.slug ? "Working..." : "Generate"}
                        </button>
                        <button onClick={() => toggleActive(ind.slug, ind.active)}
                          style={btn({ color: ind.active ? "#888" : "#22c55e" })}>
                          {ind.active ? "Hide" : "Show"}
                        </button>
                        <button onClick={() => deleteIndustry(ind.slug, ind.name)} disabled={deleting === ind.slug}
                          style={btn({ color: "#ef4444", borderColor: "#fca5a5", opacity: deleting === ind.slug ? 0.5 : 1 })}>
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

        {/* Add new */}
        <div style={{ padding: "20px 16px", background: "#fff", borderRadius: 10, border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 18px" }}>
            Add new industry
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Industry name</label>
            <input style={input} placeholder="e.g. Music & Entertainment" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Search focus areas</label>
            <textarea
              style={{ ...input, minHeight: 140, resize: "vertical" }}
              placeholder={"Describe what the AI should search for. e.g.\nAI tools for music production\nAI and music copyright\nStreaming platform AI recommendations..."}
              value={newFocus} onChange={e => setNewFocus(e.target.value)}
            />
            <p style={{ margin: "5px 0 0", fontSize: 11, fontFamily: "monospace", color: "#ccc" }}>
              These focus areas shape what the AI searches for.
            </p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Icon</label>
            <IconPicker value={newIcon} onChange={setNewIcon} />
          </div>

          {newName && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f9f9f8", borderRadius: 8, border: "0.5px solid #e5e5e5", marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", border: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconPreview iconId={newIcon} size={17} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: "#111", fontFamily: "sans-serif" }}>{newName}</p>
                <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#bbb" }}>
                  /{newName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")}
                </p>
              </div>
            </div>
          )}

          <button onClick={addIndustry} disabled={addSaving}
            style={{ width: "100%", padding: "13px 0", fontSize: 15, fontFamily: "sans-serif", cursor: addSaving ? "not-allowed" : "pointer", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 500, opacity: addSaving ? 0.6 : 1 }}>
            {addSaving ? "Adding..." : "Add industry"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/" style={{ fontSize: 11, fontFamily: "monospace", color: "#ccc", textDecoration: "none" }}>← Back to dashboard</Link>
        </p>

      </div>
    </main>
  );
}
