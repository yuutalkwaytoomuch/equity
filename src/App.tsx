import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const T = {
  bg:       "#F5F5F7",
  surf:     "#FFFFFF",
  border:   "#E0E0E5",
  text:     "#1D1D1F",
  sub:      "#6E6E73",
  accent:   "#007AFF",
  accentBg: "#EAF2FF",
  green:    "#1A9C3E",
  greenBg:  "#EAF6ED",
  red:      "#C0392B",
  redBg:    "#FDECEA",
  warn:     "#B45309",
  warnBg:   "#FEF3C7",
  shadow:   "0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)",
  shadowLg: "0 2px 8px rgba(0,0,0,0.09), 0 8px 24px rgba(0,0,0,0.07)",
};
const D = {
  bg:       "#1C1C1E",
  surf:     "#2C2C2E",
  border:   "#3A3A3C",
  text:     "#F5F5F7",
  sub:      "#98989D",
};

/* ─────────────────────────────────────────────────────────
   MARKET DATA
───────────────────────────────────────────────────────── */
const CITIES = [
  { id:"nyc", label:"New York",  tz:"America/New_York",  exchange:"NYSE / NASDAQ",
    preOpen:"04:00", preClose:"09:30", open:"09:30", close:"16:00", afterOpen:"16:00", afterClose:"20:00" },
  { id:"sel", label:"Seoul",     tz:"Asia/Seoul",         exchange:"KRX",
    preOpen:"08:00", preClose:"09:00", open:"09:00", close:"15:30", afterOpen:"15:30", afterClose:"18:00" },
  { id:"lon", label:"London",    tz:"Europe/London",      exchange:"LSE",
    preOpen:null,    preClose:null,    open:"08:00", close:"16:30", afterOpen:null,    afterClose:null    },
];

const HOLIDAYS = {
  nyc: [
    {date:"2026-01-01",name:"New Year's Day"},{date:"2026-01-19",name:"MLK Jr. Day"},
    {date:"2026-02-16",name:"Presidents' Day"},{date:"2026-04-03",name:"Good Friday"},
    {date:"2026-05-25",name:"Memorial Day"},{date:"2026-07-03",name:"Independence Day (observed)"},
    {date:"2026-09-07",name:"Labor Day"},{date:"2026-11-26",name:"Thanksgiving Day"},
    {date:"2026-11-27",name:"Thanksgiving (early close 13:00)"},{date:"2026-12-25",name:"Christmas Day"},
  ],
  sel: [
    {date:"2026-01-01",name:"New Year's Day"},{date:"2026-02-16",name:"Lunar New Year Eve"},
    {date:"2026-02-17",name:"Lunar New Year"},{date:"2026-02-18",name:"Lunar New Year (observed)"},
    {date:"2026-03-01",name:"Independence Movement Day"},{date:"2026-05-05",name:"Children's Day"},
    {date:"2026-05-25",name:"Buddha's Birthday"},{date:"2026-06-06",name:"Memorial Day"},
    {date:"2026-08-15",name:"Liberation Day"},{date:"2026-09-24",name:"Chuseok Eve"},
    {date:"2026-09-25",name:"Chuseok"},{date:"2026-09-26",name:"Chuseok (observed)"},
    {date:"2026-10-03",name:"National Foundation Day"},{date:"2026-10-09",name:"Hangul Day"},
    {date:"2026-12-25",name:"Christmas Day"},
  ],
  lon: [
    {date:"2026-01-01",name:"New Year's Day"},{date:"2026-04-03",name:"Good Friday"},
    {date:"2026-04-06",name:"Easter Monday"},{date:"2026-05-04",name:"Early May Bank Holiday"},
    {date:"2026-05-25",name:"Spring Bank Holiday"},{date:"2026-08-31",name:"Summer Bank Holiday"},
    {date:"2026-12-25",name:"Christmas Day"},{date:"2026-12-28",name:"Boxing Day (observed)"},
  ],
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function getNow(tz) { return new Date(new Date().toLocaleString("en-US",{timeZone:tz})); }
function fmtTime(d) { return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}); }
function fmtDate(d) { return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}); }
function toMins(hhmm) { const [h,m]=hhmm.split(":").map(Number); return h*60+m; }

function marketStatus(city, now) {
  const mins = now.getHours()*60+now.getMinutes();
  const dow  = now.getDay();
  const ds   = now.toISOString().slice(0,10);
  const hol  = (HOLIDAYS[city.id]||[]).find(h=>h.date===ds);
  if (hol)          return {label:"Closed",   color:T.sub,   note:hol.name};
  if (dow===0||dow===6) return {label:"Closed",color:T.sub,   note:"Weekend"};
  const o=toMins(city.open), c=toMins(city.close);
  if (mins>=o && mins<c)  return {label:"Open",      color:T.green};
  if (city.preOpen && mins>=toMins(city.preOpen)  && mins<o) return {label:"Pre-market", color:T.warn};
  if (city.afterOpen && mins>=c && mins<toMins(city.afterClose)) return {label:"After-hours",color:T.warn};
  return {label:"Closed", color:T.sub};
}

function upcomingHolidays(cityId, tz) {
  const now    = getNow(tz);
  const today  = now.toISOString().slice(0,10);
  const ahead  = new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
  return (HOLIDAYS[cityId]||[]).filter(h=>h.date>=today&&h.date<=ahead);
}

