import React, { useEffect, useMemo, useRef, useState } from "react";

const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
  const [h, m] = parts;
  return (Math.floor(h) % 24) * 60 + clamp(Math.floor(m), 0, 59);
};

const pad2 = (n) => String(n).padStart(2, "0");

const fromMinutes = (mins) => {
  const safe = Math.floor((mins % (24 * 60) + 24 * 60) % (24 * 60));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const palettes = [
  ["#4857FF", "#00BFA6", "#FF6B6B", "#FFD166", "#7F5AF0", "#2CB67D"],
  ["#0EA5E9", "#F59E0B", "#10B981", "#EC4899", "#8B5CF6", "#F43F5E"],
  ["#FF6B35", "#F7C59F", "#EFEFD0", "#004E89", "#1A659E", "#16DB93"],
  ["#3A86FF", "#8338EC", "#FF006E", "#FB5607", "#FFBE0B", "#2EC4B6"],
];

const hashColor = (s) => {
  const str = String(s || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) >>> 0;
  const pal = palettes[h % palettes.length];
  return pal[((h >>> 7) % pal.length + pal.length) % pal.length];
};

const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2, 9)}`;
};

const defaultTasks = [
  { id: uuid(), title: "Deep Work", start: "09:00", end: "11:00", color: hashColor("Deep Work") },
  { id: uuid(), title: "Workout", start: "12:30", end: "13:15", color: hashColor("Workout") },
  { id: uuid(), title: "Study DSA", start: "18:00", end: "19:30", color: hashColor("Study DSA") },
];

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : initialValue;
    } catch (e) {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }, [key, value]);
  return [value, setValue];
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function ThreadFate() {
  const [tasks, setTasks] = useLocalStorage("threadfate.tasks", defaultTasks);
  const [dateKey, setDateKey] = useLocalStorage("threadfate.date", new Date().toDateString());
  const [selectedId, setSelectedId] = useState(null);
  const [paletteIndex, setPaletteIndex] = useLocalStorage("threadfate.palette", 0);
  const [gridStart, setGridStart] = useLocalStorage("threadfate.gridStart", "06:00");
  const [gridEnd, setGridEnd] = useLocalStorage("threadfate.gridEnd", "22:00");
  const [weaveDensity, setWeaveDensity] = useLocalStorage("threadfate.density", 6);
  const [warpSpacing, setWarpSpacing] = useLocalStorage("threadfate.spacing", 8);
  const [speed, setSpeed] = useLocalStorage("threadfate.speed", 1);
  const [showLabels, setShowLabels] = useLocalStorage("threadfate.labels", true);

  const [layoutTick, setLayoutTick] = useState(0);
  const now = useNow(1000);
  const canvasRef = useRef(null);
  const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const today = new Date().toDateString();
    if (dateKey !== today) setDateKey(today);
  }, [dateKey, setDateKey]);

  useEffect(() => {
    const onResize = () => setLayoutTick((n) => n + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  const minDay = clamp(toMinutes(gridStart), 0, 24 * 60 - 1);
  const maxDay = clamp(toMinutes(gridEnd), 1, 24 * 60);
  const rawSpan = maxDay > minDay ? maxDay - minDay : 60;
  const daySpan = Math.max(60, rawSpan);

  const sorted = useMemo(() => [...tasks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)), [tasks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement || canvas;
    const W = Math.max(320, Math.floor(parent.clientWidth || 640));
    const H = clamp(Math.floor(parent.clientHeight || 420), 320, 1200);

    canvas.width = Math.floor(W * pixelRatio);
    canvas.height = Math.floor(H * pixelRatio);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, W, H);

    const hours = Math.ceil(daySpan / 60);
    const pal = palettes[Math.abs(Number(paletteIndex) % palettes.length)];
    const col = pal ? pal[0] : "#ffffff";

    ctx.font = "12px ui-sans-serif, system-ui, -apple-system";

    for (let i = 0; i <= hours; i++) {
      const x = Math.floor((i * 60 * (W - 64)) / daySpan) + 48;
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, H - 24);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#9db0ff";
      const m = (minDay + i * 60) % (24 * 60);
      const label = fromMinutes(m);
      if (showLabels) ctx.fillText(label, x - 14, 18);
    }
    ctx.globalAlpha = 1;

    const xOf = (mins) => 48 + ((mins - minDay) * (W - 64)) / daySpan;

    const weaveStep = Math.max(2, Number(weaveDensity) || 6);
    for (let y = 32; y < H - 32; y += weaveStep) {
      const t = y / Math.max(1, H - 64);
      const base = Math.sin(t * Math.PI * 2) * 2;
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(40, y + base);
      ctx.lineTo(W - 24, y - base);
      ctx.stroke();
    }

    const rowHeight = 24;
    const gaps = 10;
    const usableHeight = Math.max(120, H - 160);
    const maxRows = Math.max(1, Math.floor(usableHeight / (rowHeight + gaps)));

    sorted.forEach((task, idx) => {
      const s = clamp(toMinutes(task.start), minDay, minDay + daySpan);
      const e = clamp(toMinutes(task.end), minDay, minDay + daySpan);
      if (e <= s) return;
      const x1 = clamp(xOf(s), 48, W - 16);
      const x2 = clamp(xOf(e), 48, W - 16);
      const row = idx % maxRows;
      const y = 64 + row * (rowHeight + gaps);

      const grd = ctx.createLinearGradient(x1, y, x2, y + rowHeight);
      const safeColor = isValidHex(task.color) ? task.color : hashColor(task.title);
      grd.addColorStop(0, safeColor);
      grd.addColorStop(1, shade(safeColor, -20));
      ctx.fillStyle = grd;
      roundRect(ctx, x1, y, Math.max(4, x2 - x1), rowHeight, 10);
      ctx.fill();

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = shade(safeColor, -35);
      for (let i = Math.floor(x1); i < x2; i += Math.max(4, warpSpacing)) {
        ctx.beginPath();
        ctx.moveTo(i, y + 2);
        ctx.lineTo(i, y + rowHeight - 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (showLabels) {
        ctx.fillStyle = contrastColor(safeColor);
        ctx.font = "bold 12px ui-sans-serif, system-ui, -apple-system";
        ctx.fillText(task.title || "Untitled", x1 + 8, y + rowHeight / 2 + 4);
      }

      const nowMin = toMinutes(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
      if (nowMin >= s && nowMin <= e) {
        const xn = xOf(nowMin);
        drawShuttle(ctx, clamp(xn, 48, W - 16), y - 6, rowHeight + 12, Number(speed) || 1, safeColor);
      }
    });

    ctx.strokeStyle = "#2c3355";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);
  }, [tasks, now, paletteIndex, gridStart, gridEnd, weaveDensity, warpSpacing, speed, showLabels, layoutTick, pixelRatio]);

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || "").toLowerCase();
      if (key === "n") {
        e.preventDefault();
        addTask();
      } else if (key === "s") {
        e.preventDefault();
        exportPNG();
      } else if ((key === "delete" || key === "backspace") && selectedId) {
        e.preventDefault();
        setTasks((t) => t.filter((x) => x.id !== selectedId));
        setSelectedId(null);
      }
    };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("keydown", onKey);
    };
  }, [selectedId]);

  const addTask = () => {
    const id = uuid();
    const title = "New Thread";
    const start = fromMinutes(Math.max(minDay, toMinutes("09:00")));
    const end = fromMinutes(Math.min(minDay + daySpan, toMinutes("10:00")));
    setTasks((t) => [...t, { id, title, start, end, color: hashColor(title) }]);
    setSelectedId(id);
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      link.download = `ThreadFate-${stamp}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {}
  };

  const updateTask = (id, patch) => {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeTask = (id) => setTasks((t) => t.filter((x) => x.id !== id));

  const currentPalette = palettes[Math.abs(Number(paletteIndex) % palettes.length) || 0];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      <header className="p-4 md:p-6 flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">ThreadFate</h1>
          <p className="text-slate-300 text-sm md:text-base">Weave your day into a living textile. Add tasks as colored threads and watch time loom through them. Export the cloth when you're done.</p>
          <p className="text-slate-400 text-xs mt-1">Shortcuts: N = new thread, S = export PNG, Delete/Backspace = remove selected</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={addTask} className="px-3 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition shadow">+ New Thread</button>
          <button onClick={exportPNG} className="px-3 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 transition shadow">Export PNG</button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 grow">
        <section className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/40 overflow-hidden min-h-[420px] flex flex-col">
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-sm">Palette</span>
              <div className="flex items-center gap-1">
                {currentPalette.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-lg border border-slate-700" style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><span className="text-slate-300">Density</span><input type="range" min={3} max={12} value={weaveDensity} onChange={(e) => setWeaveDensity(parseInt(e.target.value || "6"))} /></label>
              <label className="flex items-center gap-2"><span className="text-slate-300">Spacing</span><input type="range" min={6} max={16} value={warpSpacing} onChange={(e) => setWarpSpacing(parseInt(e.target.value || "8"))} /></label>
              <label className="flex items-center gap-2"><span className="text-slate-300">Shuttle Speed</span><input type="range" min={0} max={3} step={0.5} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value || "1"))} /></label>
              <label className="flex items-center gap-2"><span className="text-slate-300">Labels</span><input type="checkbox" checked={!!showLabels} onChange={(e) => setShowLabels(!!e.target.checked)} /></label>
            </div>
          </div>
          <div className="grow"><canvas ref={canvasRef} className="w-full h-full block" /></div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col"><label className="text-xs text-slate-400">Day Start</label><input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" type="time" value={gridStart} onChange={(e) => setGridStart(e.target.value)} /></div>
            <div className="flex flex-col"><label className="text-xs text-slate-400">Day End</label><input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" type="time" value={gridEnd} onChange={(e) => setGridEnd(e.target.value)} /></div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-sm text-slate-300">Theme</span><select className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" value={paletteIndex} onChange={(e) => setPaletteIndex(parseInt(e.target.value || "0"))}>{palettes.map((_, i) => (<option key={i} value={i}>Palette {i + 1}</option>))}</select></div>
            <button onClick={() => setTasks((t) => t.map((x) => ({ ...x, color: hashColor(x.title) }))) } className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition">Re-harmonize Colors</button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Threads</h2><button onClick={addTask} className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm">+ Add</button></div>

            <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
              {sorted.map((t) => (
                <div key={t.id} onClick={() => setSelectedId(t.id)} className={`p-3 rounded-2xl border transition ${selectedId === t.id ? "border-indigo-500 bg-slate-800/60" : "border-slate-800 bg-slate-800/20"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded" style={{ background: isValidHex(t.color) ? t.color : hashColor(t.title) }} />
                    <input className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={t.title} onChange={(e) => updateTask(t.id, { title: e.target.value })} />
                    <button onClick={() => removeTask(t.id)} className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs">Delete</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col"><label className="text-[10px] text-slate-400">Start</label><input className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" type="time" value={t.start} onChange={(e) => updateTask(t.id, { start: e.target.value || "00:00" })} /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-slate-400">End</label><input className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" type="time" value={t.end} onChange={(e) => updateTask(t.id, { end: e.target.value || "00:00" })} /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-slate-400">Color</label><input className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" type="color" value={isValidHex(t.color) ? t.color : "#ffffff"} onChange={(e) => updateTask(t.id, { color: e.target.value })} /></div>
                  </div>
                </div>
              ))}
              {sorted.length === 0 && (<div className="text-slate-400 text-sm">No threads yet. Click “+ Add” to start weaving.</div>)}
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-2">Built with love. Your data stays in your browser.</div>
        </section>
      </main>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(h) / 2, Math.abs(w) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => clamp(Math.round(v + (amt / 100) * 255), 0, 255);
  return rgbToHex(f(r), f(g), f(b));
}

function contrastColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#0b1020" : "#f8fafc";
}

function isValidHex(hex) {
  if (typeof hex !== "string") return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

function hexToRgb(hex) {
  try {
    const h = String(hex || "").replace('#', '').trim();
    const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
    const bigint = parseInt(full, 16);
    if (Number.isNaN(bigint)) return { r: 255, g: 255, b: 255 };
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  } catch (e) {
    return { r: 255, g: 255, b: 255 };
  }
}

function rgbToHex(r, g, b) {
  const toHex = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function drawShuttle(ctx, x, y, h, speed, color) {
  const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : Date.now() / 1000;
  const wobble = Math.sin(t * (1 + Number(speed || 1))) * 3;
  const w = 10 + 6 * (Number(speed || 1));
  const safeColor = isValidHex(color) ? color : '#ffffff';
  const grd = ctx.createLinearGradient(x - w, y, x + w, y + h);
  grd.addColorStop(0, shade(safeColor, 20));
  grd.addColorStop(1, shade(safeColor, -20));
  ctx.fillStyle = grd;
  roundRect(ctx, x - w, y + wobble, w * 2, Math.max(6, h - wobble * 2), w);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - w / 2, y + 4 + wobble, w, Math.max(4, h / 3), w / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = shade(safeColor, -40);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + h + 6);
  ctx.stroke();
}
