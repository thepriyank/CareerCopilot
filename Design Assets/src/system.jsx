/* global React, Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing, Placeholder */
// Design-system overview artboards — colors, type, components.

// ── Color palette card ──
function PaletteCard({ name, swatches }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div className="serif" style={{ fontSize: 22 }}>{name}</div>
        <div className="eyebrow">family</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {swatches.map(([token, role]) => (
          <div key={token} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: `var(${token})`, border: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11.5 }}>{token.replace("--", "")}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignSystemArtboard() {
  return (
    <div className="app-root" style={{ width: 1280, padding: 56, background: "var(--paper)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">01 · Foundations</div>
          <h1 className="display" style={{ fontSize: 56, marginTop: 8 }}>A calm, editorial system for a workspace that handles careers.</h1>
          <p style={{ marginTop: 16, color: "var(--text-soft)", fontSize: 15, maxWidth: 560 }}>
            Document-centric. Generous whitespace. Color used sparingly — saved for AI provenance and status.
            The brand reads as a quiet professional tool, not a marketing surface.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <div className="mono">v0.1 · 2026.05</div>
          <div className="mono">Trust · Clarity · Control</div>
        </div>
      </div>

      {/* Colors */}
      <SectionTitle n="A" t="Color" sub="Three tonal families and the semantic set. Color carries meaning — never decoration."/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 40 }}>
        <PaletteCard name="Ink" swatches={[
          ["--ink-900", "Primary · trust"],
          ["--ink-700", "Hover / emphasis"],
          ["--ink-500", "Subdued text"],
          ["--ink-100", "Selected nav, tints"],
        ]}/>
        <PaletteCard name="Sage" swatches={[
          ["--sage-900", "Match / success ink"],
          ["--sage-500", "Score progress"],
          ["--sage-200", "Match chip border"],
          ["--sage-100", "Match chip fill"],
        ]}/>
        <PaletteCard name="Ochre" swatches={[
          ["--ochre-900", "AI label · accent"],
          ["--ochre-500", "AI underline"],
          ["--ochre-200", "Edited content border"],
          ["--ochre-100", "AI/edited fill"],
        ]}/>
      </div>

      {/* Semantic + neutrals */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 48 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Semantic</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              ["Success","--success","--success-bg"],
              ["Warning","--warning","--warning-bg"],
              ["Error","--error","--error-bg"],
              ["Info","--info","--info-bg"],
            ].map(([n,f,b]) => (
              <div key={n} style={{ background: `var(${b})`, padding: 12, borderRadius: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: `var(${f})`, marginBottom: 8 }}/>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{n}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{f.slice(2)}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
            Status is never color-only — every state pairs a swatch with a label and an icon. Contrast ≥ 4.5:1 on body, 3:1 on UI elements.
          </p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Neutrals · warm paper</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["#fbfaf7","#f5f3ee","#ecebe4","#b3aca3","#847d75","#4a4540","#1c1917"].map(c => (
              <div key={c} style={{ flex: 1, height: 80, background: c, borderRadius: 6, position: "relative", border: "1px solid rgba(0,0,0,0.04)" }}>
                <span className="mono" style={{ position: "absolute", bottom: 4, left: 6, fontSize: 9.5, color: c === "#1c1917" || c === "#4a4540" ? "#fff" : "var(--text-muted)" }}>{c}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
            Paper is the canvas: #fbfaf7. Slightly warm to feel like an editorial document, not a SaaS dashboard.
          </p>
        </div>
      </div>

      {/* Type */}
      <SectionTitle n="B" t="Typography" sub="Instrument Serif for editorial moments. Geist for the workspace. JetBrains Mono for documents and code-like data."/>
      <div className="card" style={{ padding: 28, marginBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "baseline" }}>
          {[
            ["Display", "56 / -2.5%", <span className="display" style={{ fontSize: 56 }}>Master your story.</span>],
            ["Heading 1", "40 / -2%",   <span className="display" style={{ fontSize: 40 }}>Tailor every application.</span>],
            ["Heading 2", "28 / -2%",   <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>Senior Product Designer</span>],
            ["Heading 3", "20 / -1%",   <span style={{ fontSize: 20, fontWeight: 500 }}>Match explanation</span>],
            ["Body",      "14 / 0",     <span>Built a design system used by 40+ product teams, reducing time-to-prototype by 38%.</span>],
            ["Small",     "13 / 0",     <span style={{ fontSize: 13, color: "var(--text-soft)" }}>Stripe · 2022 – Present · San Francisco</span>],
            ["Mono",      "12 / 0",     <span className="mono" style={{ fontSize: 12 }}>match_score · 0.84 · confidence · 0.91</span>],
            ["Eyebrow",   "10 · UPPER", <span className="eyebrow">tailored resume · v3</span>],
          ].map(([n, spec, sample]) => (
            <React.Fragment key={n}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{n}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{spec}</div>
              </div>
              <div style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 14, marginBottom: -14 }}>{sample}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Spacing + radius */}
      <SectionTitle n="C" t="Spacing & radius" sub="4-px base grid. Radii lean small — documents over candy."/>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 40 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Spacing scale</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            {[4,8,12,16,20,24,32,40,48,64].map(v => (
              <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: v, background: "var(--ink-900)", borderRadius: 3 }}/>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Radius</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            {[["r-1",4],["r-2",8],["r-3",12],["r-4",16],["pill","999"]].map(([n,v]) => (
              <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 56, height: 56, background: "var(--paper-3)", borderRadius: v === "999" ? 999 : Number(v), border: "1px solid var(--line)" }}/>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{n}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Component samples */}
      <SectionTitle n="D" t="Core components" sub="The pieces every screen reuses."/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Buttons */}
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Buttons</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <button className="btn btn-primary">Approve for this job</button>
            <button className="btn btn-secondary">Edit manually</button>
            <button className="btn btn-ai"><Icon.Sparkle size={14}/> Regenerate</button>
            <button className="btn btn-ghost">Cancel</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button className="btn btn-primary btn-sm">Upload</button>
            <button className="btn btn-secondary btn-sm">View diff</button>
            <button className="btn btn-primary btn-lg">Upload resume</button>
          </div>
        </div>

        {/* Chips + pills */}
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Chips & status</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Chip tone="match" icon={<Icon.Check size={11}/>}>React</Chip>
            <Chip tone="match" icon={<Icon.Check size={11}/>}>TypeScript</Chip>
            <Chip tone="missing">+ System design</Chip>
            <Chip tone="missing">+ GraphQL</Chip>
            <Chip tone="ink">Remote</Chip>
            <Chip>Mid-level</Chip>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatusPill status="draft"/>
            <StatusPill status="reviewed"/>
            <StatusPill status="approved"/>
            <StatusPill status="ai"/>
          </div>
        </div>

        {/* AI provenance */}
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>AI provenance — three visual cues</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AiBadge/><span style={{ color: "var(--text-soft)" }}>Pill marker on any AI-generated block.</span>
            </div>
            <div>
              "Led the platform redesign and <span className="ai-edit">drove a 38% reduction in time-to-prototype</span> across the org."
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Underline + ochre tint on AI-edited spans.</div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <span className="del">improved performance</span> <span className="ins">reduced TTI by 1.4s on p75</span>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Inline diff: red strikethrough · green insertion.</div>
            </div>
          </div>
        </div>

        {/* Score ring */}
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Match score</div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <ScoreRing value={84}/>
            <ScoreRing value={67}/>
            <ScoreRing value={42}/>
            <div style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
              80–100 sage · 60–79 ink · &lt;60 ochre. Always paired with the matched-skills explanation — never numeric alone.
            </div>
          </div>
        </div>
      </div>

      {/* Components inventory list */}
      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Component inventory</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22, fontSize: 12.5 }}>
          {[
            ["Navigation", ["Sidebar · desktop","Topbar","Mobile tabbar","Breadcrumb"]],
            ["Surfaces",   ["Card","Doc surface","Split pane","Sticky bottom bar (m)"]],
            ["Inputs",     ["Text · multiline","Dropzone","Chat composer","Filter pills"]],
            ["Data",       ["Skill chip","Match score","Score bar","Confidence meter"]],
            ["AI",         ["AI badge","Edit highlight","Diff viewer","Rationale callout"]],
            ["Status",     ["Status pill","Toast","Inline validation","Empty state"]],
            ["Document",   ["Resume canvas","Cover letter","Outline list","Section header"]],
            ["Feedback",   ["Toast","Confirm modal","Skeleton row","Loading shimmer"]],
          ].map(([g, items]) => (
            <div key={g}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 0.1, textTransform: "uppercase" }}>{g}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map(i => <div key={i} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 4 }}>{i}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 48, padding: 28, background: "var(--ink-900)", color: "var(--text-onink)", borderRadius: 16 }}>
        <div className="eyebrow" style={{ color: "rgba(245,243,238,0.55)" }}>Design rationale</div>
        <div className="display" style={{ fontSize: 28, marginTop: 6, maxWidth: 920 }}>
          The system whispers. Resumes are intimate documents; the UI gets out of the way so the work — and the user's
          control over AI — is what people see.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, marginTop: 28, fontSize: 13, color: "rgba(245,243,238,0.75)" }}>
          <div>
            <strong style={{ color: "#fff" }}>Trust</strong> — deep ink for primary actions, warm paper canvas, no gradients
            or playful color. Reads as a workspace, not marketing.
          </div>
          <div>
            <strong style={{ color: "#fff" }}>Clarity</strong> — every AI surface is tagged with a badge, an ochre underline,
            or a diff. The user can always answer "what did the AI do?"
          </div>
          <div>
            <strong style={{ color: "#fff" }}>Control</strong> — Draft → Reviewed → Approved status pills carry through every
            artifact. Nothing leaves the platform until the user marks it approved.
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ n, t, sub }) {
  return (
    <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{n}</div>
      <div className="serif" style={{ fontSize: 28 }}>{t}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", borderLeft: "1px solid var(--line)", paddingLeft: 12, flex: 1 }}>{sub}</div>
    </div>
  );
}

Object.assign(window, { DesignSystemArtboard });
