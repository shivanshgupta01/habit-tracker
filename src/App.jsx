import { useState, useEffect, useCallback, useRef } from "react";

const CATEGORIES = {
  health: { label: "Health", color: "#4CAF82" },
  fitness: { label: "Fitness", color: "#F5A623" },
  learning: { label: "Learning", color: "#60A5FA" },
  mindset: { label: "Mindset", color: "#C084FC" },
  other: { label: "Other", color: "#94A3B8" },
};

const EMOJIS = ["💧","📚","🏃","🧘","🥗","💪","✍️","🎵","🌅","😴","🧠","💊","🚶","🎯","🔥"];

const QUOTES = [
  "Small steps every day lead to big results.",
  "Discipline is choosing between what you want now and what you want most.",
  "You don't rise to the level of your goals, you fall to the level of your systems.",
  "The secret of your future is hidden in your daily routine.",
  "Motivation gets you started. Habit keeps you going.",
];

const getDayKey = (date) => date.toISOString().split("T")[0];
const getToday = () => getDayKey(new Date());
const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDayKey(d));
  }
  return days;
};
const DAY_LABELS = ["S","M","T","W","T","F","S"];

function ConfettiPiece({ style }) {
  return <div style={{ position: "fixed", width: 8, height: 8, borderRadius: 2, animation: "confettiFall 2s ease-in forwards", ...style }} />;
}

function Confetti({ show }) {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    background: ["#F5A623","#4CAF82","#60A5FA","#C084FC","#FF6B6B"][i % 5],
    animationDelay: `${Math.random() * 0.5}s`,
    top: "-10px",
  }));
  if (!show) return null;
  return <>{pieces.map((s, i) => <ConfettiPiece key={i} style={s} />)}</>;
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? "#4CAF82" : type === "error" ? "#EF4444" : "#F5A623";
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: bg, color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 999, animation: "slideUp 0.3s ease", whiteSpace: "nowrap", boxShadow: `0 8px 24px ${bg}55` }}>
      {message}
    </div>
  );
}

