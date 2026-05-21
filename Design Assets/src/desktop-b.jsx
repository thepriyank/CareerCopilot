/* global React, Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing, Sidebar, Topbar, Placeholder */
// Desktop screens part 2 — Tailoring workspace, Approval center, Skill roadmap, LinkedIn review.

function DesktopFrame2({ children }) {
  return (
    <div className="app-root" style={{ width: 1440, height: 900, background: "var(--paper)", overflow: "hidden", display: "flex", position: "relative" }}>{children}</div>
  );
}

// ── 6. JOB DETAIL + TAILORING ─────────────────────────────────────────────
function TailoringDesktop() {
  return (
    <DesktopFrame2>
      <Sidebar active="Tailoring"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar
          eyebrow="Tailoring · Linear"
          title="Senior Product Designer"
          right={<>
            <StatusPill status="draft"/>
            <button className="btn btn-secondary btn-sm"><Icon.Refresh size={13}/> Regenerate</button>
            <button className="btn btn-primary btn-sm">Approve for this job</button>
          </>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.15fr", overflow: "hidden" }}>
          {/* Left: JD + match explanation */}
          <div style={{ borderRight: "1px solid var(--line-2)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>
            <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--line-2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 22 }}>L</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Linear · linear.app · posted 2 days ago</div>
                  <div className="serif" style={{ fontSize: 24, marginTop: 2 }}>Senior Product Designer</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Remote (US/EU) · $190–230k base + equity</div>
                </div>
                <ScoreRing value={87}/>
              </div>
              <div style={{ marginTop: 14, padding: 14, background: "var(--ochre-100)", border: "1px solid var(--ochre-200)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon.Sparkle size={14} color="var(--ochre-900)"/>
                  <div className="eyebrow" style={{ color: "var(--ochre-900)" }}>Why this is a strong match</div>
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--ochre-900)", lineHeight: 1.55 }}>
                  Linear hires designers who love <strong>fast, opinionated tools</strong>. Your Stripe work on developer
                  onboarding and your design-system depth at Notion both align. Your <em>quantified bullets</em> (TTI,
                  adoption numbers) are exactly the proof Linear's hiring designers tend to ask for.
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "16px 28px 28px" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Skill alignment</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div style={{ padding: 12, background: "var(--sage-100)", borderRadius: 10, border: "1px solid var(--sage-200)" }}>
                  <div className="eyebrow" style={{ color: "var(--sage-900)" }}>Matched · 9</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    {["Design systems","Figma","Prototyping","Dev tools","Documentation","Workspace UX","Accessibility","Cross-pod","Quant work"].map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10}/>}>{s}</Chip>)}
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--ochre-100)", borderRadius: 10, border: "1px solid var(--ochre-200)" }}>
                  <div className="eyebrow" style={{ color: "var(--ochre-900)" }}>Gaps · 2</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    <Chip tone="missing">+ Motion design</Chip>
                    <Chip tone="missing">+ Native macOS chrome</Chip>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ochre-900)", marginTop: 8, lineHeight: 1.4 }}>I'll de-emphasise these in the tailored resume and propose courses in your roadmap.</div>
                </div>
              </div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Job description</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-soft)" }}>
                We're hiring a senior product designer to lead the next generation of <mark style={{ background: "var(--sage-100)", color: "inherit", padding: "0 2px" }}>Linear's design system</mark>{" "}
                and core workspace primitives. You'll partner with engineering on <mark style={{ background: "var(--sage-100)", color: "inherit", padding: "0 2px" }}>workspace navigation</mark>, the keyboard model,
                and developer-facing surfaces. We value <mark style={{ background: "var(--sage-100)", color: "inherit", padding: "0 2px" }}>quantified impact</mark>{" "}
                and craft. Experience shipping <mark style={{ background: "var(--ochre-100)", color: "inherit", padding: "0 2px" }}>fluid motion</mark>{" "}
                is a strong plus.
              </div>
              <div style={{ marginTop: 16, padding: 12, background: "var(--paper-2)", borderRadius: 10, fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-soft)" }}>Highlighting key:</strong>{" "}
                <span style={{ background: "var(--sage-100)", padding: "0 4px", borderRadius: 3 }}>matched in your resume</span> ·{" "}
                <span style={{ background: "var(--ochre-100)", padding: "0 4px", borderRadius: 3 }}>gap area</span>
              </div>
            </div>
          </div>

          {/* Right: tabbed editor */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper-2)" }}>
            <div style={{ display: "flex", padding: "16px 24px 0", gap: 8, borderBottom: "1px solid var(--line-2)" }}>
              <Tab active>Tailored resume <span className="pill pill-ai" style={{ marginLeft: 6 }}>AI</span></Tab>
              <Tab>Cover letter <span className="pill pill-draft" style={{ marginLeft: 6 }}>Draft</span></Tab>
              <Tab>Application notes</Tab>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }}><Icon.Eye size={13}/> Compare with master</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              <div className="doc" style={{ maxWidth: 600, margin: "0 auto" }}>
                <h1>Maya Kapoor</h1>
                <div className="meta">Senior Product Designer · San Francisco · maya@kapoor.studio</div>
                <h2>Summary</h2>
                <p>
                  <span className="ai-edit">Senior product designer who turns dense developer workflows into calm, fast tools.</span> Six
                  years at Stripe and Notion, with a focus on <span className="ai-edit">design systems, workspace primitives, and quantified impact</span>.
                </p>
                <h2>Selected experience</h2>
                <h3>Stripe — Senior Product Designer <span className="meta" style={{ float: "right", fontWeight: 400 }}>2022 – Present</span></h3>
                <ul>
                  <li>Led the <span className="ai-edit">workspace-navigation rebuild</span> for Stripe Dashboard, used by 12k merchants in their first 30 days.</li>
                  <li><span className="ai-edit">Built the keyboard model</span> for developer docs — cut time-to-first-API-call by 22%.</li>
                  <li>Cut TTI by 1.4s on p75 across the dashboard shell.</li>
                </ul>
                <h3>Notion — Product Designer <span className="meta" style={{ float: "right", fontWeight: 400 }}>2019 – 2022</span></h3>
                <ul>
                  <li>Designed the database block surface used by ~60% of teams during their first week.</li>
                  <li><span className="ai-edit">Owned the design-system primitives layer</span> across web and macOS.</li>
                </ul>
              </div>
              <div style={{ maxWidth: 600, margin: "16px auto 0", padding: 14, background: "#fff", border: "1px dashed var(--ochre-500)", borderRadius: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Icon.Sparkle size={16} color="var(--ochre-900)"/>
                <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-soft)" }}>
                  <strong style={{ color: "var(--ochre-900)" }}>3 changes vs your master resume.</strong>{" "}
                  Reframed your Stripe lead role around <em>workspace navigation</em> + <em>keyboard model</em> to match Linear's JD. No new facts introduced.
                </div>
                <button className="btn btn-secondary btn-sm">See full diff</button>
              </div>
            </div>
            {/* Sticky bottom controls */}
            <div style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", background: "var(--paper)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                <span className="mono">v2</span>
                <span>·</span>
                <span>auto-saved 11s ago</span>
              </div>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-ghost btn-sm">Revert to master</button>
              <button className="btn btn-ai btn-sm"><Icon.Sparkle size={13}/> Regenerate this section</button>
              <button className="btn btn-primary btn-sm">Approve for Linear</button>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame2>
  );
}
function Tab({ children, active }) {
  return (
    <div style={{
      padding: "10px 14px", fontSize: 13.5, fontWeight: active ? 500 : 400,
      color: active ? "var(--text)" : "var(--text-muted)",
      borderBottom: "2px solid " + (active ? "var(--ink-900)" : "transparent"),
      marginBottom: -1, cursor: "pointer", display: "flex", alignItems: "center",
    }}>{children}</div>
  );
}

