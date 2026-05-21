/* global React, Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing */
// Mobile screens — 390 × 844, iPhone-like proportions. No device bezel, just the screen surface.

// Shared mobile shell
function MFrame({ children, bg = "var(--paper)" }) {
  return (
    <div className="app-root" style={{
      width: 390, height: 844, background: bg, overflow: "hidden",
      display: "flex", flexDirection: "column", position: "relative",
      borderRadius: 0,
    }}>
      <Mstatus/>
      {children}
    </div>
  );
}
function Mstatus() {
  return (
    <div className="m-statusbar">
      <span className="mono">9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 16, height: 10, borderRadius: 2, background: "currentColor", opacity: 0.85 }}/>
        <span style={{ width: 14, height: 10, borderRadius: 2, background: "currentColor", opacity: 0.6 }}/>
        <span style={{ width: 22, height: 11, borderRadius: 3, border: "1px solid currentColor", padding: 1 }}>
          <span style={{ display: "block", height: "100%", width: "70%", background: "currentColor", borderRadius: 1 }}/>
        </span>
      </div>
    </div>
  );
}
function Mtab({ active = "Resume" }) {
  const items = [
    ["Resume", Icon.Doc],
    ["Jobs",   Icon.Briefcase],
    ["Tailor", Icon.Sparkle],
    ["Roadmap", Icon.Map],
    ["You",    Icon.Settings],
  ];
  return (
    <div className="m-tabbar">
      {items.map(([n, I]) => (
        <div key={n} className={"m-tab" + (n === active ? " active" : "")}>
          <I size={22} color={n === active ? "var(--ink-900)" : "var(--text-muted)"}/>
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}
function Mappbar({ title, sub, left, right }) {
  return (
    <div style={{ padding: "8px 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        {sub && <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{sub}</div>}
        <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

// ── 1. Landing (mobile) ──
function LandingMobile() {
  return (
    <MFrame>
      <div style={{ flex: 1, padding: "8px 22px 24px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 18 }}>
            <i style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ink-900)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>C</i>Copilot
          </div>
          <button className="btn btn-ghost btn-sm">Sign in</button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 30 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>AI Career Copilot</div>
          <h1 className="display" style={{ fontSize: 46, letterSpacing: "-0.03em", lineHeight: 1 }}>
            The career<br/>copilot that<br/><em style={{ fontStyle: "italic" }}>shows its work.</em>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-soft)", marginTop: 16, lineHeight: 1.55 }}>
            Upload your resume. We'll interview, sharpen, match, and draft — with every AI edit waiting on your approval.
          </p>
        </div>
        {/* mini workflow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 22 }}>
          {[
            ["01","Upload"],
            ["02","Match"],
            ["03","Tailor"],
            ["04","Approve"],
            ["05","Upskill"],
          ].map(([n, h], i) => (
            <div key={n}>
              <div className="mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{h}</div>
              <div style={{ height: 2, background: i === 0 ? "var(--ink-900)" : "var(--line)", marginTop: 8 }}/>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }}>
          <Icon.Upload size={16}/> Upload resume
        </button>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 12 }}>
          PDF · DOCX · 10 MB max. Your data never trains models.
        </div>
      </div>
    </MFrame>
  );
}

// ── 2. Upload + parsing review (mobile) ──
function UploadMobile() {
  return (
    <MFrame>
      <Mappbar title="Bring your resume in" sub="Step 1 of 3"
               left={<Icon.X size={20}/>}
               right={<div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>1/3</div>}/>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 20px" }}>
        {/* Dropzone tile */}
        <div style={{
          padding: 24, borderRadius: 14, background: "var(--surface)",
          border: "1.5px dashed var(--ink-300)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--ink-100)", color: "var(--ink-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.Upload size={22}/>
          </div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Choose a file</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>PDF or DOCX, up to 10 MB</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>Browse files</button>
        </div>

        {/* Parsing card */}
        <div className="card" style={{ padding: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.Doc size={20}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>maya-kapoor-resume.pdf</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Parsing… extracting sections</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>78%</span>
          </div>
          <div className="score-bar" style={{ marginTop: 10 }}><i style={{ width: "78%" }}/></div>
        </div>

        {/* Parse review */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="eyebrow">Confirm what we found</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>conf</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>91%</span>
            </div>
          </div>
          {[
            ["Name",     "Maya Kapoor", 100],
            ["Headline", "Senior Product Designer · ex-Stripe", 94],
            ["Years",    "6.5 years", 83],
            ["Skills",   "18 detected", 88, "warn"],
          ].map(([l, v, c, flag]) => (
            <div key={l} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{l}</div>
                <span className="mono" style={{ fontSize: 11, color: c >= 90 ? "var(--sage-700)" : c >= 70 ? "var(--ink-700)" : "var(--warning)", fontWeight: 600 }}>{c}%</span>
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{v}</div>
              {flag === "warn" && <div style={{ marginTop: 6, fontSize: 11, color: "var(--warning)", display: "flex", alignItems: "center", gap: 4 }}><Icon.Pencil size={11}/> Tap to review</div>}
            </div>
          ))}
        </div>
      </div>
      {/* Sticky bottom */}
      <div style={{ padding: 16, borderTop: "1px solid var(--line)", background: "var(--paper)", display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Edit fields</button>
        <button className="btn btn-primary" style={{ flex: 1.4, justifyContent: "center" }}>Looks right</button>
      </div>
    </MFrame>
  );
}

// ── 3. Onboarding chat (mobile) ──
function OnboardingMobile() {
  return (
    <MFrame>
      <Mappbar title="Tell me about your search" sub="Step 2 of 3"
               left={<Icon.X size={20}/>}
               right={<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                 <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>6/12</span>
                 <div style={{ width: 40, height: 4, background: "var(--paper-3)", borderRadius: 999 }}><div style={{ width: "50%", height: "100%", background: "var(--ink-900)", borderRadius: 999 }}/></div>
               </div>}/>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <MChat from="ai" text="What kind of move feels right next — bigger scope, new domain, or stability?"/>
        <MChat from="me" text="Bigger scope. Lead a small team eventually, stay close to craft."/>
        <MChat from="ai" text="Any spaces you'd avoid?" chips={["Ad-tech ✕","Crypto ✕"]}/>
        <MChat from="me" text="Yeah, ad-tech and crypto. Healthcare is interesting though."/>
        <MChat from="ai" rationale text="What's your compensation floor? I'll use this to filter — you can change it anytime."/>
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {["$160k","$180k","$200k","Prefer not to say"].map(s => <Chip key={s}>{s}</Chip>)}
        </div>
        <div className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <input placeholder="Type your answer…" defaultValue="$180k base, open on equity"
                 style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontSize: 14, fontFamily: "inherit" }}/>
          <button className="btn btn-primary btn-sm"><Icon.Send size={13}/></button>
        </div>
      </div>
    </MFrame>
  );
}
function MChat({ from, text, chips, rationale }) {
  if (from === "me") {
    return <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--ink-900)", color: "var(--text-onink)", padding: "10px 12px", borderRadius: "14px 14px 4px 14px", fontSize: 13.5, lineHeight: 1.45 }}>{text}</div>;
  }
  return (
    <div style={{ display: "flex", gap: 8, maxWidth: "92%" }}>
      <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--ochre-100)", color: "var(--ochre-900)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon.Sparkle size={13}/>
      </div>
      <div style={{ background: rationale ? "var(--ochre-100)" : "var(--surface)", border: "1px solid " + (rationale ? "var(--ochre-200)" : "var(--line-2)"), padding: "10px 12px", borderRadius: "4px 14px 14px 14px", fontSize: 13.5, lineHeight: 1.45 }}>
        {rationale && <div className="eyebrow" style={{ color: "var(--ochre-900)", marginBottom: 4 }}>Why I'm asking</div>}
        {text}
        {chips && <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>{chips.map(c => <Chip key={c} tone="ink">{c}</Chip>)}</div>}
      </div>
    </div>
  );
}

// ── 4. Master resume (mobile) ──
function MasterResumeMobile() {
  return (
    <MFrame bg="var(--paper-2)">
      <Mappbar title="Master CV" sub="v3 · reviewed"
               left={<Icon.Chevron size={20} style={{ transform: "rotate(90deg)" }}/>}
               right={<button className="btn btn-ghost btn-sm"><Icon.Pencil size={13}/></button>}/>
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["Summary","Experience","Skills","Education","Projects"].map((s, i) => (
          <Chip key={s} tone={i === 0 ? "ink" : "default"}>{s}</Chip>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px" }}>
        <div className="doc" style={{ padding: "22px 20px", fontSize: 12, borderRadius: 14 }}>
          <h1 style={{ fontSize: 22 }}>Maya Kapoor</h1>
          <div className="meta">Sr. Product Designer · San Francisco</div>
          <h2>Summary</h2>
          <p style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Product designer with 6+ years building <span className="ai-edit">design systems used by 40+ product teams</span>,
            focused on <span className="ai-edit">workspace tooling</span> for technical users.
          </p>
          <h2>Experience</h2>
          <h3>Stripe · Sr. PD</h3>
          <ul style={{ fontSize: 12.5 }}>
            <li>Led <span className="ai-edit">workspace-navigation rebuild</span>; 12k merchants in their first 30 days.</li>
            <li><span className="del">Improved performance metrics</span> <span className="ins">Cut TTI by 1.4s on p75 across dashboard.</span></li>
          </ul>
        </div>

        {/* AI suggestion card */}
        <div className="card" style={{ padding: 14, marginTop: 14, background: "var(--ochre-100)", borderColor: "var(--ochre-200)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="eyebrow" style={{ color: "var(--ochre-900)" }}>AI suggestion</div>
            <AiBadge label="3 changes"/>
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: "var(--ochre-900)" }}>
            Your Asana role is dense. I drafted a tighter version — 4 bullets instead of 7.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button className="btn btn-ai btn-sm" style={{ flex: 1, justifyContent: "center" }}>Review draft</button>
            <button className="btn btn-ghost btn-sm">Dismiss</button>
          </div>
        </div>
      </div>
      {/* Sticky bar */}
      <div style={{ padding: 14, borderTop: "1px solid var(--line)", background: "var(--paper)", display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}><Icon.Eye size={13}/> Diff</button>
        <button className="btn btn-primary" style={{ flex: 1.4, justifyContent: "center" }}>Approve master</button>
      </div>
      <Mtab active="Resume"/>
    </MFrame>
  );
}

// ── 5. Job match board (mobile) ──
function JobBoardMobile() {
  const subset = [
    { co: "Linear", role: "Senior Product Designer", loc: "Remote · US", score: 87, match: ["Design systems","Figma","Prototyping"], miss: ["Motion"] },
    { co: "Vercel", role: "Staff PD, Platform",       loc: "SF / Remote", score: 82, match: ["Dev tools","Docs"],                  miss: ["System design"] },
    { co: "Ramp",   role: "Sr. PD, Card",             loc: "NYC",         score: 74, match: ["Fintech","Systems"],                 miss: ["Compliance UX"] },
    { co: "Notion", role: "Lead Designer, DBs",       loc: "SF / Remote", score: 79, match: ["Notion alum","Workspace"],            miss: ["Lead exp."] },
  ];
  return (
    <MFrame bg="var(--paper-2)">
      <Mappbar title="42 new matches" sub="this week"
               right={<button className="btn btn-ghost btn-sm"><Icon.Filter size={14}/></button>}/>
      <div style={{ padding: "0 16px 10px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["All · 42","Saved · 7","Tailored · 8","Applied · 6"].map((s, i) => (
          <div key={s} style={{
            padding: "6px 12px", fontSize: 12.5, borderRadius: 999, fontWeight: 500,
            background: i === 0 ? "var(--ink-900)" : "var(--surface)",
            color: i === 0 ? "var(--text-onink)" : "var(--text-soft)",
            border: "1px solid " + (i === 0 ? "var(--ink-900)" : "var(--line)"),
            whiteSpace: "nowrap",
          }}>{s}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {subset.map((j, i) => (
          <div key={j.co} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, borderColor: i === 0 ? "var(--ink-700)" : undefined, boxShadow: i === 0 ? "0 0 0 1px var(--ink-700)" : undefined }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 16, flexShrink: 0 }}>{j.co[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{j.co}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{j.role}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{j.loc}</div>
              </div>
              <ScoreRing value={j.score} size={42}/>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {j.match.slice(0, 2).map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10}/>}>{s}</Chip>)}
              {j.miss.slice(0, 1).map(s => <Chip key={s} tone="missing">+ {s}</Chip>)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Match</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1.3, justifyContent: "center" }}><Icon.Sparkle size={12}/> Tailor</button>
            </div>
          </div>
        ))}
      </div>
      <Mtab active="Jobs"/>
    </MFrame>
  );
}

// ── 6. Tailoring (mobile) ──
function TailoringMobile() {
  return (
    <MFrame>
      <Mappbar title="Senior PD · Linear" sub="Tailoring"
               left={<Icon.Chevron size={20} style={{ transform: "rotate(90deg)" }}/>}
               right={<StatusPill status="draft"/>}/>
      {/* Match summary */}
      <div style={{ padding: "0 20px 14px" }}>
        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <ScoreRing value={87} size={52}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Strong match</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>9 matched · 2 gaps</div>
          </div>
          <button className="btn btn-ghost btn-sm">Why?</button>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ padding: "0 20px", display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 10 }}>
        {[["Resume", true],["Cover letter", false],["JD", false]].map(([l, a]) => (
          <div key={l} style={{ padding: "8px 12px", fontSize: 13, fontWeight: a ? 500 : 400, color: a ? "var(--text)" : "var(--text-muted)", borderBottom: "2px solid " + (a ? "var(--ink-900)" : "transparent"), marginBottom: -1 }}>{l}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 14px" }}>
        <div className="doc" style={{ padding: 20, fontSize: 12, borderRadius: 12 }}>
          <h1 style={{ fontSize: 20 }}>Maya Kapoor</h1>
          <div className="meta">Senior Product Designer</div>
          <h2>Summary</h2>
          <p style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            <span className="ai-edit">Senior product designer who turns dense developer workflows into calm, fast tools.</span>{" "}
            Six years at Stripe and Notion.
          </p>
          <h2>Experience · Stripe</h2>
          <ul style={{ fontSize: 12.5 }}>
            <li>Led <span className="ai-edit">workspace-navigation rebuild</span>; 12k merchants in 30 days.</li>
            <li><span className="ai-edit">Built keyboard model</span> for docs — TTFAC down 22%.</li>
            <li>Cut TTI by 1.4s on p75 dashboard.</li>
          </ul>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: "var(--ochre-100)", borderRadius: 10, fontSize: 12.5, color: "var(--ochre-900)", display: "flex", gap: 10 }}>
          <Icon.Sparkle size={14}/>
          <div><strong>3 changes vs master.</strong> Reframed Stripe role around workspace + keyboard model. No new facts.</div>
        </div>
      </div>
      {/* Sticky actions */}
      <div style={{ padding: 14, borderTop: "1px solid var(--line)", background: "var(--paper)", display: "flex", gap: 8 }}>
        <button className="btn btn-ai btn-sm" style={{ justifyContent: "center" }}><Icon.Refresh size={13}/></button>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>See diff</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1.4, justifyContent: "center" }}>Approve</button>
      </div>
    </MFrame>
  );
}

// ── 7. Approvals (mobile) ──
function ApprovalsMobile() {
  const groups = [
    { co: "Linear", role: "Senior PD", items: [["Resume","reviewed", 2, "12m"],["Cover letter","draft", 1, "12m"]] },
    { co: "Vercel", role: "Staff PD",  items: [["Resume","approved", 3, "1d"],["Cover letter","approved", 2, "1d"]] },
    { co: "Notion", role: "Lead, DBs", items: [["Resume","draft", 1, "2d"]] },
  ];
  return (
    <MFrame bg="var(--paper-2)">
      <Mappbar title="Approvals" sub="4 jobs · 7 items"
               right={<button className="btn btn-ghost btn-sm"><Icon.Filter size={14}/></button>}/>
      <div style={{ padding: "0 16px 10px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["All · 7","Draft · 2","Reviewed · 3","Approved · 2"].map((s, i) => (
          <div key={s} style={{
            padding: "6px 12px", fontSize: 12.5, borderRadius: 999, fontWeight: 500,
            background: i === 2 ? "var(--ink-900)" : "var(--surface)",
            color: i === 2 ? "var(--text-onink)" : "var(--text-soft)",
            border: "1px solid " + (i === 2 ? "var(--ink-900)" : "var(--line)"),
            whiteSpace: "nowrap",
          }}>{s}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((g, gi) => (
          <div key={g.co} className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 14 }}>{g.co[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{g.role}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.co}</div>
              </div>
              <Icon.ChevronR size={14} color="var(--text-muted)"/>
            </div>
            {g.items.map(([t, s, v, when]) => (
              <div key={t} style={{ padding: "10px 14px", borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 10 }}>
                {t === "Resume" ? <Icon.Doc size={14}/> : <Icon.Mail size={14}/>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t} <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>v{v}</span></div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Last edit · {when} ago</div>
                </div>
                <StatusPill status={s}/>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Approve all reviewed · 3</button>
      </div>
      <Mtab active="Tailor"/>
    </MFrame>
  );
}

// ── 8. Skill roadmap (mobile) ──
function RoadmapMobile() {
  return (
    <MFrame bg="var(--paper-2)">
      <Mappbar title="Skill roadmap" sub="based on 10 saved jobs"/>
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
        {/* Hero gap */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div className="eyebrow">Top gap</div>
              <div className="serif" style={{ fontSize: 24, marginTop: 4 }}>System design</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>In 7 of 10 target roles</div>
            </div>
            <div style={{ width: 56, height: 56, position: "relative" }}>
              <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={28} cy={28} r={22} stroke="var(--paper-3)" strokeWidth="5" fill="none"/>
                <circle cx={28} cy={28} r={22} stroke="var(--ochre-700)" strokeWidth="5" fill="none" strokeDasharray={138} strokeDashoffset={138 * 0.16} strokeLinecap="round"/>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18 }}>84</div>
            </div>
          </div>
          <div style={{ padding: 12, background: "var(--paper-2)", borderRadius: 8, marginTop: 12, fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.5 }}>
            Linear, Vercel, and Notion mention it as a senior-IC bar. Framing two of your Stripe bullets around it would unblock 4 saved roles.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Mark as goal</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>View courses</button>
          </div>
        </div>

        <div className="eyebrow" style={{ margin: "20px 0 8px" }}>All gaps</div>
        {[
          ["System design",   84, "critical"],
          ["Motion design",   62, "high"],
          ["Compliance UX",   54, "medium"],
          ["Data viz",        48, "medium"],
        ].map(([n, p, sev]) => (
          <div key={n} className="card" style={{ padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n}</div>
              <div className="score-bar" style={{ marginTop: 6 }}><i style={{ width: p + "%" }}/></div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08, width: 52, textAlign: "right" }}>{sev}</div>
            <Icon.ChevronR size={14} color="var(--text-muted)"/>
          </div>
        ))}

        <div className="eyebrow" style={{ margin: "20px 0 8px" }}>Courses for System design</div>
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--ink-900)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>U</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>Udemy</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}><Icon.Star size={10} color="var(--ochre-700)"/>4.8</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>System Design for Designers</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Intermediate · 6h</div>
        </div>
      </div>
      <Mtab active="Roadmap"/>
    </MFrame>
  );
}

// ── 9. LinkedIn review (mobile) ──
function LinkedInMobile() {
  return (
    <MFrame bg="var(--paper-2)">
      <Mappbar title="LinkedIn review" sub="feedback only · MVP"
               left={<Icon.Chevron size={20} style={{ transform: "rotate(90deg)" }}/>}/>
      <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, overflowX: "auto" }}>
        {[["Headline", 62, true],["About", 71],["Experience", 84],["Skills", 58]].map(([n, p, a]) => (
          <div key={n} style={{
            padding: "8px 12px", borderRadius: 12, minWidth: 110,
            background: a ? "var(--ink-900)" : "var(--surface)",
            color: a ? "var(--text-onink)" : "var(--text)",
            border: "1px solid " + (a ? "var(--ink-900)" : "var(--line)"),
            display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{n}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 3, background: a ? "rgba(255,255,255,0.2)" : "var(--paper-3)", borderRadius: 999 }}>
                <div style={{ width: p + "%", height: "100%", background: a ? "#fff" : "var(--ink-900)", borderRadius: 999 }}/>
              </div>
              <span className="mono" style={{ fontSize: 10 }}>{p}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px" }}>
        {/* current value */}
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow">Your headline</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.45 }}>Senior Product Designer @ Stripe. Designing tools for builders.</div>
        </div>
        {/* feedback */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AiBadge label="Feedback"/>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>strength · 62</div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8, color: "var(--text-soft)" }}>
            Strong company anchor, but "designing tools for builders" is generic. Three of your saved roles want explicit
            <em> system design</em> framing.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            <Chip tone="match" icon={<Icon.Check size={10}/>}>Stripe</Chip>
            <Chip tone="missing">+ Lead</Chip>
            <Chip tone="missing">+ Systems</Chip>
          </div>
        </div>
        {/* rewrites */}
        <div className="eyebrow" style={{ margin: "16px 0 8px" }}>Three rewrites</div>
        {[
          ["Calm-but-impact lead",  "Sr. Product Designer @ Stripe · Building design systems and workspace tools used by 12k+ dev teams"],
          ["Lead-track signaling",  "Designer-lead in the making · Workspace primitives & quantified craft at Stripe (prev. Notion)"],
          ["Outcome-first",         "Cut dev-onboarding TTFAC by 22% at Stripe · Sr. Product Designer focused on design systems"],
        ].map(([k, v], i) => (
          <div key={k} className="card" style={{ padding: 12, marginBottom: 8, background: i === 0 ? "var(--ochre-100)" : "var(--surface)", borderColor: i === 0 ? "var(--ochre-200)" : undefined }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>{k}</div>
            <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{v}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Copy</button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 14, padding: 12, background: "var(--info-bg)", color: "var(--info)", borderRadius: 10, fontSize: 12, display: "flex", gap: 8 }}>
          <Icon.Bell size={14}/>
          <div>Copy a rewrite to update LinkedIn yourself. Copilot doesn't post for you in MVP.</div>
        </div>
      </div>
    </MFrame>
  );
}

Object.assign(window, { LandingMobile, UploadMobile, OnboardingMobile, MasterResumeMobile, JobBoardMobile, TailoringMobile, ApprovalsMobile, RoadmapMobile, LinkedInMobile });
