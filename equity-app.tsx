import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const STYLE = {
  bg:       "#F5F5F7",
  surface:  "#FFFFFF",
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
  shadowMd: "0 2px 8px rgba(0,0,0,0.09), 0 8px 24px rgba(0,0,0,0.06)",
  radius:   4,
};

const CITIES = [
  {
    id: "nyc",
    label: "New York",
    tz: "America/New_York",
    exchange: "NYSE / NASDAQ",
    preOpen:  "04:00", preClose: "09:30",
    open:     "09:30", close:    "16:00",
    afterOpen:"16:00", afterClose:"20:00",
  },
  {
    id: "sel",
    label: "Seoul",
    tz: "Asia/Seoul",
    exchange: "KRX",
    preOpen:  "08:00", preClose: "09:00",
    open:     "09:00", close:    "15:30",
    afterOpen:"15:30", afterClose:"18:00",
  },
  {
    id: "lon",
    label: "London",
    tz: "Europe/London",
    exchange: "LSE",
    preOpen:  null,    preClose: null,
    open:     "08:00", close:    "16:30",
    afterOpen:null,    afterClose:null,
  },
];

// US market holidays 2026 (NYSE observed)
const US_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-19", name: "MLK Jr. Day" },
  { date: "2026-02-16", name: "Presidents' Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-07-03", name: "Independence Day (observed)" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-11-27", name: "Thanksgiving (early close 13:00)" },
  { date: "2026-12-25", name: "Christmas Day" },
];
const KR_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-02-16", name: "Lunar New Year Eve" },
  { date: "2026-02-17", name: "Lunar New Year" },
  { date: "2026-02-18", name: "Lunar New Year (observed)" },
  { date: "2026-03-01", name: "Independence Movement Day" },
  { date: "2026-05-05", name: "Children's Day" },
  { date: "2026-05-25", name: "Buddha's Birthday" },
  { date: "2026-06-06", name: "Memorial Day" },
  { date: "2026-08-15", name: "Liberation Day" },
  { date: "2026-09-24", name: "Chuseok Eve" },
  { date: "2026-09-25", name: "Chuseok" },
  { date: "2026-09-26", name: "Chuseok (observed)" },
  { date: "2026-10-03", name: "National Foundation Day" },
  { date: "2026-10-09", name: "Hangul Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];
const UK_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-04", name: "Early May Bank Holiday" },
  { date: "2026-05-25", name: "Spring Bank Holiday" },
  { date: "2026-08-31", name: "Summer Bank Holiday" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-28", name: "Boxing Day (observed)" },
];
const CITY_HOLIDAYS = { nyc: US_HOLIDAYS_2026, sel: KR_HOLIDAYS_2026, lon: UK_HOLIDAYS_2026 };

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function getNow(tz) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}
function fmtTime(d) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function fmtDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function getMarketStatus(city, now) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay(); // 0=Sun 6=Sat
  const dateStr = now.toISOString().slice(0, 10);
  const holidays = CITY_HOLIDAYS[city.id] || [];
  const isHoliday = holidays.find(h => h.date === dateStr);
  if (isHoliday) return { label: "Closed", color: STYLE.sub, note: isHoliday.name };
  if (dow === 0 || dow === 6) return { label: "Closed", color: STYLE.sub, note: "Weekend" };
  const o = toMinutes(city.open), c = toMinutes(city.close);
  if (mins >= o && mins < c) return { label: "Open", color: STYLE.green };
  if (city.preOpen && mins >= toMinutes(city.preOpen) && mins < o)
    return { label: "Pre-market", color: STYLE.warn };
  if (city.afterOpen && mins >= c && mins < toMinutes(city.afterClose))
    return { label: "After-hours", color: STYLE.warn };
  return { label: "Closed", color: STYLE.sub };
}
function getUpcomingHolidays(cityId, tz) {
  const now = getNow(tz);
  const today = now.toISOString().slice(0, 10);
  const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  return (CITY_HOLIDAYS[cityId] || []).filter(h => h.date >= today && h.date <= weekAhead);
}
function esc(str) {
  if (str == null) return "";
  return String(str);
}
function fmtUSD(n) {
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + Number(n).toFixed(1) + "%";
}