// ── 7. REVIEW & APPROVAL CENTER ───────────────────────────────────────────
const APPROVALS = [
  { co: "Linear", role: "Senior Product Designer", artifacts: [
    { type: "Resume", status: "reviewed", v: 2, edits: 7, ai: 5, lastEdit: "12m ago" },
    { type: "Cover letter", status: "draft", v: 1, edits: 0, ai: 1, lastEdit: "12m ago" },
  ]},
  { co: "Vercel", role: "Staff Product Designer", artifacts: [
    { type: "Resume", status: "approved", v: 3, edits: 12, ai: 4, lastEdit: "1d ago" },
    { type: "Cover letter", status: "approved", v: 2, edits: 4, ai: 1, lastEdit: "1d ago" },
  ]},
  { co: "Notion", role: "Lead Designer, Databases", artifacts: [
    { type: "Resume", status: "draft", v: 1, edits: 0, ai: 8, lastEdit: "2d ago" },
  ]},
  { co: "Ramp", role: "Sr. Product Designer, Card", artifacts: [
    { type: "Resume", status: "reviewed", v: 2, edits: 3, ai: 6, lastEdit: "3d ago" },
    { type: "Cover letter", status: "reviewed", v: 1, edits: 2, ai: 2, lastEdit: "3d ago" },
  ]},
];
function ApprovalsDesktop() {
  return (
    <DesktopFrame2>
      <Sidebar active="Approvals"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Review & approval" title="Everything waiting on you"
          right={<>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>4 jobs · 7 artifacts</div>
            <button className="btn btn-secondary btn-sm"><Icon.Filter size={13}/> Filter</button>
            <button className="btn btn-primary btn-sm">Approve all reviewed</button>
          </>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 380px", overflow: "hidden" }}>
          {/* Status filters */}
          <div style={{ borderRight: "1px solid var(--line-2)", padding: 20, background: "var(--paper)" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>By status</div>
            {[
              ["All", 7, true],
              ["Draft", 2, false],
              ["Reviewed", 3, false],
              ["Approved", 2, false],
            ].map(([n, c, a]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: a ? "var(--ink-100)" : "transparent", color: a ? "var(--ink-900)" : "var(--text-soft)", fontWeight: a ? 500 : 400, fontSize: 13, marginBottom: 2 }}>
                <span>{n}</span><span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{c}</span>
              </div>
            ))}
            <div className="eyebrow" style={{ marginTop: 22, marginBottom: 12 }}>By artifact</div>
            {[["Resume", 4],["Cover letter", 3]].map(([n,c]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", fontSize: 13, color: "var(--text-soft)" }}>
                <span>{n}</span><span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{c}</span>
              </div>
            ))}
            <div style={{ marginTop: 22, padding: 12, background: "var(--paper-2)", borderRadius: 10, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Approval is the only thing that lets an artifact leave the platform. No auto-apply.
            </div>
          </div>

          {/* List */}
          <div style={{ overflow: "auto", padding: 24, background: "var(--paper-2)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {APPROVALS.map((g, gi) => (
                <div key={g.co} className="card" style={{ overflow: "hidden", borderColor: gi === 0 ? "var(--ink-700)" : undefined, boxShadow: gi === 0 ? "0 0 0 1px var(--ink-700)" : undefined }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 16 }}>{g.co[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{g.role}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.co}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm">Open job</button>
                  </div>
                  {g.artifacts.map((a, ai) => (
                    <div key={a.type} style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "20px 180px 1fr 100px 120px 110px", gap: 14, alignItems: "center", borderTop: ai > 0 ? "1px solid var(--line-2)" : "none", background: gi === 0 && ai === 0 ? "var(--paper-2)" : "transparent" }}>
                      <input type="checkbox" defaultChecked={a.status === "reviewed"}/>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {a.type === "Resume" ? <Icon.Doc size={14}/> : <Icon.Mail size={14}/>}
                        <span style={{ fontSize: 13 }}>{a.type}</span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>v{a.v}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 14 }}>
                        <span><strong style={{ color: "var(--text)" }}>{a.ai}</strong> AI edits</span>
                        <span><strong style={{ color: "var(--text)" }}>{a.edits}</strong> your edits</span>
                        <span>Last · {a.lastEdit}</span>
                      </div>
                      <StatusPill status={a.status}/>
                      <button className="btn btn-secondary btn-sm" style={{ justifyContent: "center" }}><Icon.Eye size={12}/> View diff</button>
                      <button className="btn btn-primary btn-sm" style={{ justifyContent: "center" }} disabled={a.status === "approved"}>
                        {a.status === "approved" ? <><Icon.Check size={12}/> Approved</> : "Approve"}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right: diff preview for selected */}
          <div style={{ borderLeft: "1px solid var(--line-2)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="eyebrow">Diff preview</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>Linear · Resume v2</div>
              </div>
              <StatusPill status="reviewed"/>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              <DiffLine left="6+ years of experience designing for high-growth tech companies"
                        right="Senior product designer who turns dense developer workflows into calm, fast tools"/>
              <DiffLine left="Improved performance metrics across the dashboard"
                        right="Cut TTI by 1.4s on p75 across the dashboard shell"/>
              <DiffLine left="Worked on docs"
                        right="Built the keyboard model for developer docs — cut time-to-first-API-call by 22%"/>
              <DiffLine left="—"
                        right="Owned the design-system primitives layer across web and macOS"
                        op="add"/>
              <div style={{ marginTop: 14, padding: 12, background: "var(--ochre-100)", borderRadius: 10 }}>
                <div className="eyebrow" style={{ color: "var(--ochre-900)" }}>Hallucination check</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, color: "var(--ochre-900)" }}>
                  <Icon.Check size={13}/> All claims grounded in master resume v3
                </div>
              </div>
            </div>
            <div style={{ padding: 14, borderTop: "1px solid var(--line-2)", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Reject</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1.4, justifyContent: "center" }}>Approve for Linear</button>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame2>
  );
}
function DiffLine({ left, right, op = "edit" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 8, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: op === "add" ? "var(--success)" : "var(--ochre-700)" }}/>
        <span style={{ width: 1, flex: 1, background: "var(--line)" }}/>
      </div>
      <div>
        {op !== "add" && <div className="del" style={{ display: "block", marginBottom: 4 }}>{left}</div>}
        <div className="ins" style={{ display: "block" }}>{right}</div>
      </div>
    </div>
  );
}

// ── 8. SKILL ROADMAP ──────────────────────────────────────────────────────
function SkillRoadmapDesktop() {
  return (
    <DesktopFrame2>
      <Sidebar active="Skill roadmap"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Skill roadmap" title="Close the gap to your target roles"
          right={<>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Based on <strong style={{ color: "var(--text)" }}>10 saved jobs</strong></div>
            <button className="btn btn-secondary btn-sm">Switch target set</button>
          </>}/>
        <div style={{ flex: 1, overflow: "auto", padding: 28, background: "var(--paper-2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Hero: top skill gap with detail */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div className="eyebrow">Top gap</div>
                  <div className="serif" style={{ fontSize: 32, marginTop: 4 }}>System design</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Mentioned in 7 of 10 target roles · ranked critical for staff+</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ImpactDial pct={84} label="impact"/>
                  <button className="btn btn-secondary btn-sm">Mark as goal</button>
                </div>
              </div>
              <div style={{ marginTop: 20, padding: 14, background: "var(--paper-2)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon.Sparkle size={14} color="var(--ochre-900)"/><span className="eyebrow" style={{ color: "var(--ochre-900)" }}>Why this matters</span></div>
                <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.55, color: "var(--text-soft)" }}>
                  Linear, Vercel, and Notion all use "system design" as a senior-IC bar — partnering with engineering on
                  rate-limits, data shapes, and platform primitives. Your Stripe role brushes against it; framing two
                  bullets around it would unblock 4 of your saved roles.
                </div>
              </div>
              <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>Recommended courses</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <CourseCard provider="Udemy" title="System Design for Designers" level="Intermediate" hours="6h" rating="4.8"/>
                <CourseCard provider="Maven" title="Designing Distributed Systems UX" level="Advanced" hours="4 weeks" rating="4.7"/>
              </div>
            </div>
            {/* Right: at-a-glance gaps */}
            <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="eyebrow">All identified gaps</div>
              {[
                ["System design",   84, "critical"],
                ["Motion design",   62, "high"],
                ["Compliance UX",   54, "medium"],
                ["Data viz",        48, "medium"],
                ["B2B pricing",     40, "low"],
                ["Edu content",     32, "low"],
              ].map(([n, p, sev]) => (
                <div key={n} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 80px 16px", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <span style={{ fontSize: 13.5 }}>{n}</span>
                  <div className="score-bar"><i style={{ width: p + "%" }}/></div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>{sev}</span>
                  <Icon.ChevronR size={14} color="var(--text-muted)"/>
                </div>
              ))}
            </div>
          </div>

          {/* Learning path / timeline */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="eyebrow">Learning path</div>
                <div className="serif" style={{ fontSize: 22, marginTop: 2 }}>An 8-week plan, designed around your job-search calendar</div>
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
                <button className="btn btn-ghost btn-sm" style={{ background: "var(--paper-3)" }}>Timeline</button>
                <button className="btn btn-ghost btn-sm">List</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, position: "relative" }}>
              <div style={{ position: "absolute", top: 24, left: 24, right: 24, height: 2, background: "var(--line)" }}/>
              {[
                ["Week 1–2","Foundations","System design primer · 6h", "var(--ink-900)"],
                ["Week 3–4","Apply","Refactor 2 Stripe bullets · self", "var(--ink-700)"],
                ["Week 5–6","Stretch","Distributed systems UX · 4w", "var(--ink-500)"],
                ["Week 7–8","Portfolio","Public write-up + critique", "var(--ink-300)"],
              ].map(([w, h, s, c]) => (
                <div key={w} style={{ position: "relative", paddingTop: 36 }}>
                  <div style={{ position: "absolute", top: 16, left: 8, width: 16, height: 16, borderRadius: 999, background: c, border: "3px solid var(--paper-2)" }}/>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{w}</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 6 }}>{h}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame2>
  );
}
function ImpactDial({ pct = 84, label = "impact" }) {
  return (
    <div style={{ width: 80, height: 80, position: "relative", flexShrink: 0 }}>
      <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none"/>
        <circle cx={40} cy={40} r={34} stroke="var(--ochre-700)" strokeWidth="6" fill="none"
                strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - pct/100)} strokeLinecap="round"/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="display" style={{ fontSize: 26 }}>{pct}</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{label}</span>
      </div>
    </div>
  );
}
function CourseCard({ provider, title, level, hours, rating }) {
  return (
    <div style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--paper)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--ink-900)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{provider[0]}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>{provider}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
        <span>{level}</span><span>· {hours}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon.Star size={11} color="var(--ochre-700)"/>{rating}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Open course</button>
        <button className="btn btn-ghost btn-sm">Save</button>
      </div>
    </div>
  );
}

