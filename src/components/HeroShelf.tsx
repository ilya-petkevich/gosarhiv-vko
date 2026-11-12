"use client";

// Фон первого экрана — «Citron · Prism» (feralui.dev/gradients, экспорт Ильи 12.11).
// Перенесён алгоритм PRISM2: 11 полос расходятся от центра вверх и вниз (motion «expand»),
// у каждой свой горизонтальный градиент; форма «slant» сдвигает светлую часть по диагонали,
// facets дают ступеньки между полосами. Цвета смешиваются в OKLab, как в оригинале.
// Без JS остаётся статичный градиент из CSS, при «уменьшить движение» — один кадр.

import { useEffect, useRef } from "react";

const STOPS = ["#26483D", "#557D57", "#A4B963", "#D6D998", "#F2EDCC"];
const DIVS = [0.2, 0.4, 0.6, 0.8];
const COUNT = 11;
const FUSION = { size: 100, height: 60, focus: 50, blend: 65, facets: 35 };
const START_T = 557.4; // время из экспорта: вступительная анимация уже прошла
const RATE = (40 / 100) * 1.2; // speed 40 → единиц времени в секунду
const FRAME_MS = 1000 / 30;
const STEPS = 96;

// ---- цвет: sRGB ↔ OKLab ----
type V3 = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function hexToOk(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function okToRgb([L, a, b]: V3): V3 {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  }) as V3;
}

// цвет палитры в точке t ∈ [0,1]: опорные точки — середины отрезков между делениями
function buildRamp(): V3[] {
  const bounds = [0, ...DIVS, 1];
  const pos = STOPS.map((_, i) => (bounds[i] + bounds[i + 1]) / 2);
  const ok = STOPS.map(hexToOk);
  const at = (t: number): V3 => {
    if (t <= pos[0]) return okToRgb(ok[0]);
    if (t >= pos[pos.length - 1]) return okToRgb(ok[ok.length - 1]);
    for (let i = 0; i < pos.length - 1; i++) {
      if (t >= pos[i] && t <= pos[i + 1]) {
        const k = (t - pos[i]) / Math.max(1e-6, pos[i + 1] - pos[i]);
        return okToRgb([0, 1, 2].map((j) => ok[i][j] + (ok[i + 1][j] - ok[i][j]) * k) as V3);
      }
    }
    return okToRgb(ok[ok.length - 1]);
  };
  return Array.from({ length: 256 }, (_, i) => at(i / 255));
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

type Band = { start: number; end: number; colors: string[] };

// полосы для времени a; shiftLight > 0 уводит светлую часть вправо (на телефоне — под текстом темнее)
function bands(ramp: V3[], a: number, shiftLight: number): Band[] {
  const s = a * 0.48; // «expand»: полосы уходят от центра
  const sample = (t: number): V3 => {
    const x = Math.max(0, Math.min(1, t)) * 255;
    const i = Math.floor(x);
    const j = Math.min(255, i + 1);
    const k = x - i;
    return [0, 1, 2].map((c) => ramp[i][c] + (ramp[j][c] - ramp[i][c]) * k) as V3;
  };
  const out: Band[] = [];
  const p = Math.floor(-s);
  const m = Math.ceil(COUNT - s);
  for (const h of [-1, 1]) {
    for (let g = p; g < m; g++) {
      const f = Math.max(0, (g + s) / COUNT);
      const b = Math.min(1, (g + 1 + s) / COUNT);
      if (b <= f) continue;
      const y = h < 0 ? (1 - b) / 2 : (1 + f) / 2;
      const L = h < 0 ? (1 - f) / 2 : (1 + b) / 2;
      const A = (y + L) / 2;
      const R = ((A - FUSION.focus / 100) * 2) / (FUSION.size / 100);
      const k = smooth(0.5 + R * 0.5); // форма «slant»
      const S = 0.015 * Math.sin(a * 0.32);
      const M = 0.28 + k * (FUSION.height * 0.006) + shiftLight + S;
      const E = (0.025 * Math.sin(g * 1.8) + 0.012 * Math.sin(g * 0.73 + a * 0.24)) * (FUSION.facets / 35);
      const T = 0.22 + FUSION.blend * 0.008;
      const colors: string[] = [];
      for (let n = 0; n < STEPS; n++) {
        const I = n / (STEPS - 1);
        const B = smooth((I - M + 0.22) / T);
        const O = Math.min(1, Math.max(0, 0.02 + 0.96 * B + E));
        const c = sample(O);
        colors.push(`rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
      }
      out.push({ start: y, end: L, colors });
    }
  }
  return out.sort((x, z) => x.start - z.start);
}

export function HeroShelf() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ramp = buildRamp();
    let t = START_T;
    let W = 1;
    let H = 1;

    const paint = () => {
      const shift = canvas.clientWidth < 640 ? 0.3 : 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = STOPS[0];
      ctx.fillRect(0, 0, W, H);
      // направление 3: полосы лежат по высоте, градиент идёт слева направо
      ctx.setTransform(0, -H, W, 0, 0, H);
      const seam = 1 / H;
      for (const band of bands(ramp, t, shift)) {
        const g = ctx.createLinearGradient(0, 0, 0, 1);
        band.colors.forEach((c, i) => g.addColorStop(i / (STEPS - 1), c));
        ctx.fillStyle = g;
        ctx.fillRect(band.start, 0, band.end - band.start + seam, 1);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const fit = Math.min(1, Math.sqrt(1600000 / Math.max(1, r.width * r.height * dpr * dpr)));
      W = Math.max(1, Math.round(r.width * dpr * fit));
      H = Math.max(1, Math.round(r.height * dpr * fit));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      paint();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last;
      if (dt < FRAME_MS - 1) return;
      last = now;
      if (!visible || document.hidden || motion.matches) return;
      t += Math.min(0.1, dt / 1000) * RATE;
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="hero-canvas" aria-hidden="true" />;
}