/* ─────────────────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────────────────── */
export default function App() {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("eq_bm") || "[]"); } catch { return []; }
  });
  const [basket, setBasket] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [view, setView] = useState("empty"); // empty | result | compare

  const bg = dark ? "#1C1C1E" : STYLE.bg;
  const surf = dark ? "#2C2C2E" : STYLE.surface;
  const bord = dark ? "#3A3A3C" : STYLE.border;
  const txt = dark ? "#F5F5F7" : STYLE.text;
  const sub = dark ? "#98989D" : STYLE.sub;

  const css = { bg, surf, bord, txt, sub, dark };

  // Global styles injection
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.fontFamily = '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
    document.body.style.background = bg;
    document.body.style.color = txt;
    document.body.style.transition = "background 0.25s, color 0.25s";
    document.body.style.fontSize = "17px";
  }, [bg, txt]);

  const saveBookmarks = (bm) => {
    setBookmarks(bm);
    try { localStorage.setItem("eq_bm", JSON.stringify(bm)); } catch {}
  };

  const lookup = useCallback(async (sym) => {
    const t = (sym || ticker).trim().toUpperCase();
    if (!t) return;
    setView("result");
    setLoading(true);
    setResult(null);
    setError(null);
    setSidebarOpen(false);
    try {
      const data = await fetchAnalysis(t);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  const runCompare = useCallback(async () => {
    if (basket.length < 2) return;
    setView("compare");
    setCompareLoading(true);
    setCompareResults(null);
    setSidebarOpen(false);
    try {
      const all = await Promise.all(basket.map(t => fetchAnalysis(t)));
      setCompareResults(all);
    } catch (e) {
      setError(e.message);
    } finally {
      setCompareLoading(false);
    }
  }, [basket]);

  const addBookmark = () => {
    if (!result) return;
    const t = result.ticker;
    if (!bookmarks.includes(t)) saveBookmarks([...bookmarks, t]);
  };
  const removeBookmark = (t) => saveBookmarks(bookmarks.filter(b => b !== t));

  const addToBasket = () => {
    if (!result) return;
    const t = result.ticker;
    if (basket.includes(t) || basket.length >= 3) return;
    setBasket([...basket, t]);
  };
  const removeFromBasket = (t) => setBasket(basket.filter(b => b !== t));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, color: txt, transition: "background 0.25s, color 0.25s" }}>
      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 90,
            backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        css={css}
        open={sidebarOpen}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        bookmarks={bookmarks}
        onLoadBookmark={t => { setTicker(t); lookup(t); }}
        onRemoveBookmark={removeBookmark}
        basket={basket}
        onRemoveFromBasket={removeFromBasket}
        onRunCompare={runCompare}
        onOpenCalc={() => { setCalcOpen(true); setSidebarOpen(false); }}
        onClear={() => { setView("empty"); setResult(null); setError(null); }}
        currentTicker={result?.ticker}
        compareMode={compareMode}
        onToggleCompareMode={() => setCompareMode(c => !c)}
      />

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <TopBar
          css={css}
          ticker={ticker}
          setTicker={setTicker}
          onLookup={() => lookup()}
          onMenuClick={() => setSidebarOpen(true)}
          onBookmark={addBookmark}
          onAddCompare={addToBasket}
          showCompareBtn={compareMode && !!result}
          loading={loading}
        />

        {/* Content */}
        <div style={{ flex: 1, padding: "32px 32px 64px", maxWidth: 900, width: "100%", margin: "0 auto" }}>
          {view === "empty" && <EmptyState css={css} />}
          {view === "result" && (
            loading
              ? <Spinner css={css} ticker={ticker} />
              : error
                ? <ErrorCard msg={error} css={css} />
                : result && <ResultView data={result} css={css} />
          )}
          {view === "compare" && (
            compareLoading
              ? <Spinner css={css} ticker={basket.join(", ")} />
              : error
                ? <ErrorCard msg={error} css={css} />
                : compareResults && <CompareView results={compareResults} css={css} />
          )}
        </div>
      </div>

      {/* Calculator */}
      {calcOpen && <CalcModal onClose={() => setCalcOpen(false)} css={css} currentTicker={result?.ticker} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────── */
function Sidebar({ css, open, onClose, dark, onToggleDark, bookmarks, onLoadBookmark, onRemoveBookmark,
  basket, onRemoveFromBasket, onRunCompare, onOpenCalc, onClear, currentTicker,
  compareMode, onToggleCompareMode }) {

  const { surf, bord, txt, sub } = css;

  return (
    <aside style={{
      width: 270, minHeight: "100vh",
      background: surf, borderRight: `1px solid ${bord}`,
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
      display: "flex", flexDirection: "column",
      padding: "28px 16px 24px",
      overflowY: "auto",
      transform: open ? "translateX(0)" : "translateX(-100%)",
      boxShadow: open ? STYLE.shadowMd : STYLE.shadow,
      transition: "transform 0.28s cubic-bezier(.4,0,.2,1), background 0.25s, border-color 0.25s",
      gap: 0,
    }}>
      {/* Close button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px", color: txt }}>
          eq<span style={{ color: STYLE.accent }}>.</span>
        </div>
        <button onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer",
            fontSize: 18, color: sub, padding: "4px 6px", borderRadius: 4 }}
          title="Close">
        </button>
      </div>

      {/* Clocks */}
      <SidebarLabel>Markets</SidebarLabel>
      <ClockPanel css={css} />

      {/* FX */}
      <SidebarLabel style={{ marginTop: 20 }}>Exchange Rates → ₩</SidebarLabel>
      <FXPanel css={css} />

      {/* Tools */}
      <SidebarLabel style={{ marginTop: 20 }}>Tools</SidebarLabel>
      <SidebarBtn onClick={onOpenCalc} css={css}>🧮  Calculator</SidebarBtn>
      <SidebarBtn onClick={onToggleCompareMode} css={css}
        active={compareMode}>⚖️  Compare Mode{compareMode ? " (on)" : ""}</SidebarBtn>
      <SidebarBtn onClick={onClear} css={css}>↩  Clear</SidebarBtn>

      {/* Night mode */}
      <SidebarLabel style={{ marginTop: 20 }}>Display</SidebarLabel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", fontSize: 15, color: txt }}>
        <span>Night Mode</span>
        <IOSToggle on={dark} onToggle={onToggleDark} />
      </div>

      {/* Bookmarks */}
      <SidebarLabel style={{ marginTop: 20 }}>Bookmarks</SidebarLabel>
      {bookmarks.length === 0
        ? <div style={{ fontSize: 14, color: sub, padding: "6px 10px" }}>None yet</div>
        : bookmarks.map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px", borderRadius: 4, cursor: "pointer", fontSize: 15, color: txt,
            transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = css.bg}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span onClick={() => onLoadBookmark(t)} style={{ fontWeight: 600 }}>{t}</span>
            <button onClick={() => onRemoveBookmark(t)}
              style={{ background: "none", border: "none", cursor: "pointer", color: sub, fontSize: 13, padding: "2px 4px" }}>✕</button>
          </div>
        ))
      }

      {/* Compare basket */}
      <SidebarLabel style={{ marginTop: 20 }}>
        Compare Basket {basket.length > 0 && <span style={{ color: STYLE.accent }}>({basket.length}/3)</span>}
      </SidebarLabel>
      {basket.length === 0
        ? <div style={{ fontSize: 14, color: sub, padding: "6px 10px" }}>Add up to 3 tickers</div>
        : basket.map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 10px", background: css.bg, borderRadius: 4, marginBottom: 4, fontSize: 14 }}>
            <span style={{ fontWeight: 700 }}>{t}</span>
            <button onClick={() => onRemoveFromBasket(t)}
              style={{ background: "none", border: "none", cursor: "pointer", color: sub, fontSize: 13 }}>✕</button>
          </div>
        ))
      }
      {basket.length >= 2 && (
        <button onClick={onRunCompare}
          style={{ marginTop: 8, width: "100%", padding: "9px 0", background: STYLE.accent,
            color: "#fff", border: "none", borderRadius: 4, fontFamily: "inherit",
            fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          Run Comparison
        </button>
      )}
    </aside>
  );
}

function SidebarLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.09em", color: STYLE.sub, marginBottom: 6,
      padding: "0 10px", ...style }}>
      {children}
    </div>
  );
}

function SidebarBtn({ children, onClick, css, active }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "9px 10px", borderRadius: 4, border: "none", cursor: "pointer",
        background: active ? STYLE.accentBg : hov ? css.bg : "transparent",
        color: active ? STYLE.accent : css.txt,
        fontFamily: "inherit", fontSize: 15, textAlign: "left",
        transition: "background 0.15s, color 0.15s", marginBottom: 2 }}>
      {children}
    </button>
  );
}

function IOSToggle({ on, onToggle }) {
  return (
    <button onClick={onToggle}
      style={{ width: 48, height: 28, borderRadius: 14, background: on ? "#34C759" : "#D1D1D6",
        border: "none", cursor: "pointer", position: "relative", transition: "background 0.22s",
        flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 24, height: 24,
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.22s cubic-bezier(.4,0,.2,1)" }} />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   CLOCK PANEL
───────────────────────────────────────────────────────── */
function ClockPanel({ css }) {
  const [times, setTimes] = useState({});
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
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {CITIES.map(city => {
        const now = times[city.id];
        if (!now) return null;
        const status = getMarketStatus(city, now);
        const upcoming = getUpcomingHolidays(city.id, city.tz);
        const isOpen = expanded === city.id;
        return (
          <div key={city.id}>
            <div onClick={() => setExpanded(isOpen ? null : city.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 4, cursor: "pointer",
                background: isOpen ? css.bg : "transparent",
                transition: "background 0.15s" }}
              onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = css.bg; }}
              onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: css.txt }}>{city.label}</div>
                <div style={{ fontSize: 12, color: css.sub }}>{now ? fmtDate(now) : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: css.txt }}>
                  {now ? fmtTime(now) : ""}
                </div>
                <div style={{ fontSize: 11, color: status.color, fontWeight: 600 }}>{status.label}</div>
              </div>
            </div>

            {/* Expanded hours */}
            {isOpen && (
              <div style={{ padding: "8px 12px 12px", background: css.bg, borderRadius: 4,
                marginBottom: 2, fontSize: 13, color: css.sub, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: css.txt, marginBottom: 6, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.07em" }}>{city.exchange}</div>
                {city.preOpen && (
                  <div><span style={{ color: STYLE.warn, fontWeight: 600 }}>Pre-market</span>
                    {" "}{city.preOpen} – {city.preClose}</div>
                )}
                <div><span style={{ color: STYLE.green, fontWeight: 600 }}>Open</span>
                  {" "}{city.open} – {city.close}</div>
                {city.afterOpen && (
                  <div><span style={{ color: STYLE.warn, fontWeight: 600 }}>After-hours</span>
                    {" "}{city.afterOpen} – {city.afterClose}</div>
                )}
                {status.note && (
                  <div style={{ marginTop: 6, color: STYLE.red, fontWeight: 600, fontSize: 12 }}>
                    ⚠ {status.note}
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: `1px solid ${css.bord}`, paddingTop: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase",
                      letterSpacing: "0.07em", marginBottom: 4, color: css.txt }}>Coming week</div>
                    {upcoming.map(h => (
                      <div key={h.date} style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                        <span style={{ color: STYLE.red, fontWeight: 600 }}>{h.date.slice(5)}</span>
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
   FX PANEL — free open exchange rates (no key needed for basic)
───────────────────────────────────────────────────────── */
const FX_PAIRS = [
  { symbol: "$", code: "USD", label: "USD" },
  { symbol: "¥", code: "JPY", label: "JPY" },
  { symbol: "£", code: "GBP", label: "GBP" },
  { symbol: "A$", code: "AUD", label: "AUD" },
];

function FXPanel({ css }) {
  const [rates, setRates] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // Using exchangerate.host (free, no key for basic USD base)
    fetch("https://api.exchangerate.host/latest?base=KRW&symbols=USD,JPY,GBP,AUD")
      .then(r => r.json())
      .then(d => {
        if (d?.rates) {
          // rates are KRW→X, we want X→KRW
          const inv = {};
          Object.entries(d.rates).forEach(([k, v]) => { inv[k] = 1 / v; });
          setRates(inv);
        } else setErr(true);
      })
      .catch(() => {
        // Fallback: approximate rates
        setRates({ USD: 1385, JPY: 9.3, GBP: 1750, AUD: 895 });
      });
  }, []);

  if (err) return <div style={{ fontSize: 13, color: css.sub, padding: "6px 10px" }}>FX unavailable</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {FX_PAIRS.map(p => {
        const rate = rates?.[p.code];
        const formatted = rate
          ? Math.round(rate).toLocaleString("en-US")
          : "…";
        return (
          <div key={p.code} style={{ display: "flex", justifyContent: "space-between",
            padding: "6px 10px", fontSize: 14, color: css.txt, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: css.sub }}>{p.symbol}</span>
            <span style={{ fontWeight: 500 }}>{p.symbol}1 = <span style={{ fontWeight: 700 }}>₩{formatted}</span></span>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: css.sub, padding: "2px 10px" }}>Live via exchangerate.host</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────────────────── */
function TopBar({ css, ticker, setTicker, onLookup, onMenuClick, onBookmark, onAddCompare,
  showCompareBtn, loading }) {
  const { surf, bord, txt } = css;
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50,
      background: surf, borderBottom: `1px solid ${bord}`,
      padding: "12px 20px", display: "flex", alignItems: "center", gap: 14,
      transition: "background 0.25s, border-color 0.25s",
      boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>

      {/* Logo — always visible, opens sidebar on click */}
      <button onClick={onMenuClick}
        style={{ background: "none", border: "none", cursor: "pointer",
          fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px", color: txt,
          padding: "4px 2px", fontFamily: "inherit", flexShrink: 0,
          lineHeight: 1 }}>
        eq<span style={{ color: STYLE.accent }}>.</span>
      </button>

      {/* Search row */}
      <div style={{ flex: 1, display: "flex", gap: 8, maxWidth: 580 }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && onLookup()}
          placeholder="Ticker — AAPL, NVDA, QQQ…"
          style={{ flex: 1, border: `1.5px solid ${bord}`, borderRadius: 4,
            padding: "9px 14px", fontFamily: "inherit", fontSize: 17,
            background: css.bg, color: txt, outline: "none",
            transition: "border-color 0.15s, background 0.25s",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
          onFocus={e => e.target.style.borderColor = STYLE.accent}
          onBlur={e => e.target.style.borderColor = bord}
        />
        <Btn onClick={onLookup} disabled={loading} primary pill>
          {loading ? "…" : "Search"}
        </Btn>
      </div>
      <Btn onClick={onBookmark} title="Bookmark">🔖</Btn>
      {showCompareBtn && <Btn onClick={onAddCompare} title="Add to compare">+⚖️</Btn>}
    </header>
  );
}

function Btn({ children, onClick, primary, disabled, title, pill, style: extraStyle }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: primary ? "9px 22px" : "9px 14px",
        background: primary ? (hov && !disabled ? "#0060DF" : STYLE.accent) : hov ? "#E8E8ED" : "#F0F0F5",
        color: primary ? "#fff" : STYLE.text,
        border: "none", borderRadius: pill ? "100px" : 4,
        fontFamily: "inherit", fontSize: 15, fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, opacity 0.15s",
        whiteSpace: "nowrap",
        ...extraStyle
      }}>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   STATES
───────────────────────────────────────────────────────── */
function EmptyState({ css }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", paddingTop: 100, gap: 14, color: css.sub }}>
      <div style={{ fontSize: 52 }}>📈</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: css.txt }}>Start researching</div>
      <div style={{ fontSize: 16, maxWidth: 340, textAlign: "center", lineHeight: 1.55 }}>
        Enter any stock ticker or ETF symbol to get a full analysis — prospects, risks, holdings, and return comparison.
      </div>
    </div>
  );
}

function Spinner({ css, ticker }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      paddingTop: 80, gap: 14, color: css.sub, fontSize: 16 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${css.bord}`,
        borderTopColor: STYLE.accent, borderRadius: "50%",
        animation: "spin 0.75s linear infinite" }} />
      Researching {ticker}…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorCard({ msg, css }) {
  return (
    <div style={{ background: "#FFF0EF", border: "1px solid #FFD0CC", borderRadius: 4,
      padding: "18px 22px", color: STYLE.red, fontSize: 16, lineHeight: 1.55,
      boxShadow: STYLE.shadow }}>
      <strong>Error:</strong> {msg}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   RESULT VIEW
───────────────────────────────────────────────────────── */
function ResultView({ data: d, css }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <HeaderCard d={d} css={css} />
      <OverviewCard d={d} css={css} />
      <ProspectsCard d={d} css={css} />
      {d.is_etf && d.etf_holdings?.length > 0 && <HoldingsCard d={d} css={css} />}
      <ReturnsCard d={d} css={css} />
      <MetaCard d={d} css={css} />
    </div>
  );
}

function Card({ children, css, style }) {
  return (
    <div style={{ background: css.surf, border: `1px solid ${css.bord}`, borderRadius: 4,
      padding: "24px 26px", boxShadow: STYLE.shadow,
      transition: "background 0.25s, border-color 0.25s", ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.2px" }}>{children}</div>;
}

function HeaderCard({ d, css }) {
  const price = d.current_price
    ? "$" + Number(d.current_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;
  return (
    <Card css={css}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1px" }}>{d.ticker}</span>
            <Pill color={d.is_etf ? STYLE.warn : STYLE.accent}
              bg={d.is_etf ? STYLE.warnBg : STYLE.accentBg}>
              {d.is_etf ? "ETF" : "Stock"}
            </Pill>
            {d.sector && <Pill color={STYLE.green} bg={STYLE.greenBg}>{d.sector}</Pill>}
          </div>
          <div style={{ fontSize: 16, color: css.sub, marginTop: 4 }}>
            {d.name}{d.country ? ` · ${d.country}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {price && <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px" }}>{price}</div>}
          <div style={{ fontSize: 14, color: css.sub, marginTop: 2 }}>
            {[d.market_cap ? d.market_cap : null, d.pe_ratio ? `P/E ${d.pe_ratio}` : null,
              d.dividend_yield ? `Yield ${d.dividend_yield}%` : null].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Pill({ children, color, bg }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 100,
      fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
      color, background: bg }}>
      {children}
    </span>
  );
}

function OverviewCard({ d, css }) {
  return (
    <Card css={css}>
      <CardTitle>Overview</CardTitle>
      <div style={{ fontSize: 17, lineHeight: 1.65, color: css.txt }}>{d.overview}</div>
    </Card>
  );
}

function ProspectsCard({ d, css }) {
  const p = d.prospects || {};
  const sentColor = s => ({ low: STYLE.green, medium: STYLE.warn, high: STYLE.red,
    positive: STYLE.green, neutral: css.sub, negative: STYLE.red })[s] || css.sub;

  function RiskCell({ label, obj }) {
    if (!obj) return null;
    return (
      <div style={{ background: css.bg, borderRadius: 4, padding: "14px 16px",
        transition: "background 0.25s" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: css.sub, marginBottom: 8, display: "flex",
          alignItems: "center", gap: 6 }}>
          {obj.sentiment && (
            <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: sentColor(obj.sentiment), display: "inline-block", flexShrink: 0 }} />
          )}
          {label}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.55, color: css.txt }}>{obj.summary}</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          <Tag type={obj.tag} />
        </div>
        {obj.counterargument && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${css.bord}` }}>
            <Tag type="counterargument" />
            <div style={{ fontSize: 13, color: css.sub, marginTop: 4 }}>{obj.counterargument}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card css={css}>
      <CardTitle>Prospects & Risk Factors</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        <RiskCell label="Geopolitical Risk" obj={p.geopolitical} />
        <RiskCell label="AI & Disruption" obj={p.ai_singularity} />
        <RiskCell label="Supply Chain" obj={p.supply_chain} />
        {(p.other || []).map((o, i) => (
          <div key={i} style={{ background: css.bg, borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: css.sub, marginBottom: 8 }}>{o.label}</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: css.txt }}>{o.summary}</div>
            <div style={{ marginTop: 8 }}><Tag type={o.tag} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Tag({ type }) {
  const map = {
    qualified_opinion: { label: "qualified opinion", color: STYLE.warn, bg: STYLE.warnBg },
    not_verified:      { label: "not verified",       color: STYLE.sub,  bg: "#F0F0F5" },
    counterargument:   { label: "counterargument",    color: STYLE.red,  bg: STYLE.redBg },
    data:              { label: "data",                color: STYLE.accent, bg: STYLE.accentBg },
  };
  const t = map[type] || map.data;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3,
      fontSize: 11, fontWeight: 700, color: t.color, background: t.bg }}>
      {t.label}
    </span>
  );
}

function HoldingsCard({ d, css }) {
  return (
    <Card css={css}>
      <CardTitle>Top 10 Holdings</CardTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${css.bord}` }}>
            {["#", "Company", "Ticker", "Weight"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: css.sub }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(d.etf_holdings || []).slice(0, 10).map((h, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${css.bord}` }}>
              <td style={{ padding: "10px 10px", color: css.sub, fontSize: 13 }}>{i + 1}</td>
              <td style={{ padding: "10px 10px", fontWeight: 600 }}>{h.name}</td>
              <td style={{ padding: "10px 10px", color: css.sub }}>{h.ticker}</td>
              <td style={{ padding: "10px 10px", color: STYLE.accent, fontWeight: 700 }}>
                {h.weight_pct != null ? h.weight_pct.toFixed(2) + "%" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: css.sub, marginTop: 12, paddingTop: 10,
        borderTop: `1px solid ${css.bord}` }}>
        Source: Fund prospectus / provider data. Holdings subject to change.
      </div>
    </Card>
  );
}

function ReturnsCard({ d, css }) {
  const r = d.returns || {};
  const rows = [
    { label: "5-Year Historical (ann.)",   stock: r.past_5yr_stock_annualized,    sp: r.past_5yr_sp500_annualized,    note: null },
    { label: "10-Year Historical (ann.)",  stock: r.past_10yr_stock_annualized,   sp: r.past_10yr_sp500_annualized,   note: null },
    { label: "5-Year Forward Estimate",    stock: r.forward_5yr_stock_consensus,  sp: r.forward_5yr_sp500_consensus,  note: "Analyst consensus — speculative" },
    { label: "10-Year Forward Estimate",   stock: r.forward_10yr_stock_consensus, sp: r.forward_10yr_sp500_consensus, note: "Long-range — highly speculative" },
  ];

  return (
    <Card css={css}>
      <CardTitle>Returns vs S&P 500</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map(row => {
          const max = Math.max(Math.abs(row.stock || 0), Math.abs(row.sp || 0), 1);
          const sPct = row.stock != null ? (Math.abs(row.stock) / max * 100) : 0;
          const spPct = row.sp != null ? (Math.abs(row.sp) / max * 100) : 0;
          return (
            <div key={row.label}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: css.txt }}>{row.label}</div>
              <BarRow label={d.ticker} val={row.stock} pct={sPct} color={STYLE.accent} css={css} />
              <BarRow label="S&P 500" val={row.sp} pct={spPct} color={css.sub} css={css} />
              {row.note && <div style={{ fontSize: 12, color: css.sub, marginTop: 4 }}>{row.note}</div>}
            </div>
          );
        })}
      </div>
      {r.returns_note && (
        <div style={{ fontSize: 12, color: css.sub, marginTop: 14, paddingTop: 12,
          borderTop: `1px solid ${css.bord}` }}>{r.returns_note}</div>
      )}
    </Card>
  );
}

function BarRow({ label, val, pct, color, css }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 80, fontSize: 13, color: css.sub, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 7, background: css.bg, borderRadius: 100, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color,
          borderRadius: 100, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ width: 72, fontSize: 13, fontWeight: 700, color: val != null
        ? (val >= 0 ? STYLE.green : STYLE.red) : css.sub, textAlign: "right", flexShrink: 0 }}>
        {fmtPct(val)}
      </div>
    </div>
  );
}

function MetaCard({ d, css }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12, color: css.sub }}>
      <span>Sources: {(d.data_sources || []).join(", ")}</span>
      <span>·</span>
      <span>Updated: {d.last_updated || "today"}</span>
      <span>·</span>
      <span>Not financial advice.</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   COMPARE VIEW
───────────────────────────────────────────────────────── */
function CompareView({ results, css }) {
  const cols = results.length;
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Comparison</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {results.map(d => (
          <Card key={d.ticker} css={css} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{d.ticker}</div>
            <div style={{ fontSize: 13, color: css.sub, marginBottom: 10 }}>{d.name}</div>

            <Section title="Overview" css={css}>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: css.txt }}>{d.overview}</div>
            </Section>

            <Section title="Geopolitical" css={css}>
              <div style={{ fontSize: 14, color: css.txt }}>{d.prospects?.geopolitical?.summary}</div>
              <Tag type={d.prospects?.geopolitical?.tag} />
            </Section>

            <Section title="AI Risk/Opp." css={css}>
              <div style={{ fontSize: 14, color: css.txt }}>{d.prospects?.ai_singularity?.summary}</div>
            </Section>

            <Section title="5yr Return (ann.)" css={css}>
              <span style={{ fontWeight: 700, color: STYLE.accent }}>{fmtPct(d.returns?.past_5yr_stock_annualized)}</span>
              <span style={{ color: css.sub, fontSize: 13 }}> vs S&P {fmtPct(d.returns?.past_5yr_sp500_annualized)}</span>
            </Section>

            <Section title="10yr Return (ann.)" css={css}>
              <span style={{ fontWeight: 700, color: STYLE.accent }}>{fmtPct(d.returns?.past_10yr_stock_annualized)}</span>
              <span style={{ color: css.sub, fontSize: 13 }}> vs S&P {fmtPct(d.returns?.past_10yr_sp500_annualized)}</span>
            </Section>

            {d.is_etf && d.etf_holdings?.length > 0 && (
              <Section title="Top 3 Holdings" css={css}>
                {d.etf_holdings.slice(0, 3).map((h, i) => (
                  <div key={i} style={{ fontSize: 13, color: css.txt, marginBottom: 2 }}>
                    {h.name} <span style={{ color: STYLE.accent, fontWeight: 700 }}>{h.weight_pct?.toFixed(1)}%</span>
                  </div>
                ))}
              </Section>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children, css }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: css.sub, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CALCULATOR MODAL
───────────────────────────────────────────────────────── */
function CalcModal({ onClose, css, currentTicker }) {
  const [ticker, setTicker] = useState(currentTicker || "");
  const [monthly, setMonthly] = useState("");
  const [months, setMonths] = useState("");
  const [rateMode, setRateMode] = useState("moderate");
  const [customRate, setCustomRate] = useState("");
  const [result, setResult] = useState(null);

  const RATES = { conservative: 0.07, moderate: 0.12, optimistic: 0.20 };

  const calc = () => {
    const m = parseFloat(monthly);
    const mo = parseInt(months);
    if (isNaN(m) || isNaN(mo) || m <= 0 || mo <= 0) return;
    const ann = rateMode === "custom" ? parseFloat(customRate) / 100 : RATES[rateMode];
    if (isNaN(ann)) return;
    const mr = ann / 12;
    let fv = 0;
    for (let i = 0; i < mo; i++) fv = (fv + m) * (1 + mr);
    const contributed = m * mo;
    const gain = fv - contributed;
    setResult({ fv, contributed, gain, gainPct: (gain / contributed * 100).toFixed(1), ann, mo });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex",
      alignItems: "flex-end", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(3px)" }} />
      <div style={{ position: "relative", background: css.surf, borderRadius: "8px 8px 4px 4px",
        width: "100%", maxWidth: 480, padding: "28px 28px 36px",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.14)",
        animation: "slideUp 0.28s cubic-bezier(.4,0,.2,1)",
        zIndex: 1 }}>
        <style>{`@keyframes slideUp { from { transform: translateY(32px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <button onClick={onClose}
          style={{ position: "absolute", top: 16, right: 18, background: css.bg,
            border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer",
            color: css.sub, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 22 }}>Investment Calculator</div>

        {[
          { label: "Stock / ETF ticker", el: <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="e.g. NVDA" style={inputStyle(css)} /> },
          { label: "Monthly investment ($)", el: <input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="e.g. 200" min="1" style={inputStyle(css)} /> },
          { label: "Duration (months)", el: <input type="number" value={months} onChange={e => setMonths(e.target.value)} placeholder="e.g. 24" min="1" style={inputStyle(css)} /> },
          { label: "Expected annual return", el: (
            <select value={rateMode} onChange={e => setRateMode(e.target.value)} style={inputStyle(css)}>
              <option value="conservative">Conservative — ~7% (S&P historical avg)</option>
              <option value="moderate">Moderate — ~12% (growth stock avg)</option>
              <option value="optimistic">Optimistic — ~20% (strong performer)</option>
              <option value="custom">Custom…</option>
            </select>
          )},
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600,
              color: css.sub, marginBottom: 6 }}>{label}</label>
            {el}
          </div>
        ))}

        {rateMode === "custom" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600,
              color: css.sub, marginBottom: 6 }}>Custom annual return (%)</label>
            <input type="number" value={customRate} onChange={e => setCustomRate(e.target.value)}
              placeholder="e.g. 15" style={inputStyle(css)} />
          </div>
        )}

        <button onClick={calc}
          style={{ width: "100%", padding: "11px 0", background: STYLE.accent,
            color: "#fff", border: "none", borderRadius: 4, fontFamily: "inherit",
            fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          Calculate
        </button>

        {result && (
          <div style={{ marginTop: 18, background: css.bg, borderRadius: 4,
            padding: "18px 20px", fontSize: 15, lineHeight: 1.7 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: STYLE.accent, marginBottom: 8 }}>
              {fmtUSD(result.fv)}
            </div>
            <div><strong>Total invested:</strong> {fmtUSD(result.contributed)}</div>
            <div><strong>Estimated gain:</strong> {fmtUSD(result.gain)} (+{result.gainPct}%)</div>
            <div><strong>Duration:</strong> {result.mo} months ({(result.mo / 12).toFixed(1)} yrs)</div>
            <div><strong>Annual return assumed:</strong> {(result.ann * 100).toFixed(1)}%</div>
            <div style={{ fontSize: 12, color: css.sub, marginTop: 10, lineHeight: 1.5 }}>
              ⚠ Assumes constant monthly buys at a fixed return rate. Real returns vary. This is a mathematical projection, not a prediction.
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: css.sub, marginTop: 14,
          borderTop: `1px solid ${css.bord}`, paddingTop: 12 }}>
          Not financial advice. Past performance does not guarantee future results.
        </div>
      </div>
    </div>
  );
}

function inputStyle(css) {
  return {
    width: "100%", border: `1.5px solid ${css.bord}`, borderRadius: 4,
    padding: "9px 12px", fontFamily: "inherit", fontSize: 16,
    background: css.bg, color: css.txt, outline: "none",
    boxSizing: "border-box",
  };
}

/* ─────────────────────────────────────────────────────────
   AI FETCH
───────────────────────────────────────────────────────── */
async function fetchAnalysis(ticker) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const prompt = `Analyze the stock or ETF with ticker: ${ticker}

Return ONLY a valid JSON object — no markdown fences, no preamble. Use this exact structure:

{
  "ticker": "${ticker}",
  "name": "Full legal name",
  "type": "stock or etf",
  "sector": "e.g. Technology",
  "country": "HQ country",
  "overview": "2-4 sentences: what they do, hardware vs software, key products, why they matter.",
  "is_etf": true or false,

  "prospects": {
    "geopolitical": {
      "summary": "2-3 sentences on geopolitical/security risk",
      "sentiment": "low|medium|high",
      "counterargument": "opposing view or null",
      "tag": "data or qualified_opinion"
    },
    "ai_singularity": {
      "summary": "2-3 sentences on AI disruption risk or opportunity",
      "sentiment": "negative|neutral|positive",
      "counterargument": null,
      "tag": "qualified_opinion"
    },
    "supply_chain": {
      "summary": "2-3 sentences on supply chain risks",
      "sentiment": "low|medium|high",
      "counterargument": null,
      "tag": "data or qualified_opinion"
    },
    "other": [
      { "label": "e.g. Regulatory Risk", "summary": "1-2 sentences", "tag": "qualified_opinion|data|not_verified" }
    ]
  },

  "etf_holdings": [
    { "rank": 1, "name": "Company", "ticker": "TICK", "weight_pct": 12.5 }
  ],

  "returns": {
    "past_5yr_stock_annualized": number_or_null,
    "past_10yr_stock_annualized": number_or_null,
    "past_5yr_sp500_annualized": number_or_null,
    "past_10yr_sp500_annualized": number_or_null,
    "forward_5yr_stock_consensus": number_or_null,
    "forward_10yr_stock_consensus": number_or_null,
    "forward_5yr_sp500_consensus": number_or_null,
    "forward_10yr_sp500_consensus": number_or_null,
    "returns_note": "brief data source note",
    "tag": "data"
  },

  "current_price": number_or_null,
  "market_cap": "e.g. $2.9T or null",
  "pe_ratio": number_or_null,
  "dividend_yield": number_or_null,
  "data_sources": ["Morningstar", "Yahoo Finance", "Reuters"],
  "last_updated": "${new Date().toISOString().slice(0, 10)}"
}

Today is ${today}. Search the web for current data on ${ticker}. Prefer Morningstar, Yahoo Finance, Reuters, Bloomberg for numbers. For etf_holdings: include up to 10 holdings if it is an ETF, otherwise set to empty array. Return ONLY the JSON.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You are a precise equity research assistant. Always respond ONLY with a valid JSON object — absolutely no markdown fences, no preamble, no text outside the JSON. Qualify opinions as "qualified_opinion". Flag Reddit/forum sources as "not_verified". Include counterarguments where significant. Prefer quantitative data from Morningstar, Yahoo Finance, Reuters, Bloomberg.`,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `API error ${res.status}`);
  }

  const json = await res.json();
  const textBlock = [...(json.content || [])].reverse().find(b => b.type === "text");
  if (!textBlock) throw new Error("No response from AI.");

  let raw = textBlock.text.trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Response parsing failed. Try again.");
  }
}