export default function HabitTracker() {
  const [userName, setUserName] = useState(() => localStorage.getItem("user_name") || "");
  const [tempName, setTempName] = useState("");
  const [habits, setHabits] = useState(() => { try { return JSON.parse(localStorage.getItem("habits_v3")) || []; } catch { return []; } });
  const [completions, setCompletions] = useState(() => { try { return JSON.parse(localStorage.getItem("completions_v3")) || {}; } catch { return {}; } });
  const [reminders, setReminders] = useState(() => { try { return JSON.parse(localStorage.getItem("reminders_v3")) || {}; } catch { return {}; } });
  const [tab, setTab] = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const [notifPermission, setNotifPermission] = useState("default");
  const [newHabit, setNewHabit] = useState({ name: "", emoji: "💧", category: "health", reminderTime: "" });
  const [editId, setEditId] = useState(null);
  const intervalRef = useRef(null);

  const today = getToday();
  const last7 = getLast7Days();
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  useEffect(() => { localStorage.setItem("habits_v3", JSON.stringify(habits)); }, [habits]);
  useEffect(() => { localStorage.setItem("completions_v3", JSON.stringify(completions)); }, [completions]);
  useEffect(() => { localStorage.setItem("reminders_v3", JSON.stringify(reminders)); }, [reminders]);

  useEffect(() => {
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;
      habits.forEach(h => {
        const rt = reminders[h.id];
        if (!rt || rt !== currentTime) return;
        if (!completions[getToday()]?.[h.id]) {
          try { new Notification("⏰ Habit Reminder", { body: `Time to: ${h.emoji} ${h.name}` }); } catch (e) {}
        }
      });
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [habits, reminders, completions]);

  const saveName = () => {
    const name = tempName.trim();
    if (!name) return;
    localStorage.setItem("user_name", name);
    setUserName(name);
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) { showToastMsg("Browser doesn't support notifications", "error"); return; }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") showToastMsg("🔔 Notifications enabled!", "success");
    else showToastMsg("Notifications blocked in browser settings", "error");
  };

  const showToastMsg = (message, type = "info") => setToast({ message, type });

  const todayDone = habits.filter(h => completions[today]?.[h.id]).length;
  const todayTotal = habits.length;

  const toggle = useCallback((habitId) => {
    setCompletions(prev => {
      const dayData = { ...(prev[today] || {}) };
      dayData[habitId] = !dayData[habitId];
      const next = { ...prev, [today]: dayData };
      const newDone = habits.filter(h => next[today]?.[h.id]).length;
      if (newDone === habits.length && habits.length > 0) {
        setConfetti(true); setTimeout(() => setConfetti(false), 2500);
      }
      return next;
    });
  }, [today, habits]);

  const getStreak = useCallback((habitId) => {
    let streak = 0; const d = new Date();
    while (true) { const key = getDayKey(d); if (completions[key]?.[habitId]) { streak++; d.setDate(d.getDate() - 1); } else break; }
    return streak;
  }, [completions]);

  const getLongestStreak = useCallback((habitId) => {
    const keys = Object.keys(completions).sort(); let max = 0, cur = 0;
    keys.forEach(k => { if (completions[k]?.[habitId]) { cur++; max = Math.max(max, cur); } else cur = 0; });
    return max;
  }, [completions]);

  const getWeekRate = useCallback((habitId) => {
    const done = last7.filter(d => completions[d]?.[habitId]).length;
    return Math.round((done / 7) * 100);
  }, [completions, last7]);

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    if (editId) {
      setHabits(prev => prev.map(h => h.id === editId ? { ...h, ...newHabit } : h));
      if (newHabit.reminderTime) setReminders(prev => ({ ...prev, [editId]: newHabit.reminderTime }));
      else setReminders(prev => { const n = { ...prev }; delete n[editId]; return n; });
      setEditId(null);
      showToastMsg("✅ Habit updated!", "success");
    } else {
      const id = Date.now().toString();
      setHabits(prev => [...prev, { ...newHabit, id, createdAt: today }]);
      if (newHabit.reminderTime) setReminders(prev => ({ ...prev, [id]: newHabit.reminderTime }));
      showToastMsg("✅ Habit added!", "success");
    }
    setNewHabit({ name: "", emoji: "💧", category: "health", reminderTime: "" });
    setShowAdd(false);
  };

  const deleteHabit = (id) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    setReminders(prev => { const n = { ...prev }; delete n[id]; return n; });
    showToastMsg("🗑️ Habit deleted", "info");
  };

  const startEdit = (h) => {
    setNewHabit({ name: h.name, emoji: h.emoji, category: h.category, reminderTime: reminders[h.id] || "" });
    setEditId(h.id); setShowAdd(true);
  };

  const exportCSV = () => {
    if (habits.length === 0) return;
    const allDays = Object.keys(completions).sort();
    const header = ["Date", ...habits.map(h => `${h.emoji} ${h.name}`)].join(",");
    const rows = allDays.map(day => {
      const cols = habits.map(h => completions[day]?.[h.id] ? "Done" : "Missed");
      return [day, ...cols].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `habit-tracker-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToastMsg("📥 CSV downloaded!", "success");
  };

  const overallRate = habits.length === 0 ? 0 : Math.round(
    habits.reduce((sum, h) => sum + getWeekRate(h.id), 0) / habits.length
  );
  const progressPct = todayTotal === 0 ? 0 : (todayDone / todayTotal) * 100;
  const circumference = 2 * Math.PI * 36;
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good Morning" : greetingHour < 17 ? "Good Afternoon" : "Good Evening";
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0A0D14; } ::-webkit-scrollbar-thumb { background: #2A2D3E; border-radius: 4px; }
    @keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes checkBounce { 0%{transform:scale(1)} 40%{transform:scale(1.3)} 70%{transform:scale(0.9)} 100%{transform:scale(1)} }
    .habit-card { animation: slideUp 0.4s ease both; }
    .tab-btn { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 30px; transition: all 0.2s; }
    .tab-btn.active { background: #F5A623; color: #0A0D14; }
    .tab-btn.inactive { color: #64748B; }
    .tab-btn.inactive:hover { color: #E2E8F0; }
    .check-btn { width: 34px; height: 34px; border-radius: 50%; border: 2px solid; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 15px; flex-shrink: 0; }
    .check-btn:active { animation: checkBounce 0.3s ease; }
    .grid-cell { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; transition: all 0.2s; }
    .add-btn { position: fixed; bottom: 28px; right: 28px; width: 56px; height: 56px; border-radius: 50%; background: #F5A623; border: none; cursor: pointer; font-size: 26px; color: #0A0D14; display: flex; align-items:center; justify-content:center; box-shadow: 0 8px 24px rgba(245,166,35,0.4); transition: all 0.2s; z-index: 100; }
    .add-btn:hover { transform: scale(1.1); }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 200; animation: fadeIn 0.2s ease; backdrop-filter: blur(4px); padding: 20px; }
    .modal { background: #141720; border: 1px solid #2A2D3E; border-radius: 20px; padding: 28px; width: 100%; max-width: 380px; animation: slideUp 0.3s ease; max-height: 90vh; overflow-y: auto; }
    input, select { background: #1E2130; border: 1px solid #2A2D3E; border-radius: 10px; color: #E2E8F0; font-family: 'DM Sans',sans-serif; font-size: 14px; padding: 12px 14px; width: 100%; outline: none; transition: border 0.2s; }
    input:focus, select:focus { border-color: #F5A623; }
    .emoji-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .emoji-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent; background: #1E2130; cursor: pointer; font-size: 18px; display:flex;align-items:center;justify-content:center; transition: all 0.15s; }
    .emoji-btn.selected { border-color: #F5A623; background: #2A2010; }
    .action-btn { border: none; border-radius: 10px; padding: 12px 24px; font-family: 'DM Sans',sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .stat-card { background: #141720; border: 1px solid #1E2130; border-radius: 16px; padding: 20px; }
    .bar { height: 6px; border-radius: 3px; background: #1E2130; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 3px; transition: width 1s ease; }
    .bg-glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; opacity: 0.1; }
    .icon-btn { background: #1E2130; border: 1px solid #2A2D3E; border-radius: 10px; cursor: pointer; padding: 8px 12px; transition: all 0.2s; color: #94A3B8; display: flex; align-items: center; gap: 6px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; }
    .icon-btn:hover { border-color: #F5A623; color: #F5A623; }
    .reminder-tag { font-size: 11px; background: #C084FC22; color: #C084FC; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  `;

  // ── WELCOME SCREEN ──────────────────────────────────────────────────
  if (!userName) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0D14", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
        <style>{STYLES}</style>
        <div className="bg-glow" style={{ width: 300, height: 300, background: "#F5A623", top: -80, right: -80 }} />
        <div className="bg-glow" style={{ width: 200, height: 200, background: "#4CAF82", bottom: 60, left: -60 }} />
        <div style={{ background: "#141720", border: "1px solid #1E2130", borderRadius: 28, padding: "44px 36px", width: "100%", maxWidth: 400, textAlign: "center", animation: "slideUp 0.5s ease" }}>
          <div style={{ fontSize: 64, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>🌱</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: "#E2E8F0", marginBottom: 8 }}>Welcome!</h1>
          <p style={{ color: "#64748B", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>Your personal habit tracker.<br />What should we call you?</p>
          <input
            placeholder="Enter your name..."
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
            style={{ marginBottom: 14, textAlign: "center", fontSize: 16 }}
          />
          <button onClick={saveName}
            style={{ width: "100%", background: tempName.trim() ? "#F5A623" : "#1E2130", color: tempName.trim() ? "#0A0D14" : "#64748B", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: tempName.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s", boxShadow: tempName.trim() ? "0 8px 24px rgba(245,166,35,0.35)" : "none" }}>
            Let's Go 🚀
          </button>
          <p style={{ color: "#2A2D3E", fontSize: 11, marginTop: 16 }}>Your name is saved locally on your device only</p>
        </div>
      </div>
    );
  }

  // ── MAIN APP ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0A0D14", color: "#E2E8F0", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{STYLES}</style>
      <div className="bg-glow" style={{ width: 300, height: 300, background: "#F5A623", top: -80, right: -80 }} />
      <div className="bg-glow" style={{ width: 200, height: 200, background: "#4CAF82", bottom: 100, left: -60 }} />

      <Confetti show={confetti} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 100px" }}>

        {/* Header */}
        <div style={{ padding: "28px 0 16px", animation: "slideUp 0.5s ease" }}>
          <p style={{ color: "#64748B", fontSize: 13, marginBottom: 4 }}>{dateLabel}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
                {greeting}, {userName} 👋
              </h1>
              <p style={{ color: "#64748B", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>"{quote}"</p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="icon-btn" onClick={() => setShowSettings(true)}>🔔</button>
              <button className="icon-btn" onClick={() => setShowExport(true)}>📥 CSV</button>
            </div>
          </div>
        </div>

        {/* Progress Ring */}
        <div style={{ background: "#141720", border: "1px solid #1E2130", borderRadius: 20, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, animation: "slideUp 0.5s 0.1s ease both" }}>
          <svg width={90} height={90} style={{ flexShrink: 0 }}>
            <circle cx={45} cy={45} r={36} fill="none" stroke="#1E2130" strokeWidth={7} />
            <circle cx={45} cy={45} r={36} fill="none" stroke="#F5A623" strokeWidth={7}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * progressPct) / 100}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={45} y={42} textAnchor="middle" fill="#F5A623" fontSize={18} fontWeight={700} fontFamily="Syne">{todayDone}</text>
            <text x={45} y={57} textAnchor="middle" fill="#64748B" fontSize={11} fontFamily="DM Sans">of {todayTotal}</text>
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              {todayTotal === 0 ? "Add your first habit!" : todayDone === todayTotal ? "🎉 All done today!" : `${todayTotal - todayDone} habit${todayTotal - todayDone !== 1 ? "s" : ""} remaining`}
            </p>
            <p style={{ color: "#64748B", fontSize: 13 }}>{todayTotal > 0 ? `${Math.round(progressPct)}% complete` : "Tap + to get started"}</p>
            <div className="bar" style={{ marginTop: 10 }}>
              <div className="bar-fill" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #F5A623, #FF8C42)" }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#141720", border: "1px solid #1E2130", borderRadius: 40, padding: 4, marginBottom: 20, animation: "slideUp 0.5s 0.15s ease both" }}>
          {["today","weekly","stats"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : "inactive"}`} style={{ flex: 1 }} onClick={() => setTab(t)}>
              {t === "today" ? "Today" : t === "weekly" ? "This Week" : "Stats"}
            </button>
          ))}
        </div>

        {/* TODAY */}
        {tab === "today" && (
          <div>
            {habits.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
                <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>No habits yet</p>
                <p style={{ fontSize: 13 }}>Tap the + button to add your first habit</p>
              </div>
            )}
            {habits.map((h, i) => {
              const done = !!completions[today]?.[h.id];
              const streak = getStreak(h.id);
              const cat = CATEGORIES[h.category];
              const hasReminder = !!reminders[h.id];
              return (
                <div key={h.id} className="habit-card" style={{ animationDelay: `${i * 0.06}s`, background: "#141720", border: `1px solid ${done ? cat.color + "40" : "#1E2130"}`, borderRadius: 16, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, transition: "all 0.3s" }}>
                  <span style={{ fontSize: 24, width: 36, textAlign: "center" }}>{h.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 15, color: done ? "#64748B" : "#E2E8F0", textDecoration: done ? "line-through" : "none", transition: "all 0.3s" }}>{h.name}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, background: cat.color + "22", color: cat.color, padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>{cat.label}</span>
                      {streak > 0 && <span style={{ fontSize: 12, color: "#F5A623" }}>🔥 {streak}d</span>}
                      {hasReminder && <span className="reminder-tag">⏰ {reminders[h.id]}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={() => startEdit(h)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 15, padding: 4 }}>✏️</button>
                    <button onClick={() => deleteHabit(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 15, padding: 4 }}>🗑️</button>
                    <button className="check-btn" onClick={() => toggle(h.id)}
                      style={{ borderColor: done ? cat.color : "#2A2D3E", background: done ? cat.color + "22" : "transparent", color: done ? cat.color : "#2A2D3E" }}>
                      {done ? "✓" : ""}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WEEKLY */}
        {tab === "weekly" && (
          <div>
            {habits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#94A3B8" }}>No habits to show</p>
              </div>
            ) : (
              <>
                <div style={{ background: "#141720", border: "1px solid #1E2130", borderRadius: 16, padding: 16, marginBottom: 12, animation: "slideUp 0.4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 8 }}>
                    {last7.map(d => (
                      <div key={d} style={{ width: 28, textAlign: "center", fontSize: 11, color: d === today ? "#F5A623" : "#64748B", fontWeight: d === today ? 700 : 400 }}>
                        {DAY_LABELS[new Date(d + "T12:00:00").getDay()]}
                      </div>
                    ))}
                  </div>
                  {habits.map((h, hi) => {
                    const rate = getWeekRate(h.id);
                    const cat = CATEGORIES[h.category];
                    return (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, animation: `slideUp 0.4s ${hi * 0.05}s ease both` }}>
                        <span style={{ fontSize: 18 }}>{h.emoji}</span>
                        <p style={{ flex: 1, fontSize: 13, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {last7.map(d => {
                            const done = !!completions[d]?.[h.id];
                            return (
                              <div key={d} className="grid-cell" style={{ background: done ? cat.color + "33" : "#1E2130", border: `1px solid ${done ? cat.color + "66" : "transparent"}`, color: done ? cat.color : "#2A2D3E" }}>
                                {done ? "✓" : ""}
                              </div>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: 12, color: rate >= 70 ? "#4CAF82" : rate >= 40 ? "#F5A623" : "#EF4444", width: 34, textAlign: "right", fontWeight: 600 }}>{rate}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {habits.map(h => {
                    const streak = getStreak(h.id);
                    const longest = getLongestStreak(h.id);
                    const rate = getWeekRate(h.id);
                    const cat = CATEGORIES[h.category];
                    return (
                      <div key={h.id} className="stat-card">
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <span>{h.emoji}</span>
                          <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, color: "#F5A623" }}>🔥{streak}</p>
                            <p style={{ fontSize: 10, color: "#64748B" }}>streak</p>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, color: cat.color }}>{rate}%</p>
                            <p style={{ fontSize: 10, color: "#64748B" }}>week</p>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, color: "#C084FC" }}>{longest}</p>
                            <p style={{ fontSize: 10, color: "#64748B" }}>best</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <div style={{ animation: "slideUp 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Total Habits", value: habits.length, color: "#F5A623", icon: "🎯" },
                { label: "Weekly Rate", value: `${overallRate}%`, color: "#4CAF82", icon: "📈" },
                { label: "Done Today", value: `${todayDone}/${todayTotal}`, color: "#60A5FA", icon: "✅" },
                { label: "Best Streak", value: habits.length > 0 ? Math.max(...habits.map(h => getLongestStreak(h.id))) : 0, color: "#C084FC", icon: "🏆" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                  <p style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
                  <p style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>
            {habits.length > 0 && (
              <div className="stat-card" style={{ marginBottom: 12 }}>
                <p style={{ fontFamily: "Syne", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Habit Performance</p>
                {habits.map(h => {
                  const rate = getWeekRate(h.id);
                  const cat = CATEGORIES[h.category];
                  return (
                    <div key={h.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13 }}>{h.emoji} {h.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{rate}%</span>
                      </div>
                      <div className="bar"><div className="bar-fill" style={{ width: `${rate}%`, background: cat.color }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="stat-card">
              <p style={{ fontFamily: "Syne", fontWeight: 700, marginBottom: 12, fontSize: 15 }}>By Category</p>
              {Object.entries(CATEGORIES).map(([key, cat]) => {
                const count = habits.filter(h => h.category === key).length;
                if (count === 0) return null;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                    <p style={{ flex: 1, fontSize: 13 }}>{cat.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{count}</p>
                  </div>
                );
              })}
              {habits.length === 0 && <p style={{ color: "#64748B", fontSize: 13 }}>No habits yet</p>}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="add-btn" onClick={() => { setShowAdd(true); setEditId(null); setNewHabit({ name: "", emoji: "💧", category: "health", reminderTime: "" }); }}>+</button>

      {/* ADD/EDIT MODAL */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 800, marginBottom: 20 }}>{editId ? "Edit Habit" : "New Habit"}</h2>
            <input placeholder="Habit name (e.g. Drink Water)" value={newHabit.name}
              onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 14 }} />
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>Pick an emoji</p>
            <div className="emoji-grid" style={{ marginBottom: 14 }}>
              {EMOJIS.map(em => (
                <button key={em} className={`emoji-btn ${newHabit.emoji === em ? "selected" : ""}`}
                  onClick={() => setNewHabit(p => ({ ...p, emoji: em }))}>{em}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>Category</p>
            <select value={newHabit.category} onChange={e => setNewHabit(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 14 }}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>⏰ Daily Reminder <span style={{ color: "#3A3D4E" }}>(optional)</span></p>
            <div style={{ background: "#1E2130", border: `1px solid ${newHabit.reminderTime ? "#C084FC66" : "#2A2D3E"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, transition: "border 0.2s" }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <input type="time" value={newHabit.reminderTime}
                onChange={e => setNewHabit(p => ({ ...p, reminderTime: e.target.value }))}
                style={{ background: "transparent", border: "none", padding: 0, flex: 1, fontSize: 15 }} />
              {newHabit.reminderTime && (
                <button onClick={() => setNewHabit(p => ({ ...p, reminderTime: "" }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 20 }}>×</button>
              )}
            </div>
            <p style={{ fontSize: 11, marginBottom: 18, color: notifPermission === "granted" ? "#4CAF82" : "#F5A623" }}>
              {notifPermission === "granted" ? "✓ Notifications enabled" : "⚠️ Enable notifications first (tap 🔔 top right)"}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="action-btn" onClick={() => setShowAdd(false)} style={{ flex: 1, background: "#1E2130", color: "#94A3B8" }}>Cancel</button>
              <button className="action-btn" onClick={addHabit} style={{ flex: 2, background: "#F5A623", color: "#0A0D14" }}>{editId ? "Save Changes" : "Add Habit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS MODAL */}
      {showSettings && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal">
            <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 800, marginBottom: 6 }}>🔔 Notifications</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>Get reminded when it's time to complete your habits</p>
            <div style={{ background: "#1E2130", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Status</p>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: notifPermission === "granted" ? "#4CAF8222" : "#EF444422", color: notifPermission === "granted" ? "#4CAF82" : "#EF4444" }}>
                  {notifPermission === "granted" ? "✓ Enabled" : notifPermission === "denied" ? "✗ Blocked" : "Not set"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#64748B" }}>
                {notifPermission === "granted" ? "Reminders will fire at your set times each day." : notifPermission === "denied" ? "Blocked by browser. Go to Settings → Site permissions to re-enable." : "Click below to allow reminders."}
              </p>
            </div>
            {notifPermission !== "granted" && (
              <button className="action-btn" onClick={requestNotifPermission}
                style={{ width: "100%", background: "#F5A623", color: "#0A0D14", marginBottom: 14 }}>
                Enable Notifications
              </button>
            )}
            <div style={{ background: "#1E2130", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Active Reminders</p>
              {habits.filter(h => reminders[h.id]).length === 0
                ? <p style={{ fontSize: 13, color: "#64748B" }}>No reminders set. Edit any habit to add one.</p>
                : habits.filter(h => reminders[h.id]).map(h => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 12px", background: "#141720", borderRadius: 10 }}>
                    <span>{h.emoji}</span>
                    <p style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{h.name}</p>
                    <span className="reminder-tag">⏰ {reminders[h.id]}</span>
                    <button onClick={() => { setReminders(prev => { const n = { ...prev }; delete n[h.id]; return n; }); showToastMsg("Reminder removed", "info"); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 18 }}>×</button>
                  </div>
                ))
              }
            </div>
            <button className="action-btn" onClick={() => setShowSettings(false)} style={{ width: "100%", background: "#1E2130", color: "#94A3B8" }}>Close</button>
          </div>
        </div>
      )}

      {/* EXPORT CSV MODAL */}
      {showExport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowExport(false)}>
          <div className="modal">
            <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 800, marginBottom: 6 }}>📥 Export Data</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>Download your full habit history as a CSV file</p>
            <div style={{ background: "#1E2130", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>What's included</p>
              {["✅ Daily completion history","🔥 Streak data per habit","📁 Category & emoji info","⏰ Reminder times"].map(item => (
                <p key={item} style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 6 }}>{item}</p>
              ))}
            </div>
            <div style={{ background: "#1E2130", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Your Data</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
                {[
                  [habits.length, "Habits"],
                  [Object.keys(completions).length, "Days tracked"],
                  [Object.values(completions).reduce((s, d) => s + Object.values(d).filter(Boolean).length, 0), "Total done"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 800, color: "#F5A623" }}>{v}</p>
                    <p style={{ fontSize: 11, color: "#64748B" }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#0A0D14", borderRadius: 10, padding: 14, marginBottom: 14, overflowX: "auto" }}>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#4CAF82", marginBottom: 4 }}>
                Date, {habits.length > 0 ? habits.slice(0, 3).map(h => `${h.name}`).join(", ") + (habits.length > 3 ? "..." : "") : "Habit 1, Habit 2..."}
              </p>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B" }}>
                {today}, {habits.length > 0 ? habits.slice(0, 3).map(h => completions[today]?.[h.id] ? "Done" : "Missed").join(", ") : "Done, Missed..."}
              </p>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#2A2D3E", marginTop: 4 }}>...</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="action-btn" onClick={() => setShowExport(false)} style={{ flex: 1, background: "#1E2130", color: "#94A3B8" }}>Cancel</button>
              <button className="action-btn" onClick={() => { exportCSV(); setShowExport(false); }}
                style={{ flex: 2, background: habits.length === 0 ? "#1E2130" : "linear-gradient(135deg, #F5A623, #FF8C42)", color: habits.length === 0 ? "#64748B" : "#0A0D14", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span>📥</span> Download CSV
              </button>
            </div>
            {habits.length === 0 && <p style={{ textAlign: "center", fontSize: 12, color: "#64748B", marginTop: 10 }}>Add some habits first</p>}
          </div>
        </div>
      )}
    </div>
  );
}