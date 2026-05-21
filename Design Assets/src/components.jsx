/* global React */
// Shared atoms + iconography. Exposed to window so other scripts can use them.

const { useState, useMemo } = React;

// ── Inline SVG icons (single-stroke, 16px default) ──────────────────────────
const ic = (path, vb = "0 0 24 24") => ({ size = 16, color = "currentColor", ...rest }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke={color}
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {path}
  </svg>
);
const Icon = {
  Home:      ic(<><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></>),
  Doc:       ic(<><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6M10 8h2"/></>),
  Chat:      ic(<><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></>),
  Briefcase: ic(<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 12h18"/></>),
  Check:     ic(<path d="M4 12l5 5L20 6"/>),
  CheckCircle: ic(<><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></>),
  Star:      ic(<path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.5 3 1.1-6.3L3 9.6l6.3-.9z"/>),
  Compass:   ic(<><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6z"/></>),
  Lightning: ic(<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>),
  LinkedIn:  ic(<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5"/><path d="M12 17v-4a2 2 0 014 0v4"/><path d="M12 10v7"/></>),
  Upload:    ic(<><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></>),
  Sparkle:   ic(<><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 16l.7 1.8L21.5 18l-1.8.7L19 20.5l-.7-1.8L16.5 18l1.8-.5z"/></>),
  Pencil:    ic(<><path d="M4 20l4-1L20 7l-3-3L5 16z"/><path d="M14 6l3 3"/></>),
  Plus:      ic(<><path d="M12 5v14M5 12h14"/></>),
  Filter:    ic(<path d="M3 5h18l-7 9v6l-4-2v-4z"/>),
  Search:    ic(<><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></>),
  Send:      ic(<><path d="M4 12l16-8-6 18-3-7z"/><path d="M11 13l3-3"/></>),
  Settings:  ic(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  Chevron:   ic(<path d="M6 9l6 6 6-6"/>),
  ChevronR:  ic(<path d="M9 6l6 6-6 6"/>),
  Map:       ic(<><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></>),
  Bell:      ic(<><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></>),
  Mail:      ic(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>),
  X:         ic(<path d="M6 6l12 12M18 6L6 18"/>),
  Refresh:   ic(<><path d="M4 12a8 8 0 0114-5l2-2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5l-2 2"/><path d="M4 20v-5h5"/></>),
  Eye:       ic(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  Clock:     ic(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
};

// ── Avatar — 2-letter monogram tile (no photos, document-centric brand) ────
function Avatar({ name = "M K", size = 28, tone = "ink" }) {
  const tones = {
    ink:    ["var(--ink-100)",  "var(--ink-900)"],
    sage:   ["var(--sage-100)", "var(--sage-900)"],
    ochre:  ["var(--ochre-100)","var(--ochre-900)"],
    paper:  ["var(--paper-3)",  "var(--text-soft)"],
  };
  const [bg, fg] = tones[tone] || tones.ink;
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: bg, color: fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: 0.5,
      fontFamily: "var(--font-sans)", flexShrink: 0,
    }}>{initials}</div>
  );
}

// ── AI provenance badge ───────────────────────────────────────────────────
function AiBadge({ label = "AI suggestion" }) {
  return <span className="ai-badge">{label}</span>;
}

// ── Status pill ───────────────────────────────────────────────────────────
function StatusPill({ status = "draft" }) {
  const map = { draft: "Draft", reviewed: "Reviewed", approved: "Approved", ai: "AI-generated" };
  return <span className={"pill pill-" + status}>{map[status] || status}</span>;
}

// ── Skill chip with state ─────────────────────────────────────────────────
function Chip({ children, tone = "default", icon }) {
  const c = { default: "chip", match: "chip chip-match", missing: "chip chip-missing", ink: "chip chip-ink" }[tone];
  return <span className={c}>{icon}{children}</span>;
}

// ── Score ring (60×60 default) ────────────────────────────────────────────
function ScoreRing({ value = 84, size = 56, label = "match" }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const tone = value >= 80 ? "var(--sage-700)" : value >= 60 ? "var(--ink-700)" : "var(--ochre-700)";
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--paper-3)" strokeWidth="4" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={tone} strokeWidth="4" fill="none"
                strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"/>
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontSize: size * 0.36, lineHeight: 1,
      }}>
        {value}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: 0.1, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase" }}>{label}</span>
      </div>
    </div>
  );
}

// ── Page chrome: desktop sidebar ──────────────────────────────────────────
function Sidebar({ active = "Resume" }) {
  const main = [
    ["Dashboard",  Icon.Home],
    ["Resume",     Icon.Doc],
    ["Jobs",       Icon.Briefcase],
    ["Tailoring",  Icon.Sparkle],
    ["Approvals",  Icon.CheckCircle],
  ];
  const grow = [
    ["Skill roadmap", Icon.Map],
    ["LinkedIn",      Icon.LinkedIn],
  ];
  const Item = ([label, I]) => (
    <div className={"nav-item" + (label === active ? " active" : "")} key={label}>
      <I/> <span>{label}</span>
    </div>
  );
  return (
    <aside className="sidebar">
      <div className="logo"><i>C</i><span>Copilot</span></div>
      {main.map(Item)}
      <div className="nav-section">Growth</div>
      {grow.map(Item)}
      <div style={{ flex: 1 }}/>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: "1px solid var(--line-2)" }}>
        <Avatar name="Maya K" tone="ink"/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Maya Kapoor</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Free plan</div>
        </div>
        <Icon.Settings size={14}/>
      </div>
    </aside>
  );
}

// ── Page chrome: desktop topbar ───────────────────────────────────────────
function Topbar({ title, eyebrow, right }) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em" }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div>
    </div>
  );
}

// ── Document placeholder (striped) for empty image slots ─────────────────
function Placeholder({ width = "100%", height = 120, label = "asset" }) {
  return (
    <div style={{
      width, height, borderRadius: 10,
      background: "repeating-linear-gradient(135deg, var(--paper-2) 0 10px, var(--paper-3) 10px 20px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11,
    }}>{label}</div>
  );
}

// ── Annotation callout (used to label parts of a screen) ─────────────────
function Annotation({ children, x, y, w = 200, anchor = "left" }) {
  return (
    <div style={{
      position: "absolute", top: y, left: anchor === "left" ? x : "auto", right: anchor === "right" ? x : "auto",
      width: w, fontFamily: "var(--font-mono)", fontSize: 10.5,
      color: "var(--ochre-900)", lineHeight: 1.5, letterSpacing: 0.02,
      pointerEvents: "none",
    }}>
      <span style={{ borderTop: "1px solid var(--ochre-700)", display: "inline-block", width: 18, verticalAlign: "middle", marginRight: 6 }}/>
      {children}
    </div>
  );
}

// Expose
Object.assign(window, { Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing, Sidebar, Topbar, Placeholder, Annotation });
