/* global React, Icon, Avatar, AiBadge, StatusPill, Chip, ScoreRing, Sidebar, Topbar, Placeholder */
// Extras — Dashboard, Settings, and the States gallery (empty / loading / error).

// ── Shared frame
function ExFrame({ children, w = 1440, h = 900 }) {
  return <div className="app-root" style={{ width: w, height: h, background: "var(--paper)", overflow: "hidden", display: "flex", position: "relative" }}>{children}</div>;
}

// ──────────────────────────────────────────────────────────────────────────
// DASHBOARD (desktop)
// ──────────────────────────────────────────────────────────────────────────
function DashboardDesktop() {
  return (
    <ExFrame>
      <Sidebar active="Dashboard"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Welcome back, Maya" title="Wednesday, 21 May"
          right={<>
            <button className="btn btn-secondary btn-sm"><Icon.Search size={13}/> Search</button>
            <button className="btn btn-primary btn-sm"><Icon.Plus size={13}/> New tailor</button>
          </>}/>
        <div style={{ flex: 1, overflow: "auto", padding: 28, background: "var(--paper-2)" }}>

          {/* Top stripe — key numbers + master resume hero */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="eyebrow">Master resume</div>
                <StatusPill status="reviewed"/>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 26, marginTop: 4 }}>Maya Kapoor · v3</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>4 AI suggestions waiting for review.</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button className="btn btn-primary btn-sm">Open workspace</button>
                <button className="btn btn-ghost btn-sm">Approve master</button>
              </div>
            </div>
            <Stat label="Matches this week" value="42" delta="+8" trend="up"/>
            <Stat label="Pending approval" value="3" delta="2 reviewed" trend="warn"/>
            <Stat label="Approval rate" value="86%" delta="+4%" trend="up"/>
          </div>

          {/* Middle — top matches + activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 18 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div className="eyebrow">Top matches today</div>
                  <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>Three I'd start with</div>
                </div>
                <button className="btn btn-ghost btn-sm">All matches <Icon.ChevronR size={12}/></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Linear",    "Senior Product Designer", "Remote · $190–230k", 87, ["Design systems","Dev tools"], "Motion"],
                  ["Vercel",    "Staff PD, Platform",      "SF / Remote",        82, ["Docs","Workspace"],          "System design"],
                  ["Anthropic", "Product Designer, Claude","SF",                 64, ["Dev tools","Workspace"],     "AI eval"],
                ].map(([co, role, loc, score, match, miss]) => (
                  <div key={co} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto 100px", gap: 14, alignItems: "center", padding: "10px 6px", borderBottom: "1px solid var(--line-2)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 15 }}>{co[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{role}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{co} · {loc}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {match.map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10}/>}>{s}</Chip>)}
                      <Chip tone="missing">+ {miss}</Chip>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                      <ScoreRing value={score} size={36}/>
                      <Icon.ChevronR size={14} color="var(--text-muted)"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Recent activity</div>
              {[
                ["You approved",      "Vercel · Resume v3", "Just now", "approved"],
                ["AI generated",      "Notion · Cover letter draft", "12m ago", "ai"],
                ["AI reviewed",       "Linear · Resume tailored", "1h ago", "ai"],
                ["You edited",        "Master · Experience section", "3h ago", "edit"],
                ["AI suggested",      "Skill goal: System design", "Yesterday", "ai"],
              ].map(([who, what, when, kind], i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--line-2)" : "none" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, marginTop: 7, flexShrink: 0,
                    background: kind === "approved" ? "var(--success)" : kind === "ai" ? "var(--ochre-700)" : "var(--ink-700)" }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 500 }}>{who}</strong> · {what}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — skill gap teaser + linkedin teaser */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card" style={{ padding: 18, display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 80, height: 80, position: "relative" }}>
                <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none"/>
                  <circle cx={40} cy={40} r={34} stroke="var(--ochre-700)" strokeWidth="6" fill="none" strokeDasharray={214} strokeDashoffset={34} strokeLinecap="round"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 28 }}>84</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow">Top skill gap</div>
                <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>System design</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Blocks 7 of your 10 saved roles.</div>
              </div>
              <button className="btn btn-secondary btn-sm">Open roadmap</button>
            </div>

            <div className="card" style={{ padding: 18, display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--ink-100)", color: "var(--ink-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon.LinkedIn size={26}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow">LinkedIn review</div>
                <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>Your headline scores 62</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>3 rewrites drafted — pick one to copy.</div>
              </div>
              <button className="btn btn-secondary btn-sm">View feedback</button>
            </div>
          </div>
        </div>
      </div>
    </ExFrame>
  );
}
function Stat({ label, value, delta, trend = "up" }) {
  const tone = trend === "up" ? "var(--success)" : trend === "warn" ? "var(--ochre-900)" : "var(--text-muted)";
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div className="eyebrow">{label}</div>
      <div>
        <div className="display" style={{ fontSize: 38, lineHeight: 1, marginTop: 8 }}>{value}</div>
        <div style={{ fontSize: 12, color: tone, marginTop: 4, fontWeight: 500 }}>{delta}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SETTINGS · API KEYS (desktop)
// ──────────────────────────────────────────────────────────────────────────
function SettingsDesktop() {
  const nav = [
    "Profile", "API keys", "Privacy & data", "Plan", "Notifications", "Export",
  ];
  return (
    <ExFrame>
      <Sidebar active="Dashboard"/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar eyebrow="Settings" title="API keys & model strategy"
          right={<><button className="btn btn-secondary btn-sm">Cancel</button><button className="btn btn-primary btn-sm">Save changes</button></>}/>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", overflow: "hidden" }}>
          {/* Sub-nav */}
          <div style={{ borderRight: "1px solid var(--line-2)", padding: 20, background: "var(--paper)" }}>
            {nav.map((n, i) => (
              <div key={n} style={{
                padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 2,
                color: i === 1 ? "var(--ink-900)" : "var(--text-soft)",
                background: i === 1 ? "var(--ink-100)" : "transparent",
                fontWeight: i === 1 ? 500 : 400,
              }}>{n}</div>
            ))}
          </div>
          {/* Form */}
          <div style={{ overflow: "auto", padding: "28px 36px", background: "var(--paper-2)" }}>
            {/* Intro */}
            <div style={{ maxWidth: 760, marginBottom: 26 }}>
              <div className="serif" style={{ fontSize: 26 }}>Bring your own model — or use ours.</div>
              <div style={{ fontSize: 13.5, color: "var(--text-soft)", marginTop: 8, lineHeight: 1.55 }}>
                We use embeddings on our own servers for matching. For rewriting, tailoring, and cover letters you can plug in your own keys —
                we'll route generation through them and never see the content. If you don't add a key, we fall back to our hosted
                open-source model.
              </div>
            </div>

            {/* Key cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 980, marginBottom: 22 }}>
              <KeyCard provider="OpenAI"    status="connected" key1="sk-…N3p2" lastUsed="2m ago · cover letter"   models={["gpt-4.1", "gpt-4.1-mini"]}/>
              <KeyCard provider="Anthropic" status="connected" key1="sk-ant-…f9c" lastUsed="14m ago · resume tailor" models={["claude-sonnet-4.5", "claude-haiku-4.5"]} primary/>
              <KeyCard provider="Google"    status="empty"     placeholder="AIza…"  models={["gemini-2.5-pro"]}/>
              <KeyCard provider="Local · vLLM" status="advanced" host="http://localhost:8000" models={["llama-3.3-70b"]}/>
            </div>

            {/* Routing rules */}
            <div className="card" style={{ padding: 22, maxWidth: 980, marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div className="eyebrow">Routing rules</div>
                  <div className="serif" style={{ fontSize: 20, marginTop: 2 }}>Which model handles what</div>
                </div>
                <button className="btn btn-ghost btn-sm">Reset to defaults</button>
              </div>
              {[
                ["Resume tailoring",       "Anthropic · claude-sonnet-4.5",  "Higher craft for nuanced rewrites"],
                ["Cover letter drafting",  "OpenAI · gpt-4.1",                "Strong long-form coherence"],
                ["Match explanations",     "Platform · hosted",               "Cheap, fast, no PII leaves us"],
                ["Skill-gap rationale",    "Platform · hosted",               "Cheap, fast, no PII leaves us"],
                ["LinkedIn rewrites",      "Anthropic · claude-haiku-4.5",    "Light, low cost"],
              ].map(([task, model, why]) => (
                <div key={task} style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr 100px", gap: 14, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line-2)", fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{task}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-soft)" }}>{model}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{why}</div>
                  <button className="btn btn-ghost btn-sm" style={{ justifySelf: "end" }}>Change</button>
                </div>
              ))}
            </div>

            {/* Usage + guardrails */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, maxWidth: 980 }}>
              <div className="card" style={{ padding: 22 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Usage this month</div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div className="display" style={{ fontSize: 42 }}>1.2M</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>tokens · est. cost on your keys</div>
                    <div className="serif" style={{ fontSize: 22, marginTop: 2 }}>$3.84</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    ["Anthropic", 62],["OpenAI", 24],["Platform", 12],["Local", 2],
                  ].map(([n, p]) => (
                    <div key={n}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                        <span>{n}</span><span className="mono" style={{ color: "var(--text-muted)" }}>{p}%</span>
                      </div>
                      <div className="score-bar" style={{ marginTop: 4 }}><i style={{ width: p + "%" }}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 22 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Guardrails</div>
                {[
                  ["Truth-layer check on resume rewrites", true],
                  ["Hallucination diff before approval",   true],
                  ["Block on unverifiable employers",      true],
                  ["Mention model used in tooltip",        false],
                ].map(([n, on]) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line-2)", fontSize: 13 }}>
                    <span>{n}</span>
                    <Toggle on={on}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ExFrame>
  );
}
function KeyCard({ provider, status, key1, placeholder, lastUsed, models = [], primary, host }) {
  const tones = {
    connected: ["var(--sage-100)",  "var(--sage-900)",  "Connected"],
    empty:     ["var(--paper-3)",   "var(--text-soft)", "Not configured"],
    advanced:  ["var(--ink-100)",   "var(--ink-900)",   "Advanced · local"],
  };
  const [bg, fg, label] = tones[status];
  return (
    <div className="card" style={{ padding: 18, position: "relative" }}>
      {primary && <div className="pill pill-ai" style={{ position: "absolute", top: 14, right: 14 }}>Primary</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--ink-900)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 16 }}>{provider[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{provider}</div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, letterSpacing: 0.02 }}>{label}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-soft)", background: "var(--paper-2)" }}>
        {host ? <Icon.Compass size={13}/> : <Icon.Lightning size={13}/>}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{key1 || host || placeholder}</span>
        {key1 && <button className="btn btn-ghost btn-sm">Rotate</button>}
        {!key1 && !host && <button className="btn btn-primary btn-sm">Add key</button>}
      </div>
      {lastUsed && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Last used · {lastUsed}</div>}
      {models.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
          {models.map(m => <span key={m} className="mono" style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 999, background: "var(--paper-2)", color: "var(--text-soft)", border: "1px solid var(--line-2)" }}>{m}</span>)}
        </div>
      )}
    </div>
  );
}
function Toggle({ on }) {
  return (
    <div style={{
      width: 34, height: 20, borderRadius: 999,
      background: on ? "var(--ink-900)" : "var(--paper-3)",
      display: "flex", alignItems: "center",
      justifyContent: on ? "flex-end" : "flex-start",
      padding: 2,
      transition: "background .15s",
    }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE: Dashboard
// ──────────────────────────────────────────────────────────────────────────
function DashboardMobile() {
  return (
    <div className="app-root" style={{ width: 390, height: 844, background: "var(--paper-2)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <div className="m-statusbar"><span className="mono">9:41</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}/></div>
      <div style={{ padding: "8px 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name="Maya K" size={36}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Wednesday morning</div>
          <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Hi, Maya</div>
        </div>
        <Icon.Bell size={20}/>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
        {/* Master resume hero */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="eyebrow">Master resume · v3</div>
            <StatusPill status="reviewed"/>
          </div>
          <div className="serif" style={{ fontSize: 22, marginTop: 8 }}>4 AI changes waiting</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Tap through · 2 min to review</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Review</button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Approve all</button>
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[["42","matches"],["3","pending"],["86%","approved"]].map(([v,l]) => (
            <div key={l} className="card" style={{ padding: 12, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 24 }}>{v}</div>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Top match */}
        <div className="eyebrow" style={{ margin: "8px 0" }}>Start with</div>
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 15 }}>L</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Senior Product Designer</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Linear · Remote</div>
            </div>
            <ScoreRing value={87} size={40}/>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
            <Chip tone="match" icon={<Icon.Check size={10}/>}>Design systems</Chip>
            <Chip tone="match" icon={<Icon.Check size={10}/>}>Dev tools</Chip>
            <Chip tone="missing">+ Motion</Chip>
          </div>
        </div>
        {/* Activity */}
        <div className="eyebrow" style={{ margin: "8px 0" }}>Activity</div>
        <div className="card" style={{ overflow: "hidden" }}>
          {[
            ["You approved", "Vercel · Resume v3", "Just now", "approved"],
            ["AI generated", "Notion · Cover letter", "12m ago", "ai"],
            ["AI suggested", "Skill goal: System design", "1h ago", "ai"],
          ].map((row, i) => (
            <div key={i} style={{ padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--line-2)" : "none", display: "flex", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, marginTop: 7, flexShrink: 0,
                background: row[3] === "approved" ? "var(--success)" : "var(--ochre-700)" }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 500 }}>{row[0]}</strong> · {row[1]}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row[2]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Tabbar */}
      <div className="m-tabbar">
        {[["Home", Icon.Home, true],["Resume", Icon.Doc],["Jobs", Icon.Briefcase],["Roadmap", Icon.Map],["You", Icon.Settings]].map(([n, I, a]) => (
          <div key={n} className={"m-tab" + (a ? " active" : "")}>
            <I size={22} color={a ? "var(--ink-900)" : "var(--text-muted)"}/><span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE: Settings (compact API-key view)
// ──────────────────────────────────────────────────────────────────────────
function SettingsMobile() {
  return (
    <div className="app-root" style={{ width: 390, height: 844, background: "var(--paper-2)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <div className="m-statusbar"><span className="mono">9:41</span></div>
      <div style={{ padding: "8px 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Icon.Chevron size={20} style={{ transform: "rotate(90deg)" }}/>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.1 }}>Settings</div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>API keys</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
        <div style={{ padding: 14, background: "var(--ochre-100)", border: "1px solid var(--ochre-200)", borderRadius: 12, fontSize: 12.5, color: "var(--ochre-900)", marginBottom: 14, display: "flex", gap: 10 }}>
          <Icon.Sparkle size={14}/>
          <div>Bring your own keys for higher-quality drafts. Without one we use our hosted open-source model.</div>
        </div>

        {[
          { p: "Anthropic", s: "connected", k: "sk-ant-…f9c", primary: true,  m: ["claude-sonnet-4.5","claude-haiku-4.5"], used: "14m ago" },
          { p: "OpenAI",    s: "connected", k: "sk-…N3p2",                       m: ["gpt-4.1","gpt-4.1-mini"], used: "2m ago" },
          { p: "Google",    s: "empty",     k: "AIza…",                          m: ["gemini-2.5-pro"] },
        ].map(card => (
          <div key={card.p} className="card" style={{ padding: 14, marginBottom: 10, position: "relative" }}>
            {card.primary && <div className="pill pill-ai" style={{ position: "absolute", top: 12, right: 12 }}>Primary</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--ink-900)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 14 }}>{card.p[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{card.p}</div>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: card.s === "connected" ? "var(--sage-100)" : "var(--paper-3)", color: card.s === "connected" ? "var(--sage-900)" : "var(--text-soft)" }}>
                  {card.s === "connected" ? "Connected" : "Not configured"}
                </span>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11.5, marginTop: 10, padding: "6px 10px", background: "var(--paper-2)", borderRadius: 6, border: "1px solid var(--line-2)" }}>{card.k}</div>
            {card.used && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Last used · {card.used}</div>}
            <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
              {card.m.map(m => <span key={m} className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--paper-2)", color: "var(--text-soft)", border: "1px solid var(--line-2)" }}>{m}</span>)}
            </div>
          </div>
        ))}

        <div className="eyebrow" style={{ margin: "18px 0 8px" }}>Routing rules</div>
        {[
          ["Resume tailoring",    "Anthropic"],
          ["Cover letter",        "OpenAI"],
          ["Match explanations",  "Platform"],
          ["LinkedIn rewrites",   "Anthropic"],
        ].map(([t, m]) => (
          <div key={t} className="card" style={{ padding: 12, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13 }}>{t}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{m}</span>
              <Icon.ChevronR size={13} color="var(--text-muted)"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// STATES GALLERY (one tall artboard)
// ──────────────────────────────────────────────────────────────────────────
function StatesArtboard() {
  return (
    <div className="app-root" style={{ width: 1280, padding: 56, background: "var(--paper)" }}>
      <div style={{ marginBottom: 36, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">04 · States</div>
          <h1 className="display" style={{ fontSize: 56, marginTop: 8 }}>The 80% of screens that aren't the happy path.</h1>
          <p style={{ marginTop: 16, color: "var(--text-soft)", fontSize: 15, maxWidth: 600 }}>
            Three categories — empty, loading, error — each with the visual rules and pattern they share. Each screen in the
            product picks from this kit instead of inventing its own.
          </p>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>v0.1 · 2026.05</div>
      </div>

      {/* ── EMPTY ── */}
      <SectionHead n="A" t="Empty states" sub="A useful illustration of what should be here, plus the single most-likely next action."/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 36 }}>
        <Empty
          title="No resume yet"
          body="Drop a PDF or DOCX to start. We'll detect sections, normalise skills, and prepare your master."
          cta="Upload resume"
          icon={<Icon.Doc size={32} color="var(--ink-700)"/>}
          glyph={<DocGlyph/>}
        />
        <Empty
          title="No matches yet"
          body="Add a few target roles, paste a JD, or tell us what kind of work you want. Matches start within a minute."
          cta="Add a target role"
          icon={<Icon.Briefcase size={32} color="var(--ink-700)"/>}
          glyph={<BoardGlyph/>}
        />
        <Empty
          title="No skill gaps detected"
          body="You're aligned with your target roles — solid. We'll watch new saved jobs and surface gaps as they emerge."
          cta="Review target jobs"
          icon={<Icon.Map size={32} color="var(--sage-700)"/>}
          tone="success"
          glyph={<MapGlyph/>}
        />
        <Empty
          title="No LinkedIn profile linked"
          body="Paste your headline, about, and experience and we'll score each section against your saved jobs."
          cta="Paste profile"
          icon={<Icon.LinkedIn size={32} color="var(--ink-700)"/>}
          glyph={<LinkedInGlyph/>}
        />
      </div>

      {/* ── LOADING ── */}
      <SectionHead n="B" t="Loading states" sub="Skeletons that mirror the final layout — never a centred spinner."/>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginBottom: 36 }}>
        {/* Parsing */}
        <LoadingCard title="Parsing your resume" sub="Extracting sections · normalising skills · about 4 seconds left">
          <SkeletonRow w="60%"/>
          <SkeletonRow w="40%" small/>
          <div style={{ height: 1, background: "var(--line-2)", margin: "10px 0" }}/>
          {Array.from({length: 4}).map((_, i) => <SkeletonRow key={i} w={`${90 - i*8}%`}/>)}
        </LoadingCard>
        {/* Matching */}
        <LoadingCard title="Scoring 42 jobs" sub="Computing embeddings + skill overlap">
          {Array.from({length: 4}).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--paper-3)" }}/>
              <div style={{ flex: 1 }}>
                <SkeletonRow w="80%"/><SkeletonRow w="50%" small/>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: "var(--paper-3)" }}/>
            </div>
          ))}
        </LoadingCard>
        {/* Generation */}
        <LoadingCard title="Tailoring resume for Linear" sub="AI is rewriting 3 bullets" pulse>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: 10, background: "var(--ochre-100)", borderRadius: 8 }}>
            <Icon.Sparkle size={14} color="var(--ochre-900)"/>
            <div className="mono" style={{ fontSize: 11, color: "var(--ochre-900)" }}>Streaming · 142 tokens</div>
          </div>
          {Array.from({length: 5}).map((_, i) => <SkeletonRow key={i} w={`${85 - i*6}%`}/>)}
        </LoadingCard>
      </div>

      {/* ── ERROR ── */}
      <SectionHead n="C" t="Error states" sub="What broke, why, and exactly what to do next. No dead-ends."/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 36 }}>
        <ErrorCard
          tone="error"
          title="We couldn't read this PDF"
          code="parse_failed · pdf_scan_with_no_text_layer"
          body="The file looks like a scan — it has images of text but no extractable text layer. Try exporting from your editor as a text-based PDF, or upload a DOCX."
          actions={["Try a different file", "Use OCR (beta)"]}
        />
        <ErrorCard
          tone="warning"
          title="Your OpenAI key returned a 429"
          code="model_429 · rate_limited_on_your_key"
          body="We can fall back to our hosted model for this rewrite, or wait 30 seconds and retry with your key."
          actions={["Use platform model", "Retry in 30s"]}
        />
        <ErrorCard
          tone="warning"
          title="The job page wouldn't open"
          code="fetch_blocked · greenhouse_robots_disallow"
          body="Greenhouse blocked our crawler. Paste the JD as text and we'll score it the same way."
          actions={["Paste JD as text", "Skip this job"]}
        />
        <ErrorCard
          tone="error"
          title="Hallucination check failed"
          code="guardrail · invented_employer"
          body={<>A draft introduced an employer (<strong>Datadog</strong>) that isn't in your master resume. We've blocked it — review the truth layer or accept the original bullet.</>}
          actions={["Review truth layer", "Use original bullet"]}
        />
      </div>

      {/* ── Toasts ── */}
      <SectionHead n="D" t="Toasts & inline" sub="System feedback that doesn't pull the user out of context."/>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          <Toast kind="success" title="Resume approved for Linear" body="Ready to download or copy as Markdown."/>
          <Toast kind="ai"      title="Cover letter regenerated"   body="Two bullets changed · view diff to compare."/>
          <Toast kind="error"   title="Save failed — retrying"     body="Local changes are safe. Reconnecting in 4s."/>
          <Toast kind="info"    title="Using OpenAI · gpt-4.1"     body="$0.03 estimated for this draft."/>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ n, t, sub }) {
  return (
    <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{n}</div>
      <div className="serif" style={{ fontSize: 28 }}>{t}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", borderLeft: "1px solid var(--line)", paddingLeft: 12, flex: 1 }}>{sub}</div>
    </div>
  );
}

function Empty({ title, body, cta, icon, tone = "default", glyph }) {
  return (
    <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 200, height: 120, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {glyph}
      </div>
      <div className="serif" style={{ fontSize: 22 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 8, maxWidth: 360 }}>{body}</div>
      <div style={{ marginTop: 18 }}>
        <button className={tone === "success" ? "btn btn-secondary" : "btn btn-primary"}>{cta}</button>
      </div>
    </div>
  );
}

// Simple SVG glyphs used in empty states (geometric, abstract — no faux illustrations)
function DocGlyph() {
  return (
    <svg width={140} height={120} viewBox="0 0 140 120" fill="none">
      <rect x="34" y="14" width="72" height="92" rx="6" fill="#fff" stroke="rgba(28,25,23,0.15)"/>
      {[26, 36, 46, 56, 66, 76, 86].map((y, i) => <rect key={i} x="44" y={y} width={[40, 50, 36, 48, 44, 30, 38][i]} height="4" rx="2" fill="var(--paper-3)"/>)}
      <circle cx="106" cy="24" r="14" fill="var(--ochre-100)" stroke="var(--ochre-500)"/>
      <path d="M101 24l4 4 6-8" stroke="var(--ochre-900)" strokeWidth="2" fill="none"/>
    </svg>
  );
}
function BoardGlyph() {
  return (
    <svg width={160} height={120} viewBox="0 0 160 120" fill="none">
      {[10, 60, 110].map((x, i) => (
        <rect key={i} x={x} y={i === 1 ? 18 : 28} width="44" height={i === 1 ? 90 : 70} rx="6" fill="#fff" stroke="rgba(28,25,23,0.15)"/>
      ))}
      <rect x="18" y="40" width="28" height="4" rx="2" fill="var(--paper-3)"/>
      <rect x="18" y="50" width="20" height="4" rx="2" fill="var(--paper-3)"/>
      <rect x="68" y="32" width="28" height="4" rx="2" fill="var(--paper-3)"/>
      <rect x="68" y="42" width="22" height="4" rx="2" fill="var(--paper-3)"/>
      <rect x="118" y="42" width="28" height="4" rx="2" fill="var(--paper-3)"/>
    </svg>
  );
}
function MapGlyph() {
  return (
    <svg width={180} height={120} viewBox="0 0 180 120" fill="none">
      <line x1="20" y1="60" x2="160" y2="60" stroke="var(--line)" strokeDasharray="4 4"/>
      {[20, 60, 100, 140].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="60" r={i === 0 ? 8 : 6} fill={i === 0 ? "var(--ink-900)" : i === 1 ? "var(--ink-700)" : i === 2 ? "var(--ink-500)" : "var(--ink-300)"}/>
          <text x={x} y="86" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="var(--text-muted)">W{i*2+1}</text>
        </g>
      ))}
    </svg>
  );
}
function LinkedInGlyph() {
  return (
    <svg width={160} height={120} viewBox="0 0 160 120" fill="none">
      <rect x="20" y="20" width="120" height="80" rx="6" fill="#fff" stroke="rgba(28,25,23,0.15)"/>
      <circle cx="44" cy="46" r="12" fill="var(--paper-3)"/>
      <rect x="62" y="38" width="60" height="5" rx="2" fill="var(--paper-3)"/>
      <rect x="62" y="48" width="40" height="4" rx="2" fill="var(--paper-3)"/>
      <rect x="30" y="72" width="100" height="3" rx="2" fill="var(--paper-3)"/>
      <rect x="30" y="80" width="80" height="3" rx="2" fill="var(--paper-3)"/>
    </svg>
  );
}

function LoadingCard({ title, sub, children, pulse }) {
  return (
    <div className="card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
      {pulse && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, var(--ochre-700), transparent)" }}/>}
      <div className="eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
function SkeletonRow({ w = "70%", small }) {
  return <div style={{ height: small ? 7 : 10, width: w, borderRadius: 999, background: "linear-gradient(90deg, var(--paper-2), var(--paper-3), var(--paper-2))" }}/>;
}

function ErrorCard({ tone = "error", title, code, body, actions = [] }) {
  const palette = {
    error:   { bg: "var(--error-bg)",   fg: "var(--error)",   icon: <Icon.X size={16}/> },
    warning: { bg: "var(--warning-bg)", fg: "var(--warning)", icon: <Icon.Bell size={16}/> },
  }[tone];
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: palette.bg, color: palette.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {palette.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{code}</div>
          <div style={{ fontSize: 13, color: "var(--text-soft)", marginTop: 8, lineHeight: 1.5 }}>{body}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {actions.map((a, i) => (
              <button key={a} className={i === 0 ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>{a}</button>
            ))}
            <button className="btn btn-ghost btn-sm">Contact support</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ kind, title, body }) {
  const palette = {
    success: { bg: "var(--success-bg)", fg: "var(--success)", icon: <Icon.Check size={14}/> },
    ai:      { bg: "var(--ochre-100)",  fg: "var(--ochre-900)", icon: <Icon.Sparkle size={14}/> },
    error:   { bg: "var(--error-bg)",   fg: "var(--error)", icon: <Icon.X size={14}/> },
    info:    { bg: "var(--info-bg)",    fg: "var(--info)", icon: <Icon.Bell size={14}/> },
  }[kind];
  return (
    <div style={{ padding: 14, background: "var(--ink-950)", color: "#fff", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: palette.bg, color: palette.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {palette.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{body}</div>
      </div>
      <Icon.X size={14} color="rgba(255,255,255,0.5)"/>
    </div>
  );
}

Object.assign(window, { DashboardDesktop, DashboardMobile, SettingsDesktop, SettingsMobile, StatesArtboard });