function fmtUSD(n) { return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(n) { if(n==null) return "—"; return (n>=0?"+":"")+Number(n).toFixed(1)+"%"; }

function ls(key, fallback) { try{const v=localStorage.getItem(key); return v!=null?JSON.parse(v):fallback;}catch{return fallback;} }
function lsSet(key,val)    { try{localStorage.setItem(key,JSON.stringify(val));}catch{} }

/* ─────────────────────────────────────────────────────────
   GEMINI FETCH  — runs entirely client-side, no CORS issues
   Uses gemini-2.5-flash (free tier, supports grounding/search)
───────────────────────────────────────────────────────── */
async function fetchAnalysis(ticker, apiKey) {
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});

  const prompt = `You are a precise equity research assistant. Analyze the stock or ETF with ticker symbol: ${ticker}

Today is ${today}. Use your knowledge of financial markets to provide accurate data. For well-known tickers like AAPL, NVDA, QQQ, SPY, etc., use your training data plus any available grounding. Prefer data from Morningstar, Yahoo Finance, Reuters, Bloomberg.

CRITICAL: Respond ONLY with a single valid JSON object. No markdown code fences, no backticks, no explanation before or after. Start your response with { and end with }.

Required JSON structure (use null for genuinely unknown values, never omit keys):
{
  "ticker": "${ticker}",
  "name": "Full legal company or fund name",
  "type": "stock",
  "sector": "e.g. Technology",
  "country": "Country of headquarters",
  "overview": "2-4 sentences describing what they do, hardware vs software focus, key products/services, and why they matter to investors.",
  "is_etf": false,
  "prospects": {
    "geopolitical": {
      "summary": "2-3 sentences on geopolitical and security risks relevant to this company.",
      "sentiment": "low",
      "counterargument": "A credible opposing view, or null if none.",
      "tag": "qualified_opinion"
    },
    "ai_singularity": {
      "summary": "2-3 sentences on how AI disruption affects this company as risk or opportunity.",
      "sentiment": "positive",
      "counterargument": null,
      "tag": "qualified_opinion"
    },
    "supply_chain": {
      "summary": "2-3 sentences on supply chain vulnerabilities or strengths.",
      "sentiment": "medium",
      "counterargument": null,
      "tag": "data"
    },
    "other": [
      {"label": "Regulatory Risk", "summary": "1-2 sentences on regulatory environment.", "tag": "qualified_opinion"},
      {"label": "Valuation Risk",  "summary": "1-2 sentences on valuation concerns.",    "tag": "qualified_opinion"}
    ]
  },
  "etf_holdings": [],
  "returns": {
    "past_5yr_stock_annualized":    null,
    "past_10yr_stock_annualized":   null,
    "past_5yr_sp500_annualized":    null,
    "past_10yr_sp500_annualized":   null,
    "forward_5yr_stock_consensus":  null,
    "forward_10yr_stock_consensus": null,
    "forward_5yr_sp500_consensus":  null,
    "forward_10yr_sp500_consensus": null,
    "returns_note": "Brief note on data sources and caveats.",
    "tag": "data"
  },
  "current_price":   null,
  "market_cap":      null,
  "pe_ratio":        null,
  "dividend_yield":  null,
  "data_sources":    ["Morningstar", "Yahoo Finance", "Reuters"],
  "last_updated":    "${new Date().toISOString().slice(0,10)}"
}

IMPORTANT RULES:
- If ${ticker} is an ETF, set is_etf to true and populate etf_holdings with up to 10 objects: {"rank":1,"name":"Company Name","ticker":"TICK","weight_pct":12.5}
- If ${ticker} is a stock, etf_holdings must be an empty array []
- For returns: provide realistic annualized % figures as plain numbers (e.g. 18.5 means 18.5% per year). Use null only if truly unknown.
- For sentiment fields: geopolitical/supply_chain use "low"|"medium"|"high"; ai_singularity uses "negative"|"neutral"|"positive"
- For tag fields use exactly: "data", "qualified_opinion", or "not_verified"
- current_price should be a number (e.g. 213.49), market_cap a string (e.g. "$3.2T"), pe_ratio a number, dividend_yield a number (percentage)
- Counterarguments: include a real opposing view where one meaningfully exists, else null
- The response must be valid JSON parseable by JSON.parse()`;


  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Network error — check your connection.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error ${res.status}`;
    if (res.status === 400) throw new Error("Invalid API key or bad request. Check your Gemini API key in Settings.");
    if (res.status === 403) throw new Error("API key rejected — make sure it has Gemini API access enabled in Google AI Studio.");
    if (res.status === 429) throw new Error("Rate limit hit. Wait a moment and try again.");
    throw new Error(msg);
  }

  const json = await res.json();
  let raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Empty response from Gemini. Try again.");

  // Strip any accidental markdown fences
  raw = raw.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,"").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON from within the text
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error("Could not parse Gemini response. Try again — occasionally the model returns malformed JSON.");
  }
}

/* ─────────────────────────────────────────────────────────
   FX RATES
───────────────────────────────────────────────────────── */
const FX_PAIRS = [
  {symbol:"$",  code:"USD"},
  {symbol:"¥",  code:"JPY"},
  {symbol:"£",  code:"GBP"},
  {symbol:"A$", code:"AUD"},
];

function FXPanel({css}) {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    // exchangerate.host — free, no API key needed, CORS-friendly
    fetch("https://api.exchangerate.host/latest?base=KRW&symbols=USD,JPY,GBP,AUD")
      .then(r => r.json())
      .then(d => {
        if (d?.rates) {
          const inv = {};
          Object.entries(d.rates).forEach(([k,v]) => { inv[k] = 1/v; });
          setRates(inv);
        } else {
          // Try fallback API
          return fetch("https://open.er-api.com/v6/latest/KRW")
            .then(r=>r.json())
            .then(d2 => {
              if (d2?.rates) {
                const inv2 = {};
                Object.entries(d2.rates).forEach(([k,v])=>{ inv2[k]=1/v; });
                setRates(inv2);
              } else {
                setRates({USD:1385, JPY:9.3, GBP:1750, AUD:895});
              }
            });
        }
      })
      .catch(() => {
        setRates({USD:1385, JPY:9.3, GBP:1750, AUD:895});
      });
  }, []);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:1}}>
      {FX_PAIRS.map(p => {
        const rate = rates?.[p.code];
        const fmt  = rate ? Math.round(rate).toLocaleString("en-US") : "…";
        return (
          <div key={p.code} style={{display:"flex",justifyContent:"space-between",
            padding:"6px 10px",fontSize:14,color:css.txt,fontVariantNumeric:"tabular-nums"}}>
            <span style={{color:css.sub}}>{p.symbol}</span>
            <span>{p.symbol}1 = <strong>₩{fmt}</strong></span>
          </div>
        );
      })}
      <div style={{fontSize:11,color:css.sub,padding:"2px 10px"}}>Live · exchangerate.host</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CLOCK PANEL
───────────────────────────────────────────────────────── */
function ClockPanel({css}) {
  const [times, setTimes]       = useState({});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const tick = () => {
      const t = {};
      CITIES.forEach(c => { t[c.id] = getNow(c.tz); });
      setTimes(t);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {CITIES.map(city => {
        const now  = times[city.id];
        if (!now) return null;
        const st   = marketStatus(city, now);
        const uph  = upcomingHolidays(city.id, city.tz);
        const open = expanded === city.id;
        return (
          <div key={city.id}>
            <div
              onClick={() => setExpanded(open ? null : city.id)}
              onMouseEnter={e => { if(!open) e.currentTarget.style.background=css.bg; }}
              onMouseLeave={e => { if(!open) e.currentTarget.style.background="transparent"; }}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"8px 10px",borderRadius:4,cursor:"pointer",
                background:open?css.bg:"transparent",transition:"background 0.15s"}}
            >
              <div>
                <div style={{fontSize:15,fontWeight:600,color:css.txt}}>{city.label}</div>
                <div style={{fontSize:12,color:css.sub}}>{fmtDate(now)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:600,fontVariantNumeric:"tabular-nums",color:css.txt}}>
                  {fmtTime(now)}
                </div>
                <div style={{fontSize:11,fontWeight:600,color:st.color}}>{st.label}</div>
              </div>
            </div>
            {open && (
              <div style={{padding:"8px 12px 12px",background:css.bg,borderRadius:4,
                marginBottom:2,fontSize:13,color:css.sub,lineHeight:1.7}}>
                <div style={{fontWeight:700,color:css.txt,marginBottom:6,fontSize:12,
                  textTransform:"uppercase",letterSpacing:"0.07em"}}>{city.exchange}</div>
                {city.preOpen && (
                  <div><span style={{color:T.warn,fontWeight:600}}>Pre-market</span> {city.preOpen}–{city.preClose}</div>
                )}
                <div><span style={{color:T.green,fontWeight:600}}>Open</span> {city.open}–{city.close}</div>
                {city.afterOpen && (
                  <div><span style={{color:T.warn,fontWeight:600}}>After-hours</span> {city.afterOpen}–{city.afterClose}</div>
                )}
                {st.note && (
                  <div style={{marginTop:6,color:T.red,fontWeight:600,fontSize:12}}>⚠ {st.note}</div>
                )}
                {uph.length>0 && (
                  <div style={{marginTop:8,borderTop:`1px solid ${css.border}`,paddingTop:8}}>
                    <div style={{fontWeight:700,fontSize:11,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:4,color:css.txt}}>Coming week</div>
                    {uph.map(h => (
                      <div key={h.date} style={{display:"flex",gap:8,marginBottom:2}}>
                        <span style={{color:T.red,fontWeight:600}}>{h.date.slice(5)}</span>
                        <span>{h.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SHARED UI PRIMITIVES
───────────────────────────────────────────────────────── */
function Btn({children,onClick,primary,pill,disabled,title,style:xs}) {
  const [pressed,setPressed] = useState(false);
  const [hov,setHov]         = useState(false);

  const primaryBg = pressed
    ? "linear-gradient(180deg,#0051C3 0%,#0062E0 60%,#004FB8 100%)"
    : hov
      ? "linear-gradient(180deg,#1A8AFF 0%,#0070F5 55%,#005CE0 100%)"
      : "linear-gradient(180deg,#2196FF 0%,#007AFF 50%,#0063D9 100%)";

  const ghostBg = pressed
    ? "linear-gradient(180deg,#D8D8DE 0%,#E2E2E8 100%)"
    : hov
      ? "linear-gradient(180deg,#F0F0F5 0%,#E5E5EB 100%)"
      : "linear-gradient(180deg,#FAFAFA 0%,#EBEBF0 100%)";

  const primaryShadow = pressed
    ? "inset 0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.18)"
    : "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,100,255,0.32), 0 1px 2px rgba(0,0,0,0.14)";

  const ghostShadow = pressed
    ? "inset 0 1px 3px rgba(0,0,0,0.14)"
    : "inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 3px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.06)";

  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{ setHov(false); setPressed(false); }}
      onMouseDown={()=>setPressed(true)}
      onMouseUp={()=>setPressed(false)}
      style={{
        padding: primary ? "9px 22px" : "9px 14px",
        background: primary ? primaryBg : ghostBg,
        color: primary ? "#fff" : T.text,
        border: primary ? "none" : "1px solid rgba(0,0,0,0.10)",
        borderRadius: pill ? "100px" : 6,
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: primary ? primaryShadow : ghostShadow,
        transform: pressed ? "scale(0.97) translateY(1px)" : "scale(1) translateY(0)",
        transition: "box-shadow 0.15s, transform 0.1s, background 0.15s, opacity 0.15s",
        whiteSpace: "nowrap",
        WebkitFontSmoothing: "antialiased",
        userSelect: "none",
        ...xs
      }}>
      {children}
    </button>
  );
}

function IOSToggle({on,onToggle}) {
  return (
    <button onClick={onToggle}
      style={{width:48,height:28,borderRadius:14,
        background:on?"#34C759":"#D1D1D6",border:"none",cursor:"pointer",
        position:"relative",transition:"background 0.22s",flexShrink:0}}>
      <div style={{position:"absolute",top:2,left:on?22:2,width:24,height:24,
        borderRadius:"50%",background:"#fff",
        boxShadow:"0 1px 3px rgba(0,0,0,0.25)",
        transition:"left 0.22s cubic-bezier(.4,0,.2,1)"}} />
    </button>
  );
}

function SidebarLabel({children,style:xs}) {
  return (
    <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
      letterSpacing:"0.09em",color:T.sub,
      padding:"0 10px",marginBottom:6,...xs}}>
      {children}
    </div>
  );
}

function SidebarBtn({children,onClick,css,active}) {
  const [hov,setHov]=useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"flex",alignItems:"center",gap:8,width:"100%",
        padding:"9px 10px",borderRadius:4,border:"none",cursor:"pointer",
        background:active?T.accentBg:hov?css.bg:"transparent",
        color:active?T.accent:css.txt,
        fontFamily:"inherit",fontSize:15,textAlign:"left",
        transition:"background 0.15s,color 0.15s",marginBottom:2}}>
      {children}
    </button>
  );
}

function Card({children,css,style:xs}) {
  return (
    <div style={{background:css.surf,border:`1px solid ${css.border}`,
      borderRadius:4,padding:"24px 26px",boxShadow:T.shadow,
      transition:"background 0.25s,border-color 0.25s",...xs}}>
      {children}
    </div>
  );
}

function CardTitle({children}) {
  return <div style={{fontSize:17,fontWeight:700,marginBottom:16,letterSpacing:"-0.2px"}}>{children}</div>;
}

function Pill({children,color,bg}) {
  return (
    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:100,
      fontSize:12,fontWeight:700,letterSpacing:"0.04em",color,background:bg}}>
      {children}
    </span>
  );
}

function Tag({type}) {
  const map = {
    qualified_opinion:{label:"qualified opinion",color:T.warn,  bg:T.warnBg},
    not_verified:     {label:"not verified",      color:T.sub,   bg:"#EBEBF0"},
    counterargument:  {label:"counterargument",   color:T.red,   bg:T.redBg},
    data:             {label:"data",              color:T.accent,bg:T.accentBg},
  };
  const t = map[type]||map.data;
  return (
    <span style={{display:"inline-block",padding:"2px 8px",borderRadius:3,
      fontSize:11,fontWeight:700,color:t.color,background:t.bg}}>
      {t.label}
    </span>
  );
}

function Spinner({css,label}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      paddingTop:80,gap:14,color:css.sub,fontSize:16}}>
      <div style={{width:24,height:24,border:`3px solid ${css.border}`,
        borderTopColor:T.accent,borderRadius:"50%",
        animation:"spin 0.75s linear infinite"}} />
      {label}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}
</style>
    </div>
  );
}

function ErrorCard({msg,css}) {
  return (
    <div style={{background:"#FFF0EF",border:"1px solid #FFD0CC",borderRadius:4,
      padding:"18px 22px",color:T.red,fontSize:16,lineHeight:1.55,boxShadow:T.shadow}}>
      <strong>Error:</strong> {msg}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   API KEY SETUP MODAL
───────────────────────────────────────────────────────── */
function ApiKeyModal({onSave,css}) {
  const [key,setKey] = useState("");
  const [err,setErr] = useState("");

  const save = () => {
    const k = key.trim();
    
    // Check for either the legacy format (AI...) or the new format (AQ...)
    const isValidLegacy = k.startsWith("AI") && k.length >= 20;
    const isValidNew = k.startsWith("AQ") && k.includes(".");

    if (!isValidLegacy && !isValidNew) {
      setErr("Invalid key format. Gemini keys should start with 'AI' or 'AQ'. Check and try again.");
      return;
    }
    
    onSave(k);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20,
      background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)"}}>
      <div style={{background:css.surf,borderRadius:8,width:"100%",maxWidth:440,
        padding:"32px 28px",boxShadow:T.shadowLg}}>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>
          eq<span style={{color:T.accent}}>.</span>
        </div>
        <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:css.txt}}>
          Enter your Gemini API Key
        </div>
        <div style={{fontSize:14,color:css.sub,lineHeight:1.6,marginBottom:20}}>
          This app runs entirely in your browser. Your key is stored only in <em>localStorage</em> on this device and never sent anywhere except Google's API.
          <br/><br/>
          Get a free key at{" "}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            style={{color:T.accent}}>aistudio.google.com</a> — no billing required for the free tier.
        </div>
        <input
          value={key}
          onChange={e=>{ setKey(e.target.value); setErr(""); }}
          onKeyDown={e=>e.key==="Enter"&&save()}
          placeholder="AIza…"
          type="password"
          style={{width:"100%",border:`1.5px solid ${err?T.red:css.border}`,borderRadius:4,
            padding:"10px 14px",fontFamily:"inherit",fontSize:16,
            background:css.bg,color:css.txt,outline:"none",
            boxSizing:"border-box",marginBottom:err?8:16}}
        />
        {err && <div style={{fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
        <button onClick={save}
          style={{width:"100%",padding:"11px 0",
            background:"linear-gradient(180deg,#2196FF 0%,#007AFF 50%,#0063D9 100%)",
            color:"#fff",border:"none",borderRadius:100,fontFamily:"inherit",fontSize:16,
            fontWeight:600,cursor:"pointer",
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 8px rgba(0,100,255,0.35), 0 1px 2px rgba(0,0,0,0.14)",
            WebkitFontSmoothing:"antialiased"}}>
          Save & Continue
        </button>
        <div style={{fontSize:11,color:css.sub,marginTop:14,textAlign:"center"}}>
          You can update or remove your key anytime via the Settings panel.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────── */
function Sidebar({css,open,onClose,dark,onToggleDark,bookmarks,onLoadBookmark,
  onRemoveBookmark,basket,onRemoveFromBasket,onRunCompare,onOpenCalc,
  onClear,compareMode,onToggleCompareMode,onOpenSettings}) {
  const {txt,sub,border} = css;
  return (
    <aside style={{width:270,minHeight:"100vh",
      background:css.surf,borderRight:`1px solid ${border}`,
      position:"fixed",top:0,left:0,bottom:0,zIndex:100,
      display:"flex",flexDirection:"column",
      padding:"24px 16px 32px",overflowY:"auto",
      transform:open?"translateX(0)":"translateX(-100%)",
      boxShadow:open?T.shadowLg:T.shadow,
      transition:"transform 0.28s cubic-bezier(.4,0,.2,1),background 0.25s,border-color 0.25s"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div style={{fontSize:20,fontWeight:700,letterSpacing:"-0.4px",color:txt}}>
          eq<span style={{color:T.accent}}>.</span>
        </div>
        <button onClick={onClose}
          style={{background:"none",border:"none",cursor:"pointer",
            fontSize:20,color:sub,padding:"2px 6px",lineHeight:1}}>
          ✕
        </button>
      </div>

      {/* Clocks */}
      <SidebarLabel>Markets</SidebarLabel>
      <ClockPanel css={css} />

      {/* FX */}
      <SidebarLabel style={{marginTop:20}}>Exchange Rates → ₩</SidebarLabel>
      <FXPanel css={css} />

      {/* Tools */}
      <SidebarLabel style={{marginTop:20}}>Tools</SidebarLabel>
      <SidebarBtn onClick={onOpenCalc}           css={css}>🧮  Calculator</SidebarBtn>
      <SidebarBtn onClick={onToggleCompareMode}  css={css} active={compareMode}>
        ⚖️  Compare Mode{compareMode?" (on)":""}
      </SidebarBtn>
      <SidebarBtn onClick={onClear}              css={css}>↩  Clear</SidebarBtn>
      <SidebarBtn onClick={onOpenSettings}       css={css}>⚙️  API Key Settings</SidebarBtn>

      {/* Night mode */}
      <SidebarLabel style={{marginTop:20}}>Display</SidebarLabel>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"8px 10px",fontSize:15,color:txt}}>
        <span>Night Mode</span>
        <IOSToggle on={dark} onToggle={onToggleDark} />
      </div>

      {/* Bookmarks */}
      <SidebarLabel style={{marginTop:20}}>Bookmarks</SidebarLabel>
      {bookmarks.length===0
        ? <div style={{fontSize:14,color:sub,padding:"6px 10px"}}>None yet</div>
        : bookmarks.map(t=>(
          <div key={t} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"7px 10px",borderRadius:4,cursor:"pointer",fontSize:15,color:txt,
            transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=css.bg}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span onClick={()=>onLoadBookmark(t)} style={{fontWeight:600}}>{t}</span>
            <button onClick={()=>onRemoveBookmark(t)}
              style={{background:"none",border:"none",cursor:"pointer",color:sub,fontSize:13}}>✕</button>
          </div>
        ))
      }

      {/* Compare basket */}
      <SidebarLabel style={{marginTop:20}}>
        Compare Basket {basket.length>0&&<span style={{color:T.accent}}>({basket.length}/3)</span>}
      </SidebarLabel>
      {basket.length===0
        ? <div style={{fontSize:14,color:sub,padding:"6px 10px"}}>Add up to 3 tickers</div>
        : basket.map(t=>(
          <div key={t} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"6px 10px",background:css.bg,borderRadius:4,marginBottom:4,fontSize:14}}>
            <span style={{fontWeight:700}}>{t}</span>
            <button onClick={()=>onRemoveFromBasket(t)}
              style={{background:"none",border:"none",cursor:"pointer",color:sub,fontSize:13}}>✕</button>
          </div>
        ))
      }
      {basket.length>=2 && (
        <button onClick={onRunCompare}
          style={{marginTop:8,width:"100%",padding:"9px 0",
            background:"linear-gradient(180deg,#2196FF 0%,#007AFF 50%,#0063D9 100%)",
            color:"#fff",border:"none",borderRadius:6,fontFamily:"inherit",
            fontSize:15,fontWeight:600,cursor:"pointer",
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,100,255,0.30), 0 1px 2px rgba(0,0,0,0.12)",
            WebkitFontSmoothing:"antialiased"}}>
          Run Comparison
        </button>
      )}
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────────────────── */
function TopBar({css,ticker,setTicker,onLookup,onMenuClick,onBookmark,onAddCompare,
  showCompareBtn,loading}) {
  const {surf,border,txt} = css;
  return (
    <header style={{position:"sticky",top:0,zIndex:50,
      background:surf,borderBottom:`1px solid ${border}`,
      padding:"12px 20px",display:"flex",alignItems:"center",gap:14,
      transition:"background 0.25s,border-color 0.25s",
      boxShadow:"0 1px 0 rgba(0,0,0,0.04)"}}>

      {/* Logo — always visible, opens sidebar */}
      <button onClick={onMenuClick}
        style={{background:"none",border:"none",cursor:"pointer",
          fontSize:20,fontWeight:700,letterSpacing:"-0.4px",color:txt,
          padding:"4px 2px",fontFamily:"inherit",flexShrink:0,lineHeight:1}}>
        eq<span style={{color:T.accent}}>.</span>
      </button>

      {/* Search */}
      <div style={{flex:1, display:"flex", gap:8}}>
        <input
          value={ticker}
          onChange={e=>setTicker(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&onLookup()}
          placeholder="Ticker — AAPL, NVDA, QQQ…"
          style={{flex:1,border:`1.5px solid ${border}`,borderRadius:4,
            padding:"9px 14px",fontFamily:"inherit",fontSize:17,
            background:css.bg,color:txt,outline:"none",
            transition:"border-color 0.15s,background 0.25s",
            boxShadow:"inset 0 1px 2px rgba(0,0,0,0.04)"}}
          onFocus={e=>e.target.style.borderColor=T.accent}
          onBlur={e=>e.target.style.borderColor=border}
        />
        <Btn onClick={onLookup} disabled={loading} primary pill>
          {loading?"…":"Search"}
        </Btn>
      </div>
      <Btn onClick={onBookmark} title="Bookmark">🔖</Btn>
      {showCompareBtn && <Btn onClick={onAddCompare} title="Add to compare">+⚖️</Btn>}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────
   RESULT CARDS
───────────────────────────────────────────────────────── */
function ResultView({data:d,css}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <HeaderCard    d={d} css={css} />
      <OverviewCard  d={d} css={css} />
      <ProspectsCard d={d} css={css} />
      {d.is_etf && d.etf_holdings?.length>0 && <HoldingsCard d={d} css={css} />}
      <ReturnsCard   d={d} css={css} />
      <MetaCard      d={d} css={css} />
    </div>
  );
}

function HeaderCard({d,css}) {
  const price = d.current_price
    ? "$"+Number(d.current_price).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
    : null;
  return (
    <Card css={css}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:38,fontWeight:700,letterSpacing:"-1px"}}>{d.ticker}</span>
            <Pill color={d.is_etf?T.warn:T.accent} bg={d.is_etf?T.warnBg:T.accentBg}>
              {d.is_etf?"ETF":"Stock"}
            </Pill>
            {d.sector && <Pill color={T.green} bg={T.greenBg}>{d.sector}</Pill>}
          </div>
          <div style={{fontSize:16,color:css.sub,marginTop:4}}>
            {d.name}{d.country?` · ${d.country}`:""}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          {price && <div style={{fontSize:30,fontWeight:700,letterSpacing:"-0.5px"}}>{price}</div>}
          <div style={{fontSize:14,color:css.sub,marginTop:2}}>
            {[d.market_cap,d.pe_ratio?`P/E ${d.pe_ratio}`:null,
              d.dividend_yield?`Yield ${d.dividend_yield}%`:null].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
    </Card>
  );
}

function OverviewCard({d,css}) {
  return (
    <Card css={css}>
      <CardTitle>Overview</CardTitle>
      <div style={{fontSize:17,lineHeight:1.65,color:css.txt}}>{d.overview}</div>
    </Card>
  );
}

function ProspectsCard({d,css}) {
  const p = d.prospects||{};
  const sentColor = s => ({
    low:T.green, medium:T.warn, high:T.red,
    positive:T.green, neutral:css.sub, negative:T.red
  })[s]||css.sub;

  function RiskCell({label,obj}) {
    if (!obj) return null;
    return (
      <div style={{background:css.bg,borderRadius:4,padding:"14px 16px",transition:"background 0.25s"}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
          letterSpacing:"0.08em",color:css.sub,marginBottom:8,
          display:"flex",alignItems:"center",gap:6}}>
          {obj.sentiment && (
            <span style={{width:7,height:7,borderRadius:"50%",
              background:sentColor(obj.sentiment),display:"inline-block",flexShrink:0}}/>
          )}
          {label}
        </div>
        <div style={{fontSize:15,lineHeight:1.55,color:css.txt}}>{obj.summary}</div>
        <div style={{marginTop:8}}><Tag type={obj.tag}/></div>
        {obj.counterargument && (
          <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${css.border}`}}>
            <Tag type="counterargument"/>
            <div style={{fontSize:13,color:css.sub,marginTop:4}}>{obj.counterargument}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card css={css}>
      <CardTitle>Prospects & Risk Factors</CardTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
        <RiskCell label="Geopolitical Risk" obj={p.geopolitical}/>
        <RiskCell label="AI & Disruption"   obj={p.ai_singularity}/>
        <RiskCell label="Supply Chain"      obj={p.supply_chain}/>
        {(p.other||[]).map((o,i)=>(
          <div key={i} style={{background:css.bg,borderRadius:4,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.08em",color:css.sub,marginBottom:8}}>{o.label}</div>
            <div style={{fontSize:15,lineHeight:1.55,color:css.txt}}>{o.summary}</div>
            <div style={{marginTop:8}}><Tag type={o.tag}/></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HoldingsCard({d,css}) {
  return (
    <Card css={css}>
      <CardTitle>Top 10 Holdings</CardTitle>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:15}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${css.border}`}}>
            {["#","Company","Ticker","Weight"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"6px 10px",fontSize:11,
                fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:css.sub}}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(d.etf_holdings||[]).slice(0,10).map((h,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${css.border}`}}>
              <td style={{padding:"10px",color:css.sub,fontSize:13}}>{i+1}</td>
              <td style={{padding:"10px",fontWeight:600}}>{h.name}</td>
              <td style={{padding:"10px",color:css.sub}}>{h.ticker}</td>
              <td style={{padding:"10px",color:T.accent,fontWeight:700}}>
                {h.weight_pct!=null?h.weight_pct.toFixed(2)+"%":"—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{fontSize:12,color:css.sub,marginTop:12,paddingTop:10,
        borderTop:`1px solid ${css.border}`}}>
        Source: Fund prospectus / provider data. Holdings subject to change.
      </div>
    </Card>
  );
}

function ReturnsCard({d,css}) {
  const r = d.returns||{};
  const rows = [
    {label:"5-Year Historical (ann.)",  stock:r.past_5yr_stock_annualized,   sp:r.past_5yr_sp500_annualized,   note:null},
    {label:"10-Year Historical (ann.)", stock:r.past_10yr_stock_annualized,  sp:r.past_10yr_sp500_annualized,  note:null},
    {label:"5-Year Forward Estimate",   stock:r.forward_5yr_stock_consensus, sp:r.forward_5yr_sp500_consensus, note:"Analyst consensus — speculative"},
    {label:"10-Year Forward Estimate",  stock:r.forward_10yr_stock_consensus,sp:r.forward_10yr_sp500_consensus,note:"Long-range — highly speculative"},
  ];
  return (
    <Card css={css}>
      <CardTitle>Returns vs S&P 500</CardTitle>
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        {rows.map(row=>{
          const max  = Math.max(Math.abs(row.stock||0),Math.abs(row.sp||0),1);
          const sPct = row.stock!=null?Math.abs(row.stock)/max*100:0;
          const pPct = row.sp!=null?Math.abs(row.sp)/max*100:0;
          return (
            <div key={row.label}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:8,color:css.txt}}>{row.label}</div>
              {[
                {label:d.ticker,val:row.stock,pct:sPct,color:T.accent},
                {label:"S&P 500",val:row.sp,  pct:pPct, color:css.sub},
              ].map(br=>(
                <div key={br.label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:80,fontSize:13,color:css.sub,flexShrink:0}}>{br.label}</div>
                  <div style={{flex:1,height:7,background:css.bg,borderRadius:100,overflow:"hidden"}}>
                    <div style={{width:`${br.pct}%`,height:"100%",background:br.color,
                      borderRadius:100,transition:"width 0.5s cubic-bezier(.4,0,.2,1)"}}/>
                  </div>
                  <div style={{width:72,fontSize:13,fontWeight:700,textAlign:"right",flexShrink:0,
                    color:br.val!=null?(br.val>=0?T.green:T.red):css.sub}}>
                    {fmtPct(br.val)}
                  </div>
                </div>
              ))}
              {row.note&&<div style={{fontSize:12,color:css.sub,marginTop:4}}>{row.note}</div>}
            </div>
          );
        })}
      </div>
      {r.returns_note&&(
        <div style={{fontSize:12,color:css.sub,marginTop:14,paddingTop:12,
          borderTop:`1px solid ${css.border}`}}>{r.returns_note}</div>
      )}
    </Card>
  );
}

