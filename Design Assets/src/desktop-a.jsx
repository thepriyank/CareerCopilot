/* global React, Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing, Sidebar, Topbar, Placeholder, Annotation */
// Desktop screens part 1 — Landing, Upload+Parsing, Onboarding chat, Master resume, Job board.
// Each screen is 1440 × 900.

const { useState } = React;

// ──────────────────────────────────────────────────────────────────────────
// Shared frame
function DesktopFrame({ children, background = "var(--paper)" }) {
  return (
    <div className="app-root" style={{
      width: 1440, height: 900, background, overflow: "hidden", display: "flex",
      borderRadius: 0, position: "relative",
    }}>{children}</div>
  );
}

// ── 1. LANDING ────────────────────────────────────────────────────────────
function LandingDesktop() {
  return (
    <DesktopFrame background="#fbfaf7">
      <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
        {/* nav */}
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", borderBottom: "1px solid var(--line-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)", fontSize: 22 }}>
            <i style={{ width: 26, height: 26, borderRadius: 7, background: "var(--ink-900)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>C</i>
            Copilot
          </div>
          <div style={{ display: "flex", gap: 28, fontSize: 13, color: "var(--text-soft)" }}>
            <span>How it works</span><span>Privacy</span><span>Pricing</span><span>Sign in</span>
            <button className="btn btn-primary btn-sm">Get started</button>
          </div>
        </div>

        {/* hero */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, padding: "60px 56px 0", alignItems: "start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 18 }}>AI Career Copilot · MVP</div>
            <h1 className="display" style={{ fontSize: 78, letterSpacing: "-0.03em" }}>
              The career copilot<br/>
              that <em style={{ fontStyle: "italic" }}>shows its work.</em>
            </h1>
            <p style={{ fontSize: 17, color: "var(--text-soft)", maxWidth: 480, marginTop: 22, lineHeight: 1.55 }}>
              Upload your resume. We'll interview you, sharpen your master CV, match jobs that fit, and draft tailored
              applications — with every edit highlighted and waiting for your approval.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button className="btn btn-primary btn-lg"><Icon.Upload size={16}/> Upload resume</button>
              <button className="btn btn-secondary btn-lg">Watch 90-sec tour</button>
            </div>

            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon.Check size={14} color="var(--success)"/> PDF · DOCX</div>
              <div style={{ width: 1, height: 14, background: "var(--line)" }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon.Check size={14} color="var(--success)"/> Your data, your keys</div>
              <div style={{ width: 1, height: 14, background: "var(--line)" }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon.Check size={14} color="var(--success)"/> Nothing submits without you</div>
            </div>

            {/* workflow strip */}
            <div style={{ marginTop: 56 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>The loop</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, alignItems: "stretch" }}>
                {[
                  ["01","Upload",   "Parse & verify"],
                  ["02","Match",    "Score & explain"],
                  ["03","Tailor",   "Resume + letter"],
                  ["04","Approve",  "Diff & sign-off"],
                  ["05","Upskill",  "Close the gaps"],
                ].map(([n,h,s], i, arr) => (
                  <div key={n} style={{ position: "relative", paddingRight: i === arr.length - 1 ? 0 : 8 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{n}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginTop: 6 }}>{h}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s}</div>
                    <div style={{ height: 2, background: i === 0 ? "var(--ink-900)" : "var(--line)", marginTop: 14 }}/>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right: product still — a stylised app preview */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: "20px -56px 0 0", background: "linear-gradient(180deg, transparent 0%, rgba(28,25,23,0.04) 100%)", borderRadius: 24, border: "1px solid var(--line)", overflow: "hidden" }}>
              {/* Stylised job-detail mini */}
              <div style={{ background: "#fff", margin: 28, borderRadius: 14, border: "1px solid var(--line)", boxShadow: "0 30px 60px -30px rgba(28,25,23,0.25)", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em" }}>Senior Product Designer</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Linear · Remote · $180–230k</div>
                  </div>
                  <ScoreRing value={87}/>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <Chip tone="match" icon={<Icon.Check size={11}/>}>Design systems</Chip>
                  <Chip tone="match" icon={<Icon.Check size={11}/>}>Figma</Chip>
                  <Chip tone="match" icon={<Icon.Check size={11}/>}>Prototyping</Chip>
                  <Chip tone="missing">+ Motion design</Chip>
                </div>
                <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
                  <AiBadge label="AI tailored your summary"/>
                  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
                    Product designer with 6 years building <span className="ai-edit">design systems used by 40+ product teams</span>, focused on <span className="ai-edit">tools that make complex workflows feel calm</span>.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Approve & download</button>
                  <button className="btn btn-secondary btn-sm">Review diff</button>
                </div>
              </div>
              {/* floating mini cards */}
              <div className="card" style={{ position: "absolute", right: 36, bottom: 80, width: 220, padding: 14 }}>
                <div className="eyebrow">Top skill gap</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>System design</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Mentioned in 7 of your 10 target roles.</div>
                <div className="score-bar" style={{ marginTop: 10 }}><i style={{ width: "72%" }}/></div>
              </div>
              <div className="card" style={{ position: "absolute", left: 48, bottom: 36, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <StatusPill status="approved"/>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Master Resume v3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}

// ── 2. UPLOAD + PARSING REVIEW ────────────────────────────────────────────
function UploadDesktop() {
  return (
    <DesktopFrame>
      <Sidebar active="Resume"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Onboarding · step 1 of 3" title="Bring your resume in"
          right={<><button className="btn btn-ghost">Skip for now</button><button className="btn btn-secondary">Save & exit</button></>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28, padding: 28, overflow: "hidden" }}>
          {/* Left: dropzone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              flex: 1, border: "1.5px dashed var(--ink-300)", borderRadius: 16,
              background: "var(--surface)", padding: 32,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center",
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--ink-100)", color: "var(--ink-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon.Upload size={28}/>
              </div>
              <div className="serif" style={{ fontSize: 28 }}>Drop your resume here</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
                PDF or DOCX up to 10 MB. We extract sections, normalise skills, and ask you to verify what we found.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary"><Icon.Upload size={14}/> Choose file</button>
                <button className="btn btn-secondary">Paste from LinkedIn</button>
              </div>
              {/* in-progress chip */}
              <div className="card" style={{ marginTop: 18, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, width: 360 }}>
                <Icon.Doc size={18}/>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>maya-kapoor-resume.pdf</div>
                  <div className="score-bar" style={{ marginTop: 6 }}><i style={{ width: "78%" }}/></div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>parsing…</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                ["End-to-end encrypted","Files stored on EU servers."],
                ["Never trained on","Your resume is not used to train models."],
                ["You can delete","Account + data deletion at any time."],
              ].map(([h,s]) => (
                <div key={h} style={{ padding: 12, background: "var(--paper-2)", borderRadius: 10 }}>
                  <Icon.Check size={14} color="var(--sage-700)"/>
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>{h}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: parsing review */}
          <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="eyebrow">Parsing review</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>Confirm what we extracted</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>confidence</span>
                <div style={{ width: 100, height: 6, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}>
                  <div style={{ width: "91%", height: "100%", background: "var(--sage-500)" }}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>91%</span>
              </div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
              <ParseRow label="Name"     value="Maya Kapoor"            conf={1.0}/>
              <ParseRow label="Headline" value="Senior Product Designer · ex-Stripe, ex-Notion" conf={0.94}/>
              <ParseRow label="Location" value="San Francisco, CA"       conf={0.98}/>
              <ParseRow label="Sections detected" value={<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip tone="ink">Summary</Chip><Chip tone="ink">Experience · 4 roles</Chip>
                <Chip tone="ink">Education · 1</Chip><Chip tone="ink">Skills · 18</Chip><Chip tone="ink">Projects · 3</Chip>
              </div>} conf={0.92}/>
              <ParseRow label="Years of experience" value="6.5 years" conf={0.83} flag="check"/>
              <ParseRow label="Top skills (normalised)" value={<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip>Figma</Chip><Chip>Design systems</Chip><Chip>Prototyping</Chip><Chip>User research</Chip>
                <Chip>Accessibility</Chip><Chip>SwiftUI</Chip>
              </div>} conf={0.88}/>
              <ParseRow label="One field looked off" value="“Design Lead @ Notion, 2019” — couldn't verify dates"  conf={0.51} flag="warn"/>
            </div>
            <div style={{ padding: 16, borderTop: "1px solid var(--line-2)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost">Edit fields</button>
              <button className="btn btn-primary">Looks right — continue</button>
            </div>
          </div>
        </div>
      </div>
      <Annotation x={780} y={150} w={220}>
        Confidence meter is visible upfront — sets the tone that the AI explains itself.
      </Annotation>
    </DesktopFrame>
  );
}
function ParseRow({ label, value, conf, flag }) {
  const tone = conf >= 0.9 ? "var(--sage-700)" : conf >= 0.7 ? "var(--ink-700)" : "var(--warning)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px", gap: 16, alignItems: "start", paddingBottom: 12, borderBottom: "1px solid var(--line-2)" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08, fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 13.5 }}>
        {value}
        {flag === "warn" && <div style={{ marginTop: 6, padding: "6px 8px", background: "var(--warning-bg)", borderRadius: 6, fontSize: 11.5, color: "var(--warning)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon.Pencil size={12}/> Please review or correct
        </div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <span className="mono" style={{ fontSize: 11, color: tone, fontWeight: 600 }}>{Math.round(conf*100)}%</span>
      </div>
    </div>
  );
}

// ── 3. ONBOARDING CHAT ────────────────────────────────────────────────────
function OnboardingChatDesktop() {
  return (
    <DesktopFrame>
      <Sidebar active="Resume"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Onboarding · step 2 of 3" title="Tell me what you're looking for"
          right={<><div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>6 of 12 questions</div>
            <div style={{ width: 120, height: 4, background: "var(--paper-3)", borderRadius: 999 }}><div style={{ width: "50%", height: "100%", background: "var(--ink-900)", borderRadius: 999 }}/></div></>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", overflow: "hidden" }}>
          {/* Chat column */}
          <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line-2)" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
              <ChatMsg from="ai" text="Hi Maya — I read through your resume. Six years in product design, last two at Stripe. Before we start, what kind of move feels right next? A bigger scope, a new domain, or stability?"/>
              <ChatMsg from="me"  text="Bigger scope. I want to lead a small team eventually but stay close to the craft."/>
              <ChatMsg from="ai"  text="Got it — design lead with IC depth. Any companies or product spaces you'd avoid?"
                       chips={["Avoid: ad-tech", "Avoid: crypto"]}/>
              <ChatMsg from="me"  text="Yeah, ad-tech and crypto. Healthcare is interesting though."/>
              <ChatMsg from="ai" text={<>And your <strong>compensation floor</strong>? I'll use this to filter matches; you can always change it later.</>}/>
              <ChatMsg from="ai" rationale text={<>I'm asking now because most jobs I'd surface for you sit between $170–230k base. Setting a floor avoids noisy matches.</>}/>
              {/* composer */}
            </div>
            <div style={{ padding: "12px 32px 24px" }}>
              <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <input placeholder="Type your answer… or pick a quick reply" style={{
                    width: "100%", border: 0, outline: 0, background: "transparent", fontFamily: "inherit",
                    fontSize: 14, color: "var(--text)",
                  }} defaultValue="$180k base, open on equity"/>
                </div>
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm"><Icon.Send size={13}/> Send</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {["$160k","$180k","$200k","Prefer not to say"].map(s => <Chip key={s} tone="default">{s}</Chip>)}
              </div>
            </div>
          </div>
          {/* Right: live profile that fills in */}
          <div style={{ padding: 28, background: "var(--paper-2)", overflow: "auto" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Detected profile · live</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>Maya Kapoor</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Senior Product Designer · 6.5 yrs · San Francisco</div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 18 }}>
              <ProfileRow label="Career direction" value="Design lead, IC-deep"/>
              <ProfileRow label="Target levels"   value={<><Chip tone="ink">Senior</Chip> <Chip tone="ink">Staff</Chip> <Chip tone="ink">Lead</Chip></>}/>
              <ProfileRow label="Locations"        value="SF · NYC · Remote (US)"/>
              <ProfileRow label="Comp floor"       value={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span className="ai-edit">$180k base</span> <AiBadge label="just set"/></span>}/>
              <ProfileRow label="Industries"       value={<><Chip tone="match">Dev tools</Chip> <Chip tone="match">Fintech</Chip> <Chip tone="match">Healthcare</Chip></>}/>
              <ProfileRow label="Avoid"            value={<><Chip tone="missing">Ad-tech</Chip> <Chip tone="missing">Crypto</Chip></>}/>
              <ProfileRow label="Urgency"          value="Actively looking · open to convo now" pending/>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}
function ChatMsg({ from, text, chips, rationale }) {
  if (from === "me") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: 520 }}>
        <div style={{ background: "var(--ink-900)", color: "var(--text-onink)", padding: "12px 14px", borderRadius: "14px 14px 4px 14px", fontSize: 14, lineHeight: 1.5 }}>{text}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12, maxWidth: 580 }}>
      <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--ochre-100)", color: "var(--ochre-900)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon.Sparkle size={14}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ background: rationale ? "var(--ochre-100)" : "var(--surface)", border: "1px solid " + (rationale ? "var(--ochre-200)" : "var(--line-2)"), padding: "12px 14px", borderRadius: "4px 14px 14px 14px", fontSize: 14, lineHeight: 1.5 }}>
          {rationale && <div className="eyebrow" style={{ marginBottom: 6, color: "var(--ochre-900)" }}>Why I'm asking</div>}
          {text}
          {chips && <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>{chips.map(c => <Chip key={c} tone="ink">{c}</Chip>)}</div>}
        </div>
      </div>
    </div>
  );
}
function ProfileRow({ label, value, pending }) {
  return (
    <div style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 12 }}>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 6 }}>
        {label}{pending && <span style={{ marginLeft: 8, color: "var(--ochre-700)" }}>· up next</span>}
      </div>
      <div style={{ fontSize: 13.5 }}>{value}</div>
    </div>
  );
}

// ── 4. MASTER RESUME WORKSPACE ────────────────────────────────────────────
function MasterResumeDesktop() {
  const outline = [
    ["Summary", true],
    ["Experience", false, ["Stripe — Senior Product Designer","Notion — Product Designer","Asana — Designer","Square — Design Intern"]],
    ["Skills", false],
    ["Education", false],
    ["Projects", false],
    ["Certifications", false],
  ];
  return (
    <DesktopFrame>
      <Sidebar active="Resume"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Master resume · v3" title="Maya Kapoor — Master CV"
          right={<>
            <StatusPill status="reviewed"/>
            <button className="btn btn-ghost btn-sm"><Icon.Eye size={13}/> Original</button>
            <button className="btn btn-secondary btn-sm"><Icon.Refresh size={13}/> Regenerate section</button>
            <button className="btn btn-primary btn-sm">Approve master</button>
          </>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 320px", overflow: "hidden" }}>
          {/* Outline */}
          <div style={{ borderRight: "1px solid var(--line-2)", padding: "20px 16px", overflow: "auto", background: "var(--paper)" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Outline</div>
            {outline.map(([s, active, children]) => (
              <div key={s} style={{ marginBottom: 4 }}>
                <div style={{
                  padding: "7px 10px", borderRadius: 6,
                  background: active ? "var(--ink-100)" : "transparent",
                  color: active ? "var(--ink-900)" : "var(--text-soft)",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>{s}{active && <Icon.Pencil size={12}/>}</div>
                {children && children.map(c => (
                  <div key={c} style={{ padding: "5px 10px 5px 22px", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--text-faint)" }}/>{c}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 18, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Parse confidence</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="score-bar" style={{ flex: 1 }}><i style={{ width: "91%" }}/></div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>91%</div>
              </div>
            </div>
            <div style={{ marginTop: 18, padding: 12, background: "var(--ochre-100)", borderRadius: 10, border: "1px solid var(--ochre-200)" }}>
              <div className="eyebrow" style={{ color: "var(--ochre-900)", marginBottom: 4 }}>AI suggestion</div>
              <div style={{ fontSize: 12, color: "var(--ochre-900)" }}>Your Asana role is dense. I drafted a tighter version — 4 bullets instead of 7.</div>
              <button className="btn btn-ai btn-sm" style={{ marginTop: 10 }}>Review draft</button>
            </div>
          </div>

          {/* Document canvas */}
          <div style={{ overflow: "auto", padding: 32, background: "var(--paper-2)" }}>
            <div className="doc" style={{ maxWidth: 700, margin: "0 auto" }}>
              <h1>Maya Kapoor</h1>
              <div className="meta">Senior Product Designer · San Francisco · maya@kapoor.studio · linkedin.com/in/maya-k</div>
              <h2>Summary</h2>
              <p>
                Product designer with 6+ years building <span className="ai-edit">design systems used by 40+ product teams</span>,
                focused on <span className="ai-edit">workspace tooling that reduces cognitive load for technical users</span>.
                Most recently led <span className="ai-edit">three cross-pod initiatives at Stripe</span> spanning developer onboarding,
                billing, and ATS-grade documentation.
              </p>
              <h2>Experience</h2>
              <h3>Stripe — Senior Product Designer <span className="meta" style={{ float: "right", fontWeight: 400 }}>2022 – Present · San Francisco</span></h3>
              <ul>
                <li><span className="ins">Led the design of Stripe's onboarding-data primitives</span> used by 12k merchants in their first 30 days.</li>
                <li>Owned the developer-docs design system; <span className="ai-edit">reduced time-to-first-API-call by 22%</span> on the platform-redesign cohort.</li>
                <li><span className="del">Improved performance metrics</span> <span className="ins">Cut TTI by 1.4s on p75 across the dashboard shell</span>.</li>
                <li>Partnered with research to ship a <span className="ai-edit">quarterly trust-and-safety review ritual</span> now adopted by 4 product groups.</li>
              </ul>
              <h3>Notion — Product Designer <span className="meta" style={{ float: "right", fontWeight: 400 }}>2019 – 2022 · San Francisco</span></h3>
              <ul>
                <li>Designed <span className="ai-edit">the database block surface</span> used by ~60% of teams during their first week.</li>
                <li>Led accessibility working group — shipped keyboard-first navigation across 14 core surfaces.</li>
              </ul>
              <h3>Asana — Designer</h3>
              <ul style={{ opacity: 0.6 }}>
                <li className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>… 4 bullets, AI-tightened draft pending review.</li>
              </ul>
            </div>
          </div>

          {/* Right: suggestions panel */}
          <div style={{ borderLeft: "1px solid var(--line-2)", padding: 18, overflow: "auto", background: "var(--paper)" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>AI changes on this section</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SuggestionCard
                kind="rewrite"
                title="Tighter summary"
                before="6+ years of experience designing for high-growth tech companies, including Stripe and Notion."
                after="Product designer with 6+ years building design systems used by 40+ product teams."
                why="Front-loads measurable impact; removes generic 'high-growth' language ATS systems devalue."
              />
              <SuggestionCard
                kind="quantify"
                title="Quantified bullet"
                before="Improved performance metrics."
                after="Cut TTI by 1.4s on p75 across the dashboard shell."
                why="Specific, verifiable from your portfolio notes."
              />
              <div style={{ padding: 12, background: "var(--paper-2)", borderRadius: 10 }}>
                <div className="eyebrow">Hallucination check</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12.5 }}>
                  <Icon.Check size={14} color="var(--sage-700)"/> All AI changes grounded in your truth layer.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}
function SuggestionCard({ title, before, after, why, kind }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <AiBadge label={kind}/>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <div className="del" style={{ display: "block", marginBottom: 4 }}>{before}</div>
        <div className="ins" style={{ display: "block" }}>{after}</div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
        <strong style={{ color: "var(--text-soft)" }}>Why →</strong> {why}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Accept</button>
        <button className="btn btn-ghost btn-sm">Edit</button>
        <button className="btn btn-ghost btn-sm">Reject</button>
      </div>
    </div>
  );
}

// ── 5. JOB MATCH BOARD ────────────────────────────────────────────────────
const JOBS = [
  { co: "Linear", role: "Senior Product Designer", loc: "Remote · US", comp: "$190–230k", score: 87, posted: "2d", match: ["Design systems","Figma","Prototyping","Dev tools"], miss: ["Motion design"], tags:["Remote"] },
  { co: "Vercel", role: "Staff Product Designer, Platform", loc: "SF / Remote", comp: "$210–260k", score: 82, posted: "5d", match: ["Design systems","Dev tools","Documentation"], miss: ["B2B SaaS pricing","System design"], tags:["Hybrid"] },
  { co: "Ramp",   role: "Sr. Product Designer, Card", loc: "NYC", comp: "$180–210k", score: 74, posted: "1d", match: ["Fintech","Design systems"], miss: ["Compliance UX","Motion design"], tags:["On-site"] },
  { co: "Notion", role: "Lead Designer, Databases", loc: "SF / Remote", comp: "$200–250k", score: 79, posted: "1w", match: ["Notion alum","Workspace","Design systems"], miss: ["Lead exp."], tags:["Hybrid"] },
  { co: "Figma",  role: "Sr. Designer, Education", loc: "Remote", comp: "$170–210k", score: 68, posted: "3d", match: ["Design systems","Docs"], miss: ["Community building","Edu content"], tags:["Remote"] },
  { co: "Anthropic", role: "Product Designer, Claude", loc: "SF", comp: "$200–260k", score: 64, posted: "4h", match: ["Workspace","Dev tools"], miss: ["AI eval","Research-led"], tags:["On-site"] },
];
function JobBoardDesktop() {
  return (
    <DesktopFrame>
      <Sidebar active="Jobs"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Job match board" title="42 new matches this week"
          right={<>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface)" }}>
              <Icon.Search size={14}/> <input placeholder="Paste a job URL or search…" style={{ width: 280, border: 0, outline: 0, fontSize: 13, background: "transparent", fontFamily: "inherit" }}/>
            </div>
            <button className="btn btn-ai btn-sm"><Icon.Sparkle size={13}/> Find similar</button>
          </>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "240px 1fr", overflow: "hidden" }}>
          {/* Filters */}
          <div style={{ borderRight: "1px solid var(--line-2)", padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 18, background: "var(--paper)" }}>
            <div className="eyebrow">Filters</div>
            <FilterGroup label="Match score">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-muted)" }}>
                <span>60</span><span className="mono">≥ 75</span><span>100</span>
              </div>
              <div className="score-bar" style={{ marginTop: 8 }}><i style={{ width: "60%" }}/></div>
            </FilterGroup>
            <FilterGroup label="Role">
              {["Senior","Staff","Lead","Manager"].map(r => <Chip key={r} tone={r==="Senior" || r==="Staff" ? "ink":"default"}>{r}</Chip>)}
            </FilterGroup>
            <FilterGroup label="Location">
              {["Remote","SF Bay","NYC","Hybrid"].map(r => <Chip key={r} tone={r==="Remote" ? "ink":"default"}>{r}</Chip>)}
            </FilterGroup>
            <FilterGroup label="Industry">
              {["Dev tools","Fintech","Healthcare","Productivity"].map(r => <Chip key={r}>{r}</Chip>)}
            </FilterGroup>
            <FilterGroup label="Status">
              {[
                ["Not started", 24],["Tailored", 8],["Approved", 4],["Applied", 6],
              ].map(([r,n]) => <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, padding: "5px 2px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: "1px solid var(--line-strong)" }}/>{r}</span>
                <span className="mono" style={{ color: "var(--text-muted)", fontSize: 11 }}>{n}</span>
              </div>)}
            </FilterGroup>
          </div>

          {/* Board grid */}
          <div style={{ overflow: "auto", padding: 28, background: "var(--paper-2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
                <span style={{ fontWeight: 600, paddingBottom: 6, borderBottom: "2px solid var(--ink-900)" }}>All matches · 42</span>
                <span style={{ color: "var(--text-muted)" }}>Saved · 7</span>
                <span style={{ color: "var(--text-muted)" }}>Applied · 6</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm">Grid</button>
                <button className="btn btn-ghost btn-sm" style={{ background: "var(--paper-3)" }}>List</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {JOBS.map((j, i) => <JobCard key={j.co} j={j} highlighted={i === 0}/>)}
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}
function FilterGroup({ label, children }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}
function JobCard({ j, highlighted }) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative", borderColor: highlighted ? "var(--ink-700)" : undefined, boxShadow: highlighted ? "0 0 0 1px var(--ink-700)" : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", flexShrink: 0 }}>{j.co[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{j.co} · {j.posted} ago</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{j.role}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{j.loc} · {j.comp}</div>
        </div>
        <ScoreRing value={j.score} size={48}/>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {j.match.slice(0,3).map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10}/>}>{s}</Chip>)}
        {j.miss.slice(0,2).map(s => <Chip key={s} tone="missing">+ {s}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 4, borderTop: "1px solid var(--line-2)" }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>View match</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}><Icon.Sparkle size={12}/> Tailor & apply</button>
      </div>
    </div>
  );
}

Object.assign(window, { LandingDesktop, UploadDesktop, OnboardingChatDesktop, MasterResumeDesktop, JobBoardDesktop });
