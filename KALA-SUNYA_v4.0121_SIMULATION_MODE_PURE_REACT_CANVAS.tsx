
import { useEffect, useRef, useState, useMemo } from "react";

const TOTAL_DURATION = 10;
const BPM = 90;
const HEARTBEAT_HZ = BPM / 60; // 1.5Hz

type PhaseId = 0 | 1 | 2;

function getPhase(t: number): { id: PhaseId; name: string; sub: string; p: number } {
  if (t < 3) return { id: 0, name: "Khởi nguồn & Quán tính", sub: "Static_Toroid_Mobius_Lattice", p: t / 3 };
  if (t < 7) return { id: 1, name: "Biến dạng Độ nhớt & Xoáy", sub: "Wave_Deformation_Shattering · Polyhedron_Unfolding", p: (t - 3) / 4 };
  return { id: 2, name: "Bồi tụ Ổn định & Entropy", sub: "Nested_Hyper_Dodecahedron_Fluid_Sphere", p: (t - 7) / 3 };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, a=0, b=1){ return Math.max(a, Math.min(b, v)); }

// 3D helpers
type Vec3 = { x: number; y: number; z: number };
function rotY(v: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}
function rotX(v: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}
function project(v: Vec3, w: number, h: number, scale: number, cx: number, cy: number) {
  const perspective = 400;
  const p = perspective / (perspective + v.z);
  return { x: cx + v.x * p * scale, y: cy + v.y * p * scale, z: v.z, p };
}