function MetaCard({d,css}) {
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:12,color:css.sub}}>
      <span>Sources: {(d.data_sources||[]).join(", ")}</span>
      <span>·</span><span>Updated: {d.last_updated||"today"}</span>
      <span>·</span><span>Not financial advice.</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   COMPARE VIEW
───────────────────────────────────────────────────────── */
function CompareView({results,css}) {
  const cols = results.length;
  return (
    <div>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Comparison</div>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:16}}>
        {results.map(d=>(
          <Card key={d.ticker} css={css} style={{padding:"18px 20px"}}>
            <div style={{fontSize:24,fontWeight:700}}>{d.ticker}</div>
            <div style={{fontSize:13,color:css.sub,marginBottom:12}}>{d.name}</div>
            {[
              {title:"Overview",body:<div style={{fontSize:14,lineHeight:1.6,color:css.txt}}>{d.overview}</div>},
              {title:"Geopolitical",body:<><div style={{fontSize:14,color:css.txt,marginBottom:4}}>{d.prospects?.geopolitical?.summary}</div><Tag type={d.prospects?.geopolitical?.tag}/></>},
              {title:"AI Risk / Opp.",body:<div style={{fontSize:14,color:css.txt}}>{d.prospects?.ai_singularity?.summary}</div>},
              {title:"5yr Return (ann.)",body:<><span style={{fontWeight:700,color:T.accent}}>{fmtPct(d.returns?.past_5yr_stock_annualized)}</span><span style={{color:css.sub,fontSize:13}}> vs S&P {fmtPct(d.returns?.past_5yr_sp500_annualized)}</span></>},
              {title:"10yr Return (ann.)",body:<><span style={{fontWeight:700,color:T.accent}}>{fmtPct(d.returns?.past_10yr_stock_annualized)}</span><span style={{color:css.sub,fontSize:13}}> vs S&P {fmtPct(d.returns?.past_10yr_sp500_annualized)}</span></>},
            ].map(s=>(
              <div key={s.title} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                  letterSpacing:"0.08em",color:css.sub,marginBottom:5}}>{s.title}</div>
                {s.body}
              </div>
            ))}
            {d.is_etf&&d.etf_holdings?.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",
                  letterSpacing:"0.08em",color:css.sub,marginBottom:5}}>Top 3 Holdings</div>
                {d.etf_holdings.slice(0,3).map((h,i)=>(
                  <div key={i} style={{fontSize:13,color:css.txt,marginBottom:2}}>
                    {h.name} <span style={{color:T.accent,fontWeight:700}}>{h.weight_pct?.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CALCULATOR MODAL
───────────────────────────────────────────────────────── */
function CalcModal({onClose,css,currentTicker}) {
  const [ticker,   setTicker]   = useState(currentTicker||"");
  const [monthly,  setMonthly]  = useState("");
  const [months,   setMonths]   = useState("");
  const [rateMode, setRateMode] = useState("moderate");
  const [custom,   setCustom]   = useState("");
  const [result,   setResult]   = useState(null);

  const RATES = {conservative:0.07, moderate:0.12, optimistic:0.20};

  const calc = () => {
    const m  = parseFloat(monthly);
    const mo = parseInt(months);
    if (isNaN(m)||isNaN(mo)||m<=0||mo<=0) return;
    const ann = rateMode==="custom"?parseFloat(custom)/100:RATES[rateMode];
    if (isNaN(ann)) return;
    const mr = ann/12;
    let fv = 0;
    for (let i=0;i<mo;i++) fv=(fv+m)*(1+mr);
    const contributed = m*mo;
    const gain = fv-contributed;
    setResult({fv,contributed,gain,gainPct:(gain/contributed*100).toFixed(1),ann,mo});
  };

  const iStyle = {width:"100%",border:`1.5px solid ${css.border}`,borderRadius:4,
    padding:"9px 12px",fontFamily:"inherit",fontSize:16,
    background:css.bg,color:css.txt,outline:"none",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
      alignItems:"flex-end",justifyContent:"center",padding:20}}>
      <div onClick={onClose}
        style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(3px)"}}/>
      <div style={{position:"relative",background:css.surf,borderRadius:"8px 8px 4px 4px",
        width:"100%",maxWidth:480,padding:"28px 28px 36px",
        boxShadow:"0 -4px 32px rgba(0,0,0,0.14)",
        animation:"slideUp 0.28s cubic-bezier(.4,0,.2,1)",zIndex:1}}>
        <style>{`@keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <button onClick={onClose}
          style={{position:"absolute",top:16,right:18,background:css.bg,
            border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",
            color:css.sub,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
          ✕
        </button>
        <div style={{fontSize:20,fontWeight:700,marginBottom:22}}>Investment Calculator</div>

        {[
          {label:"Stock / ETF ticker",    el:<input value={ticker}  onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder="e.g. NVDA" style={iStyle}/>},
          {label:"Monthly investment ($)", el:<input type="number" value={monthly}  onChange={e=>setMonthly(e.target.value)}  placeholder="e.g. 200" min="1" style={iStyle}/>},
          {label:"Duration (months)",      el:<input type="number" value={months}   onChange={e=>setMonths(e.target.value)}   placeholder="e.g. 24"  min="1" style={iStyle}/>},
          {label:"Expected annual return", el:(
            <select value={rateMode} onChange={e=>setRateMode(e.target.value)} style={iStyle}>
              <option value="conservative">Conservative — ~7% (S&P historical avg)</option>
              <option value="moderate">Moderate — ~12% (growth stock avg)</option>
              <option value="optimistic">Optimistic — ~20% (strong performer)</option>
              <option value="custom">Custom…</option>
            </select>
          )},
        ].map(({label,el})=>(
          <div key={label} style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:14,fontWeight:600,color:css.sub,marginBottom:6}}>{label}</label>
            {el}
          </div>
        ))}

        {rateMode==="custom"&&(
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:14,fontWeight:600,color:css.sub,marginBottom:6}}>Custom annual return (%)</label>
            <input type="number" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="e.g. 15" style={iStyle}/>
          </div>
        )}

        <button onClick={calc}
          style={{width:"100%",padding:"11px 0",
            background:"linear-gradient(180deg,#2196FF 0%,#007AFF 50%,#0063D9 100%)",
            color:"#fff",border:"none",borderRadius:6,fontFamily:"inherit",fontSize:16,fontWeight:600,cursor:"pointer",
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,100,255,0.32), 0 1px 2px rgba(0,0,0,0.14)",
            WebkitFontSmoothing:"antialiased"}}>
          Calculate
        </button>

        {result&&(
          <div style={{marginTop:18,background:css.bg,borderRadius:4,padding:"18px 20px",fontSize:15,lineHeight:1.7}}>
            <div style={{fontSize:32,fontWeight:700,color:T.accent,marginBottom:8}}>{fmtUSD(result.fv)}</div>
            <div><strong>Total invested:</strong> {fmtUSD(result.contributed)}</div>
            <div><strong>Estimated gain:</strong> {fmtUSD(result.gain)} (+{result.gainPct}%)</div>
            <div><strong>Duration:</strong> {result.mo} months ({(result.mo/12).toFixed(1)} yrs)</div>
            <div><strong>Annual return assumed:</strong> {(result.ann*100).toFixed(1)}%</div>
            <div style={{fontSize:12,color:css.sub,marginTop:10,lineHeight:1.5}}>
              ⚠ Assumes constant monthly buys at a fixed return rate. Real returns vary significantly.
            </div>
          </div>
        )}
        <div style={{fontSize:12,color:css.sub,marginTop:14,borderTop:`1px solid ${css.border}`,paddingTop:12}}>
          Not financial advice. Past performance does not guarantee future results.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────────────────────── */
function SettingsModal({onClose,onSave,css}) {
  const [key,setKey]   = useState(()=>ls("eq_gemini_key",""));
  const [saved,setSaved] = useState(false);

  const save = () => {
    lsSet("eq_gemini_key",key.trim());
    setSaved(true);
    setTimeout(()=>{setSaved(false); onSave(key.trim()); onClose();},900);
  };
  const clear = () => { lsSet("eq_gemini_key",""); setKey(""); };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20,
      background:"rgba(0,0,0,0.35)",backdropFilter:"blur(3px)"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0}}/>
      <div style={{position:"relative",background:css.surf,borderRadius:8,
        width:"100%",maxWidth:420,padding:"28px",boxShadow:T.shadowLg,zIndex:1}}>
        <button onClick={onClose}
          style={{position:"absolute",top:16,right:18,background:css.bg,
            border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",
            color:css.sub,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>API Key Settings</div>
        <div style={{fontSize:14,color:css.sub,lineHeight:1.6,marginBottom:16}}>
          Get a free Gemini key at{" "}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            style={{color:T.accent}}>aistudio.google.com</a>.
          Stored only in your browser's localStorage.
        </div>
        <input value={key} onChange={e=>setKey(e.target.value)} type="password"
          placeholder="AIza…"
          style={{width:"100%",border:`1.5px solid ${css.border}`,borderRadius:4,
            padding:"9px 12px",fontFamily:"inherit",fontSize:15,
            background:css.bg,color:css.txt,outline:"none",
            boxSizing:"border-box",marginBottom:12}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={save}
            style={{flex:1,padding:"10px 0",
              background:saved
                ? "linear-gradient(180deg,#3DD668 0%,#34C759 50%,#28A745 100%)"
                : "linear-gradient(180deg,#2196FF 0%,#007AFF 50%,#0063D9 100%)",
              color:"#fff",border:"none",borderRadius:6,fontFamily:"inherit",fontSize:15,fontWeight:600,cursor:"pointer",
              boxShadow:"inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,100,255,0.28), 0 1px 2px rgba(0,0,0,0.12)",
              transition:"background 0.2s, box-shadow 0.15s",
              WebkitFontSmoothing:"antialiased"}}>
            {saved?"Saved ✓":"Save"}
          </button>
          <button onClick={clear}
            style={{padding:"10px 16px",background:css.bg,color:T.red,
              border:`1px solid ${css.border}`,borderRadius:4,fontFamily:"inherit",
              fontSize:15,fontWeight:600,cursor:"pointer"}}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────── */
function EmptyState({css}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",paddingTop:100,gap:14,color:css.sub}}>
      <div style={{fontSize:52}}>📈</div>
      <div style={{fontSize:22,fontWeight:600,color:css.txt}}>Start researching</div>
      <div style={{fontSize:16,maxWidth:340,textAlign:"center",lineHeight:1.55}}>
        Enter any stock ticker or ETF symbol to get a full analysis —
        prospects, risks, holdings, and return comparison.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────────────────── */
export default function App() {
  const [dark,          setDark]          = useState(()=>ls("eq_dark",false));
  const [apiKey,        setApiKey]        = useState(()=>ls("eq_gemini_key",""));
  const [showKeyModal,  setShowKeyModal]  = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [ticker,        setTicker]        = useState("");
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);
  const [bookmarks,     setBookmarks]     = useState(()=>ls("eq_bm",[]));
  const [basket,        setBasket]        = useState([]);
  const [compareMode,   setCompareMode]   = useState(false);
  const [compareResults,setCompareResults]= useState(null);
  const [compareLoading,setCompareLoading]= useState(false);
  const [calcOpen,      setCalcOpen]      = useState(false);
  const [view,          setView]          = useState("empty");

  // Theme
  const bg   = dark ? D.bg   : T.bg;
  const surf = dark ? D.surf : T.surf;
  const bord = dark ? D.border : T.border;
  const txt  = dark ? D.text : T.text;
  const sub  = dark ? D.sub  : T.sub;
  const css  = {bg,surf,border:bord,txt,sub,dark};

  useEffect(()=>{
    document.body.style.margin="0";
    document.body.style.fontFamily='-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif';
    document.body.style.background=bg;
    document.body.style.color=txt;
    document.body.style.transition="background 0.25s,color 0.25s";
    document.body.style.fontSize="17px";
  },[bg,txt]);

  // Show key modal if no key
  useEffect(()=>{
    if (!apiKey) setShowKeyModal(true);
  },[]);

  const toggleDark = () => {
    setDark(d=>{ const n=!d; lsSet("eq_dark",n); return n; });
  };

  const saveBookmarks = bm => {
    setBookmarks(bm); lsSet("eq_bm",bm);
  };

  const lookup = useCallback(async (sym) => {
    const t = (sym||ticker).trim().toUpperCase();
    if (!t) return;
    const key = ls("eq_gemini_key","");
    if (!key) { setShowKeyModal(true); return; }
    setView("result"); setLoading(true); setResult(null); setError(null); setSidebarOpen(false);
    try {
      const data = await fetchAnalysis(t, key);
      setResult(data);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  },[ticker]);

  const runCompare = useCallback(async()=>{
    if (basket.length<2) return;
    const key = ls("eq_gemini_key","");
    if (!key) { setShowKeyModal(true); return; }
    setView("compare"); setCompareLoading(true); setCompareResults(null); setSidebarOpen(false);
    try {
      const all = await Promise.all(basket.map(t=>fetchAnalysis(t,key)));
      setCompareResults(all);
    } catch(e) {
      setError(e.message);
    } finally {
      setCompareLoading(false);
    }
  },[basket]);

  const addBookmark  = () => { if(!result) return; const t=result.ticker; if(!bookmarks.includes(t)) saveBookmarks([...bookmarks,t]); };
  const addToBasket  = () => { if(!result) return; const t=result.ticker; if(!basket.includes(t)&&basket.length<3) setBasket([...basket,t]); };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:bg,color:txt,
      transition:"background 0.25s,color 0.25s"}}>

      {/* API Key first-run modal */}
      {showKeyModal && (
        <ApiKeyModal css={css} onSave={k=>{
          setApiKey(k); lsSet("eq_gemini_key",k); setShowKeyModal(false);
        }}/>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal css={css}
          onClose={()=>setShowSettings(false)}
          onSave={k=>{ setApiKey(k); }}/>
      )}

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div onClick={()=>setSidebarOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.28)",
            zIndex:90,backdropFilter:"blur(2px)"}}/>
      )}

      {/* Sidebar */}
      <Sidebar
        css={css} open={sidebarOpen} onClose={()=>setSidebarOpen(false)}
        dark={dark} onToggleDark={toggleDark}
        bookmarks={bookmarks}
        onLoadBookmark={t=>{setTicker(t); lookup(t);}}
        onRemoveBookmark={t=>saveBookmarks(bookmarks.filter(b=>b!==t))}
        basket={basket}
        onRemoveFromBasket={t=>setBasket(basket.filter(b=>b!==t))}
        onRunCompare={runCompare}
        onOpenCalc={()=>{ setCalcOpen(true); setSidebarOpen(false); }}
        onClear={()=>{ setView("empty"); setResult(null); setError(null); }}
        compareMode={compareMode}
        onToggleCompareMode={()=>setCompareMode(c=>!c)}
        onOpenSettings={()=>{ setShowSettings(true); setSidebarOpen(false); }}
      />

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <TopBar
          css={css} ticker={ticker} setTicker={setTicker}
          onLookup={()=>lookup()} onMenuClick={()=>setSidebarOpen(true)}
          onBookmark={addBookmark}
          onAddCompare={addToBasket}
          showCompareBtn={compareMode&&!!result}
          loading={loading}
        />

        <div style={{flex:1, padding:"28px 20px 64px", width:"100%", boxSizing:"border-box"}}
          {view==="empty"   && <EmptyState css={css}/>}
          {view==="result"  && (
            loading   ? <Spinner css={css} label={`Researching ${ticker}…`}/>
            : error   ? <ErrorCard msg={error} css={css}/>
            : result  && <ResultView data={result} css={css}/>
          )}
          {view==="compare" && (
            compareLoading   ? <Spinner css={css} label={`Fetching ${basket.join(", ")}…`}/>
            : error          ? <ErrorCard msg={error} css={css}/>
            : compareResults && <CompareView results={compareResults} css={css}/>
          )}
        </div>
      </div>

      {calcOpen && <CalcModal onClose={()=>setCalcOpen(false)} css={css} currentTicker={result?.ticker}/>}
    </div>
  );
}


import ReactDOM from 'react-dom/client';

// This grabs your App component and forces it onto the screen
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