// ── 9. LINKEDIN REVIEW ────────────────────────────────────────────────────
function LinkedInReviewDesktop() {
  return (
    <DesktopFrame2>
      <Sidebar active="LinkedIn"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="LinkedIn review · MVP · feedback only" title="Your profile, read like a recruiter would"
          right={<>
            <StatusPill status="ai"/>
            <button className="btn btn-secondary btn-sm">Re-run analysis</button>
          </>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
          {/* Left: parsed profile */}
          <div style={{ borderRight: "1px solid var(--line-2)", overflow: "auto", padding: 28, background: "var(--paper)" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Parsed profile</div>
            <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <ProfileSection
                tag="headline"
                title="Headline"
                body="Senior Product Designer @ Stripe. Designing tools for builders."
                onClickLabel="View feedback ↗"
                active
              />
              <ProfileSection
                tag="about"
                title="About"
                body="I'm a product designer who cares about craft. I've spent the last 6 years working at companies like Stripe and Notion. I love design systems and making things feel calm. Outside of work I cycle and bake bread."
              />
              <ProfileSection
                tag="experience"
                title="Experience"
                body="Stripe · Senior Product Designer · 2022–present  ·  Notion · Product Designer · 2019–2022  ·  Asana · Designer · 2017–2019"
              />
              <ProfileSection
                tag="skills"
                title="Skills (37)"
                body="Figma · Design systems · Prototyping · Accessibility · User research · UX writing · Information architecture · Design strategy · Workshop facilitation · …"
              />
            </div>
          </div>

          {/* Right: feedback */}
          <div style={{ overflow: "auto", padding: 28, background: "var(--paper-2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="eyebrow">Feedback · Headline</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ImpactDial pct={62} label="strength"/>
              </div>
            </div>

            <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Narrative</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-soft)" }}>
                    Strong company anchor (Stripe), but the value claim — <em>"Designing tools for builders"</em> — is
                    generic. Recruiters scanning for design leads pause on <strong>scope</strong> and <strong>outcome</strong>.
                    Three of your saved roles ask explicitly for system design experience that this headline hides.
                  </div>
                </div>
                <div style={{ width: 120, padding: 12, background: "var(--paper-2)", borderRadius: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  <div className="mono" style={{ textTransform: "uppercase", letterSpacing: 0.1, marginBottom: 6 }}>Keyword coverage</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                    <Chip tone="match" icon={<Icon.Check size={10}/>}>Stripe</Chip>
                    <Chip tone="missing">Lead</Chip>
                    <Chip tone="missing">Systems</Chip>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 18, marginBottom: 14, borderColor: "var(--ochre-200)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AiBadge label="3 rewrites"/>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Pick one to copy</span>
              </div>
              {[
                ["Calm-but-impact lead",
                 "Senior Product Designer @ Stripe · Building design systems and workspace tools used by 12k+ developer teams"],
                ["Lead-track signaling",
                 "Designer-lead in the making · Workspace primitives, design systems, and quantified craft at Stripe (prev. Notion)"],
                ["Outcome-first",
                 "Cut dev-onboarding time-to-first-API-call by 22% at Stripe · Senior Product Designer focused on design systems"],
              ].map(([k, v], i) => (
                <div key={k} style={{ padding: 12, background: i === 0 ? "var(--ochre-100)" : "var(--paper-2)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <input type="radio" name="rw" defaultChecked={i === 0}/>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>{k}</div>
                    <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{v}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">Copy</button>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, background: "var(--info-bg)", borderRadius: 10, fontSize: 12.5, color: "var(--info)", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon.Bell size={14}/>
              <div>
                <strong>MVP scope</strong> — Copilot doesn't post or edit LinkedIn directly. Copy a rewrite and update your profile manually.
              </div>
            </div>

            {/* Other section navigators */}
            <div style={{ marginTop: 22 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Other sections</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[["About", 71],["Experience", 84],["Skills", 58]].map(([s, p]) => (
                  <div key={s} style={{ padding: 12, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <div className="score-bar" style={{ flex: 1 }}><i style={{ width: p + "%" }}/></div>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame2>
  );
}
function ProfileSection({ tag, title, body, active }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: active ? "var(--ink-100)" : "var(--paper-2)", border: "1px solid " + (active ? "var(--ink-700)" : "var(--line-2)") }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{tag}</div>
        {active && <Icon.ChevronR size={13}/>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

Object.assign(window, { TailoringDesktop, ApprovalsDesktop, SkillRoadmapDesktop, LinkedInReviewDesktop });