// Icosahedron
function makeIcosahedron(): Vec3[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: Vec3[] = [
    { x: 0, y: 1, z: phi }, { x: 0, y: -1, z: phi }, { x: 0, y: 1, z: -phi }, { x: 0, y: -1, z: -phi },
    { x: 1, y: phi, z: 0 }, { x: -1, y: phi, z: 0 }, { x: 1, y: -phi, z: 0 }, { x: -1, y: -phi, z: 0 },
    { x: phi, y: 0, z: 1 }, { x: -phi, y: 0, z: 1 }, { x: phi, y: 0, z: -1 }, { x: -phi, y: 0, z: -1 },
  ];
  return verts.map(v => {
    const len = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  });
}
function makeDodecahedron(): Vec3[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const invPhi = 1 / phi;
  const verts: Vec3[] = [];
  // cube corners
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push({ x, y, z });
  // rects
  for (const y of [-invPhi, invPhi]) for (const z of [-phi, phi]) verts.push({ x: 0, y, z });
  for (const x of [-invPhi, invPhi]) for (const y of [-phi, phi]) verts.push({ x, y, z: 0 });
  for (const x of [-phi, phi]) for (const z of [-invPhi, invPhi]) verts.push({ x, y: 0, z });
  return verts.map(v => {
    const len = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  });
}
function computeEdges(verts: Vec3[], targetCount: number): [number, number][] {
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const dx = verts[i].x - verts[j].x, dy = verts[i].y - verts[j].y, dz = verts[i].z - verts[j].z;
    pairs.push({ i, j, d: dx * dx + dy * dy + dz * dz });
  }
  pairs.sort((a, b) => a.d - b.d);
  return pairs.slice(0, targetCount).map(p => [p.i, p.j] as [number, number]);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showTau, setShowTau] = useState(true);
  const [showTrace, setShowTrace] = useState(true);
  const [showBeta, setShowBeta] = useState(true);
  const [showNabla, setShowNabla] = useState(true);
  const [showAxis, setShowAxis] = useState(true);
  const [showPhysics, setShowPhysics] = useState(true);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const trailsRef = useRef<{ x: number; y: number; t: number }[][]>(Array.from({ length: 12 }, () => []));

  const icosa = useMemo(() => makeIcosahedron(), []);
  const dodeca = useMemo(() => makeDodecahedron(), []);
  const icosaEdges = useMemo(() => computeEdges(icosa, 30), [icosa]);
  const dodecaEdges = useMemo(() => computeEdges(dodeca, 30), [dodeca]);

  // loop
  useEffect(() => {
    const loop = (now: number) => {
      if (!lastRef.current) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (isPlaying) {
        setTime(prev => {
          const nt = prev + dt * speed;
          return nt >= TOTAL_DURATION ? nt % TOTAL_DURATION : nt;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, speed]);

  // canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width * dpr;
    const H = rect.height * dpr;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    // clear
    const bg = ctx.createRadialGradient(w * 0.35, h * 0.5, 0, w * 0.35, h * 0.5, w * 1.2);
    bg.addColorStop(0, "#0a0a14");
    bg.addColorStop(0.4, "#080810");
    bg.addColorStop(1, "#050508");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const phase = getPhase(time);
    const hb = Math.sin(time * Math.PI * 2 * HEARTBEAT_HZ); // -1..1
    const hbPulse = (Math.sin(time * Math.PI * 2 * HEARTBEAT_HZ - Math.PI * 0.25) * 0.5 + 0.5); // 0..1 pulse
    const hbSharp = Math.pow(hbPulse, 3);

    // physics derived
    const freq = phase.id === 0 ? 38 : phase.id === 1 ? lerp(38, 432, phase.p) : 432;
    const entropy = lerp(0.9967, 0.9971, phase.id === 0 ? phase.p * 0.2 : phase.id === 1 ? 0.2 + 0.6 * phase.p : 0.8 + 0.2 * phase.p);
    const drift = lerp(0.00023, 0.00021, phase.id === 0 ? 0 : phase.id === 1 ? phase.p : 1);
    const coherence = phase.id === 0 ? lerp(0.62, 0.71, phase.p) : phase.id === 1 ? lerp(0.71, 0.94, phase.p) : lerp(0.94, 0.98, phase.p);

    // caustic dancing background
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 3; i++) {
      const cx = w * (0.3 + Math.sin(time * 0.3 + i * 2) * 0.15);
      const cy = h * (0.5 + Math.cos(time * 0.22 + i) * 0.18);
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.35);
      rg.addColorStop(0, i === 0 ? "rgba(0,229,255,0.25)" : i === 1 ? "rgba(255,215,0,0.18)" : "rgba(138,43,226,0.18)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Right side field tension area background
    const fieldX0 = w * 0.62;
    const fieldW = w * 0.38;
    if (showTau || showBeta || showNabla) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(fieldX0, 0, fieldW, h);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(fieldX0, 0);
      ctx.lineTo(fieldX0, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Nabla pattern basin valleys
    if (showNabla) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      const baseY = h * 0.5;
      for (let k = 0; k < 6; k++) {
        const alpha = 0.08 + k * 0.03;
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = fieldX0; x < w; x += 3) {
          const nx = (x - fieldX0) / fieldW;
          const valley = Math.sin(nx * Math.PI * 3 + k) * 12 * (k + 1) * 0.15 + Math.cos(nx * Math.PI * 2 + time * 0.5) * 6;
          const y = baseY + valley + (k - 3) * 22 + Math.sin(time * 0.8 + nx * 6) * 2 * phase.p;
          if (x === fieldX0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // basin label
      ctx.fillStyle = "rgba(0,229,255,0.5)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText("∇ PATTERN BASIN", fieldX0 + 12, h * 0.18);
      ctx.restore();
    }

    // Topology bias beta warped terrain
    if (showBeta) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let y = h * 0.22; y < h * 0.88; y += 18) {
        ctx.strokeStyle = "rgba(138,43,226,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = fieldX0; x < w; x += 4) {
          const nx = (x - fieldX0) / fieldW;
          const bias = Math.sin(nx * 8 + y * 0.02 + time * 0.6) * (phase.id === 1 ? 18 : 8) * (phase.id === 0 ? 0.3 : 1);
          const yy = y + bias + hb * 2;
          if (x === fieldX0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(138,43,226,0.55)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText("β TOPOLOGY BIAS", fieldX0 + 12, h * 0.26);
      ctx.restore();
    }

    // Field tension Tau grid
    if (showTau) {
      ctx.save();
      const tension = phase.id === 0 ? 0.15 : phase.id === 1 ? lerp(0.15, 1.2, phase.p) : lerp(1.2, 0.25, phase.p);
      const cols = 10, rows = 9;
      ctx.strokeStyle = `rgba(255,215,0,${0.12 + tension * 0.08})`;
      ctx.lineWidth = 1;
      // vertical lines stretched
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        const xBase = fieldX0 + (c / cols) * fieldW;
        for (let r = 0; r <= rows; r++) {
          const yBase = (r / rows) * h * 0.72 + h * 0.14;
          const stretch = Math.sin(c * 0.8 + time * 0.7) * tension * 12 + hbSharp * 8 * tension;
          const x = xBase + stretch * Math.sin(r * 0.6);
          const y = yBase + (phase.id === 1 ? Math.sin(c * 0.5 + r * 0.3 + time) * 6 : 0);
          if (r === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // horizontal
      ctx.strokeStyle = `rgba(255,215,0,${0.08 + tension * 0.05})`;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        const yBase = (r / rows) * h * 0.72 + h * 0.14;
        for (let c = 0; c <= cols; c++) {
          const xBase = fieldX0 + (c / cols) * fieldW;
          const y = yBase + Math.sin(c * 0.7 + time * 0.5) * tension * 4;
          if (c === 0) ctx.moveTo(xBase, y);
          else ctx.lineTo(xBase, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,215,0,0.6)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText(`Τ FIELD TENSION ${(tension * 100).toFixed(0)}%`, fieldX0 + 12, h * 0.34);
      ctx.restore();
    }

    // center
    const cx = w * 0.32;
    const cy = h * 0.5;

    // equilibrium membrane
    ctx.save();
    const membraneScaleBase = w * 0.18;
    const memPulse = 1 + hb * 0.04 + (phase.id === 2 ? 0.02 * Math.sin(time * 2.2) : 0);
    const memRadius = membraneScaleBase * memPulse * (phase.id === 0 ? 0.9 : phase.id === 1 ? lerp(0.9, 1.25, phase.p) : lerp(1.25, 1.05, phase.p));
    const memGrad = ctx.createRadialGradient(cx, cy, memRadius * 0.7, cx, cy, memRadius * 1.4);
    memGrad.addColorStop(0, "rgba(0,229,255,0)");
    memGrad.addColorStop(0.6, phase.id === 2 ? "rgba(255,215,0,0.14)" : "rgba(0,229,255,0.12)");
    memGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = memGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, memRadius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = phase.id === 2 ? "rgba(255,215,0,0.35)" : "rgba(0,229,255,0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash(phase.id === 1 ? [6, 6] : []);
    ctx.beginPath();
    ctx.arc(cx, cy, memRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // membrane glow outer
    ctx.shadowColor = phase.id === 2 ? "#FFD700" : "#00E5FF";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = phase.id === 2 ? "rgba(255,215,0,0.18)" : "rgba(0,229,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, memRadius * 1.02, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Triple axis
    if (showAxis) {
      ctx.save();
      const axisLen = w * 0.13 * (1 + hb * 0.05);
      const axes = [
        { color: "#00E5FF", ang: 0, label: "X CYAN" },
        { color: "#FFD700", ang: Math.PI * 0.65, label: "Y GOLD" },
        { color: "#8A2BE2", ang: -Math.PI * 0.65, label: "Z VIOLET" },
      ];
      axes.forEach(ax => {
        const ex = cx + Math.cos(ax.ang) * axisLen;
        const ey = cy + Math.sin(ax.ang) * axisLen * 0.6;
        ctx.strokeStyle = ax.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = ax.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // arrow
        ctx.fillStyle = ax.color;
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = ax.color;
        ctx.globalAlpha = 0.8;
        ctx.fillText(ax.label, ex + 6, ey + 3);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    // Memory cells orbiting (12)
    const cellRadiusBase = w * 0.007;
    const orbitRadius = w * 0.11 * (phase.id === 1 ? lerp(1, 1.45, phase.p) : phase.id === 2 ? 1.15 : 1);
    const cells: { x: number; y: number; z: number; bright: number }[] = [];
    for (let i = 0; i < 12; i++) {
      // distribute around sphere
      const base = icosa[i];
      let v = { ...base };
      v = rotY(v, time * 0.4 + i * 0.12);
      v = rotX(v, time * 0.22 + i * 0.05);
      const proj = project({ x: v.x * orbitRadius, y: v.y * orbitRadius, z: v.z * orbitRadius }, w, h, 1, cx, cy);
      const bright = phase.id === 0 ? 0.35 + Math.sin(time * 2 + i) * 0.1 : phase.id === 1 ? lerp(0.35, 1, phase.p) + hbSharp * 0.3 : 1;
      cells.push({ x: proj.x, y: proj.y, z: proj.z, bright });

      // update trails
      if (showTrace) {
        const tr = trailsRef.current[i];
        tr.push({ x: proj.x, y: proj.y, t: time });
        if (tr.length > 18) tr.shift();
        // fading
        ctx.save();
        for (let k = 0; k < tr.length - 1; k++) {
          const a = (k / tr.length) * bright * 0.6;
          ctx.strokeStyle = `rgba(0,229,255,${a * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tr[k].x, tr[k].y);
          ctx.lineTo(tr[k + 1].x, tr[k + 1].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // sort back to front
    const sortedCells = cells.map((c, idx) => ({ ...c, idx })).sort((a, b) => a.z - b.z);

    sortedCells.forEach(c => {
      ctx.save();
      const isLit = phase.id === 2 || (phase.id === 1 && phase.p > 0.5);
      const col = isLit ? "0,229,255" : "80,160,200";
      const r = cellRadiusBase * (0.9 + c.bright * 0.6) * (1 + hbSharp * 0.25) * (c.z > 0 ? 1.15 : 0.85);
      // glow
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 12 * c.bright;
      ctx.fillStyle = `rgba(${col},${0.25 + c.bright * 0.6})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(0,229,255,${0.7 + c.bright * 0.3})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      // inner core
      ctx.fillStyle = "#e6fbff";
      ctx.beginPath();
      ctx.arc(c.x - r * 0.2, c.y - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // central polyhedron
    ctx.save();
    const polyScale = w * 0.055 * (1 + hb * 0.06) * (phase.id === 1 ? 1 + phase.p * 0.25 : 1);
    const rotYAng = time * (phase.id === 1 ? 0.9 : 0.35);
    const rotXAng = Math.sin(time * 0.4) * 0.6 + (phase.id === 1 ? phase.p * 0.8 : 0);

    const drawPoly = (verts: Vec3[], edges: [number, number][], color: string, alpha: number, shatter = 0) => {
      const projected = verts.map(v => {
        let rv = rotY(v, rotYAng);
        rv = rotX(rv, rotXAng);
        // shatter jitter
        if (shatter > 0) {
          const jitter = shatter * 18 * (Math.sin(time * 5 + rv.x * 10) * 0.5);
          rv.x += (Math.random() - 0.5) * shatter * 0.15;
          rv.y += (Math.random() - 0.5) * shatter * 0.15;
          rv.z += jitter * 0.02;
        }
        return project({ x: rv.x * polyScale, y: rv.y * polyScale, z: rv.z * polyScale }, w, h, 1, cx, cy);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * alpha;
      ctx.globalAlpha = alpha;
      edges.forEach(([a, b]) => {
        const pa = projected[a], pb = projected[b];
        if (pa.p < 0.2 || pb.p < 0.2) return;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      // faces faint fill
      ctx.fillStyle = color.replace(")", `, ${0.04 * alpha})`).replace("rgb", "rgba").replace("#00E5FF", "rgba(0,229,255,0.06)").replace("#FFD700", "rgba(255,215,0,0.08)");
      if (color.includes("00E5FF") || color.includes("0,229,255")) {
        ctx.fillStyle = `rgba(0,229,255,${0.06 * alpha})`;
      } else {
        ctx.fillStyle = `rgba(255,215,0,${0.08 * alpha})`;
      }
    };

    if (phase.id === 0) {
      // Blue static icosahedron
      drawPoly(icosa, icosaEdges, "#00E5FF", 0.9);
      // inner core
      ctx.fillStyle = "rgba(0,180,255,0.15)";
      ctx.beginPath();
      ctx.arc(cx, cy, polyScale * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (phase.id === 1) {
      // morph shattering gold transition
      const t = phase.p;
      const shatter = Math.sin(t * Math.PI) * 0.9;
      const c1 = `rgba(${Math.round(lerp(0, 255, t))},${Math.round(lerp(229, 215, t))},${Math.round(lerp(255, 0, t))},1)`;
      // blend: show both with alpha
      drawPoly(icosa, icosaEdges, c1, lerp(0.9, 0.2, t), shatter);
      drawPoly(dodeca, dodecaEdges, c1, lerp(0.2, 0.95, t), shatter * 0.6);
      // kinetic burst lines
      if (t > 0.2 && t < 0.85) {
        ctx.save();
        ctx.globalAlpha = (1 - Math.abs(t - 0.5) * 1.6) * 0.6;
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2 + time * 1.8;
          const r1 = polyScale * 0.6;
          const r2 = polyScale * (2.2 + Math.random() * 0.8);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.6);
          ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.6);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      // phase 2 stable gold
      // outer fluid sphere
      ctx.save();
      const fluidR = polyScale * 2.15 * (1 + Math.sin(time * 1.5) * 0.03);
      const fg = ctx.createRadialGradient(cx, cy, fluidR * 0.3, cx, cy, fluidR);
      fg.addColorStop(0, "rgba(255,215,0,0.22)");
      fg.addColorStop(0.5, "rgba(255,215,0,0.08)");
      fg.addColorStop(1, "rgba(255,215,0,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(cx, cy, fluidR, 0, Math.PI * 2);
      ctx.fill();
      // caustic highlight inside fluid
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(255,255,200,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx + fluidR * 0.2, cy - fluidR * 0.18, fluidR * 0.35, fluidR * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawPoly(dodeca, dodecaEdges, "#FFD700", 0.95);
      // nested inner icosa
      ctx.save();
      ctx.globalAlpha = 0.35;
      drawPoly(icosa, icosaEdges, "#FFD700", 0.4);
      ctx.restore();
    }

    ctx.restore();

    // particles dust
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 40; i++) {
      const px = (Math.sin(i * 12.7 + time * 0.2 + i) * 0.5 + 0.5) * w;
      const py = (Math.cos(i * 7.3 + time * 0.15) * 0.5 + 0.5) * h;
      const isGold = phase.id === 2 || (phase.id === 1 && i % 2 === 0);
      ctx.fillStyle = isGold ? "rgba(255,215,0,0.5)" : "rgba(0,229,255,0.45)";
      ctx.beginPath();
      ctx.arc(px, py, (Math.sin(time + i) * 0.5 + 1) * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // bottom scanline
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#00E5FF";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();

    // heartbeat line mini bottom
    ctx.save();
    const hbY = h * 0.92;
    ctx.strokeStyle = "rgba(0,229,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w * 0.5; x += 2) {
      const tlocal = (x / (w * 0.5)) * 2.5;
      const beat = Math.sin(tlocal * Math.PI * 2 * HEARTBEAT_HZ - time * 3) * 8 * Math.exp(-Math.abs((tlocal % 1) - 0.5) * 4);
      const y = hbY + beat * (hbPulse > 0.8 ? 1.6 : 0.8);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // subtle vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.3, w * 0.5, h * 0.5, w * 0.9);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

  }, [time, showAxis, showBeta, showNabla, showTau, showTrace, icosa, dodeca, icosaEdges, dodecaEdges]);

  const phase = getPhase(time);
  const freq = phase.id === 0 ? 38 : phase.id === 1 ? lerp(38, 432, phase.p) : 432;
  const entropy = lerp(0.9967, 0.9971, phase.id === 0 ? phase.p * 0.2 : phase.id === 1 ? 0.2 + 0.6 * phase.p : 0.8 + 0.2 * phase.p);
  const drift = lerp(0.00023, 0.00021, phase.id === 0 ? 0 : phase.id === 1 ? phase.p : 1);
  const coherence = phase.id === 0 ? lerp(0.62, 0.71, phase.p) : phase.id === 1 ? lerp(0.71, 0.94, phase.p) : lerp(0.94, 0.98, phase.p);

  const physics = useMemo(() => {
    if (phase.id === 0) {
      return { m: 1.0, I: 0.42, eta: 0.84, Cd: 0.31, Re: 1240, E: 38.2, sigma_m: 0.118, T: 0.15, dS: 0.0021 };
    } else if (phase.id === 1) {
      const p = phase.p;
      return {
        m: lerp(1.0, 1.18, p),
        I: lerp(0.42, 0.68, p),
        eta: lerp(0.84, 0.12, p),
        Cd: lerp(0.31, 1.45, Math.sin(p * Math.PI)),
        Re: lerp(1240, 4850, p),
        E: lerp(38.2, 432, p),
        sigma_m: lerp(0.118, 0.342, p),
        T: lerp(0.15, 0.82, p),
        dS: lerp(0.0021, 0.018, p),
      };
    } else {
      const p = phase.p;
      return {
        m: lerp(1.18, 1.0, p * 0.2),
        I: lerp(0.68, 0.51, p * 0.3),
        eta: lerp(0.12, 0.18, p),
        Cd: lerp(0.45, 0.38, p),
        Re: lerp(4850, 2100, p),
        E: 432,
        sigma_m: lerp(0.342, 0.112, p),
        T: lerp(0.82, 0.22, p),
        dS: lerp(0.018, 0.0012, p),
      };
    }
  }, [phase.id, phase.p]);

  return (
    <div className="min-h-screen w-full bg-[#050508] text-zinc-100 selection:bg-cyan-500/30 flex flex-col"
      style={{ fontFamily: "Inter, JetBrains Mono, monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;600&display=swap');
        *{font-family: Space Grotesk, system-ui, sans-serif}
        .mono{font-family: JetBrains Mono, monospace}
      `}</style>

      {/* Header */}
      <div className="w-full border-b border-white/10 bg-[#08080f]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center font-bold mono text-[10px] text-black">KS</div>
            <div>
              <div className="text-[13px] md:text-[14px] font-semibold tracking-wide leading-tight">KALA-SUNYA v4.0121 — VIDEO SIMULATION — 10s 90BPM 1.5Hz</div>
              <div className="text-[10px] mono text-white/50 tracking-widest">FIELD TENSION + RESIDUAL TRACE + TOPOLOGY BIAS + PATTERN BASIN</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mono text-[10px]">
            <span className="px-2 py-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">● REC SIM</span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">{time.toFixed(2)}s / 10.00s</span>
            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">{freq.toFixed(0)} Hz</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
        {/* Main */}
        <div className="flex flex-col">
          {/* Stats bar */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-white/10 border-b border-white/10">
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40 tracking-widest">PHASE</div>
              <div className="text-[11px] font-semibold text-cyan-300 truncate">{phase.id === 0 ? "0-3s ORIGIN" : phase.id === 1 ? "3-7s DEFORM" : "7-10s STABLE"}</div>
            </div>
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40">ENTROPY-0</div>
              <div className="mono text-[12px] text-white">{entropy.toFixed(4)}</div>
            </div>
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40">DRIFT δ</div>
              <div className="mono text-[12px] text-amber-300">{drift.toFixed(5)}</div>
            </div>
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40">TRI-AXIS COH</div>
              <div className="mono text-[12px] text-violet-300">{coherence.toFixed(3)}</div>
            </div>
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40">BPM / Hz</div>
              <div className="mono text-[12px]">90 / 1.5Hz</div>
            </div>
            <div className="bg-[#0a0a12] px-3 py-2">
              <div className="mono text-[9px] text-white/40">STATE</div>
              <div className={`mono text-[11px] ${phase.id === 2 ? "text-amber-300" : phase.id === 1 ? "text-orange-300" : "text-cyan-300"}`}>{phase.name}</div>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative bg-[#050508] aspect-[16/9] w-full overflow-hidden border-b border-white/10">
            <canvas ref={canvasRef} className="w-full h-full block" style={{ width: "100%", height: "100%" }} />
            {/* overlay labels */}
            <div className="absolute left-3 top-3 mono text-[9px] leading-tight pointer-events-none">
              <div className="px-2 py-1 rounded bg-black/60 border border-cyan-500/20 text-cyan-200 backdrop-blur">CENTER: {phase.id === 0 ? "ICOSAHEDRON BLUE" : phase.id === 1 ? "MORPH → DODECA" : "HYPER-DODECA FLUID"}</div>
            </div>
            <div className="absolute left-3 bottom-12 mono text-[8px] text-white/30 pointer-events-none">
              Vajra 38Hz {phase.id === 1 ? "→ 432Hz Expansion" : phase.id === 2 ? "→ 432Hz HUM Stabilized" : "Low Resonance"} · 12 Memory Cells
            </div>
            {/* phase progress line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all" style={{ width: `${(time / 10) * 100}%` }} />
            </div>
            {/* phase markers */}
            <div className="absolute bottom-[2px] left-0 right-0 flex mono text-[8px] text-white/30">
              <div className="border-r border-white/10 px-2 py-1" style={{ width: "30%" }}>0-3s KHỞI NGUỒN</div>
              <div className="border-r border-white/10 px-2 py-1" style={{ width: "40%" }}>3-7s BIẾN DẠNG XOÁY</div>
              <div className="px-2 py-1" style={{ width: "30%" }}>7-10s BỒI TỤ</div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-[#0c0c14] border-b border-white/10 px-3 md:px-4 py-3 flex flex-wrap gap-3 items-center">
            <button onClick={() => setIsPlaying(!isPlaying)} className="h-8 px-4 rounded bg-white text-black mono text-[11px] font-bold tracking-wide hover:bg-zinc-200 transition">
              {isPlaying ? "❙❙ PAUSE" : "▶ PLAY"}
            </button>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="mono text-[10px] text-white/40">SCRUB</span>
              <input type="range" min={0} max={10} step={0.01} value={time} onChange={e => { setTime(parseFloat(e.target.value)); setIsPlaying(false); }} className="flex-1 accent-cyan-400 h-1" />
              <span className="mono text-[10px] w-[48px] text-right">{time.toFixed(2)}s</span>
            </div>

            <div className="flex items-center gap-1">
              {([0.5, 1, 2] as const).map(s => (
                <button key={s} onClick={() => setSpeed(s)} className={`h-7 px-2.5 rounded mono text-[10px] border ${speed === s ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>{s}x</button>
              ))}
            </div>

            <div className="h-6 w-px bg-white/10 hidden md:block" />

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Τ Tau", val: showTau, set: setShowTau },
                { label: "τ Trace", val: showTrace, set: setShowTrace },
                { label: "β Bias", val: showBeta, set: setShowBeta },
                { label: "∇ Basin", val: showNabla, set: setShowNabla },
              ].map(t => (
                <button key={t.label} onClick={() => t.set(!t.val)} className={`h-7 px-2.5 rounded mono text-[10px] border ${t.val ? "bg-amber-500/15 border-amber-400/30 text-amber-200" : "bg-white/5 border-white/10 text-white/40"}`}>{t.label}</button>
              ))}
              <button onClick={() => setShowAxis(!showAxis)} className={`h-7 px-2.5 rounded mono text-[10px] border ${showAxis ? "bg-violet-500/15 border-violet-400/30 text-violet-200" : "bg-white/5 border-white/10 text-white/40"}`}>AXIS</button>
              <button onClick={() => setShowPhysics(!showPhysics)} className={`h-7 px-2.5 rounded mono text-[10px] border ${showPhysics ? "bg-cyan-500/15 border-cyan-400/30 text-cyan-200" : "bg-white/5 border-white/10 text-white/40"}`}>PHYS</button>
            </div>
          </div>

          {/* Physics */}
          {showPhysics && (
            <div className="bg-[#08080f] border-b border-white/10 px-4 py-3 grid grid-cols-3 md:grid-cols-9 gap-3 mono">
              {[
                { k: "m", v: physics.m.toFixed(2), u: "kg·eff" },
                { k: "I", v: physics.I.toFixed(2), u: "kg·m²" },
                { k: "η", v: physics.eta.toFixed(2), u: "Pa·s" },
                { k: "Cd", v: physics.Cd.toFixed(2), u: "drag" },
                { k: "Re", v: physics.Re.toFixed(0), u: "" },
                { k: "E", v: physics.E.toFixed(0), u: "Hz" },
                { k: "σₘ", v: physics.sigma_m.toFixed(3), u: "stress" },
                { k: "T", v: physics.T.toFixed(2), u: "tension" },
                { k: "ΔS", v: physics.dS.toFixed(4), u: "J/K" },
              ].map(p => (
                <div key={p.k} className="bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-2">
                  <div className="text-[9px] text-white/40 tracking-widest">{p.k} {p.u && <span className="opacity-40">{p.u}</span>}</div>
                  <div className="text-[12px] font-semibold text-white mt-0.5">{p.v}</div>
                  <div className="h-[2px] mt-1.5 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, (parseFloat(p.v) / (p.k === "Re" ? 5000 : p.k === "E" ? 500 : 2)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-[#0a0a12] border-l border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="mono text-[11px] font-semibold tracking-widest text-white/80">v4.0121 VALIDATION LEGEND</div>
            <div className="mono text-[9px] text-white/40 mt-1">10s MASTER VIDEO · Triple-Validation Topology</div>
          </div>

          <div className="p-4 space-y-4 overflow-auto">
            <div className="space-y-2.5">
              {[
                { dot: "bg-cyan-400", title: "Central Polyhedron", desc: "Icosahedron (12v) → Dodecahedron (20v) morph. Phase 0 static blue crystalline matrix, Phase 1 shattering unfolding with kinetic burst, Phase 2 nested hyper-dodeca + fluid sphere gold harmonic 432Hz." },
                { dot: "bg-cyan-300", title: "12 Memory Cells", desc: "Orbiting cyan cells = icosahedron vertices. Dim 0.35 brightness at origin, brightening 0.35→1.0 during viscosity deformation, 10/12 fully lit cyan in stable phase (2 dormant as reserve)." },
                { dot: "bg-amber-400", title: "Τ Field Tension", desc: "Right-side elastic grid. Low tension 15% (blue phase), stretched 120% elastic deformation in 3-7s (HA burst), relaxation to 25% in gold stabilization. Measures Tau field elasticity." },
                { dot: "bg-cyan-400", title: "τ Residual Trace", desc: "Afterglow trails on memory cells. Afterglow τ = persistent quantum trace. Enabled by Show Trace. Fading after 7s indicates entropy stabilization and decoherence cleanup." },
                { dot: "bg-violet-500", title: "β Topology Bias", desc: "Warped terrain lines (violet). Beta bias = pre-curved manifold. Phase 1 amplitude 18px warping, phase 0/2 only 8px. Guides particle basin formation." },
                { dot: "bg-cyan-500", title: "∇ Pattern Basin", desc: "Valley contours (∇ Nabla). Attractor basins where patterns settle. 6 nested valleys, deeper in phase 2 = stable attractor. Gold phase shows basin locking." },
                { dot: "bg-gradient-to-r from-cyan-400 to-amber-400", title: "Equilibrium Membrane", desc: "Translucent pulsating membrane around center. Pulses at 1.5Hz heartbeat. Cyan low-resonance → gold high-resonance. Dashing during phase 1 = non-equilibrium." },
                { dot: "bg-white", title: "Triple-Axis", desc: "X cyan horizontal, Y gold diagonal, Z violet vertical. Coherence 0.62→0.98. Measures alignment of 3 orthogonal field vectors. Critical for HUM Absolute Stabilization." },
              ].map(item => (
                <div key={item.title} className="flex gap-2.5">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                  <div>
                    <div className="mono text-[10px] font-semibold text-white/90 tracking-wide">{item.title}</div>
                    <div className="text-[11px] leading-[1.4] text-white/55 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="mono text-[10px] font-semibold tracking-widest text-amber-200/80">PHASE BREAKDOWN</div>
              <div className="space-y-2">
                <div className="rounded bg-cyan-500/10 border border-cyan-500/20 p-2.5">
                  <div className="mono text-[10px] text-cyan-300 font-semibold">0-3s · Khởi nguồn & Quán tính</div>
                  <div className="mono text-[9px] text-white/50 mt-1 leading-relaxed">Static_Toroid_Mobius_Lattice · Blue_Crystalline_Matrix · 38Hz Vajra low resonance · Central icosahedron static blue, 12 cells cyan dim, grid tension low, no trace</div>
                </div>
                <div className="rounded bg-orange-500/10 border border-orange-500/20 p-2.5">
                  <div className="mono text-[10px] text-orange-300 font-semibold">3-7s · Biến dạng Độ nhớt & Xoáy</div>
                  <div className="mono text-[9px] text-white/50 mt-1 leading-relaxed">Wave_Deformation_Shattering · Polyhedron_Unfolding · 38→432Hz Expansion Pulse · HA Kinetic Burst · Gold transition, cells brightening, Tau stretched elastic, tau afterglow, beta warped, Nabla valleys</div>
                </div>
                <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2.5">
                  <div className="mono text-[10px] text-amber-300 font-semibold">7-10s · Bồi tụ Ổn định & Entropy</div>
                  <div className="mono text-[9px] text-white/50 mt-1 leading-relaxed">Nested_Hyper_Dodecahedron_Fluid_Sphere · Gold_Harmonic_Field · HUM Absolute Stabilization · 432Hz harmonic · 10 cells lit, field relaxation, trace fading, equilibrium membrane pulsating</div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 mono text-[9px] text-white/30 leading-relaxed">
              <span className="text-white/60">Validation Criteria:</span> Drift δ &lt; 0.00025, Entropy-0 ∈ [0.9967,0.9971], Tri-Axis Coherence &gt;0.94 at 10s, Field Tension relaxation &lt;30% post-burst, Residual τ half-life &lt;1.2s after 7s mark.
              <br /><br />
              <span className="text-cyan-300/60">Note:</span> This is canvas simulation, not real quantum field. Volumetric glow via shadowBlur + radial gradients, caustics via moving blobs, particles as dust. No external deps.
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#08080f] px-4 py-2 flex justify-between mono text-[9px] text-white/25">
        <span>KALA-SUNYA v4.0121 · SIMULATION MODE · 16:9 · PURE REACT+CANVAS</span>
        <span className="hidden md:inline">© FIELD LAB — NO EXTERNAL DEPS — PRODUCTION GRADE</span>
      </div>
    </div>
  );
}