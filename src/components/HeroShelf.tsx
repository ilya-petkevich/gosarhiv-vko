"use client";

// Фон первого экрана — «полки»: по мотивам «Citron · Prism» (feralui.dev/gradients).
// Чёткие полосы разной толщины медленно едут вниз; у каждой свой сдвиг светлой части,
// и по пути она уходит по диагонали — как книги, выдвинутые с полки.
// Рисуется на canvas; без JS остаётся статичный градиент из CSS, при «уменьшить движение» — один кадр.

import { useEffect, useRef } from "react";

const DARK = "#26483D";
// цвет и отступ от края тёмной части (доля ширины)
const STOPS: [string, number][] = [
  [DARK, 0],
  ["#557D57", 0.1],
  ["#A4B963", 0.22],
  ["#D6D998", 0.33],
  ["#F2EDCC", 0.46],
];

type Strip = { y: number; h: number; j: number; ph: number };

export function HeroShelf() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let W = 0;
    let H = 0;
    let strips: Strip[] = [];
    // псевдослучайность с фиксированным началом — одинаковая картинка при каждом заходе
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const newStrip = (y: number): Strip => {
      const avg = Math.max(14, H / 22);
      return { y, h: avg * (0.45 + rnd() * 1.3), j: (rnd() - 0.5) * 0.14, ph: rnd() * Math.PI * 2 };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 7;
      strips = [];
      for (let y = H; y > -60; ) {
        const s = newStrip(0);
        y -= s.h;
        s.y = y;
        strips.unshift(s);
      }
    };

    const draw = (t: number) => {
      // на телефоне светлая часть правее — под текстом остаются тёмные тона
      const shift = W < 640 ? 0.32 : 0;
      ctx.fillStyle = DARK;
      ctx.fillRect(0, 0, W, H);
      for (const s of strips) {
        const k = Math.min(1, Math.max(0, (s.y + s.h / 2) / H));
        const edge = 0.54 - 0.38 * k + s.j + 0.025 * Math.sin(t * 0.0005 + s.ph) + shift;
        const g = ctx.createLinearGradient(0, 0, W, 0);
        for (const [c, off] of STOPS) g.addColorStop(Math.min(1, Math.max(0, edge + off)), c);
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.floor(s.y), W, Math.ceil(s.h) + 1);
      }
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    if (reduce) return () => ro.disconnect();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const SPEED = 16; // пикселей в секунду
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      for (const s of strips) s.y += SPEED * dt;
      while (strips.length && strips[strips.length - 1].y > H) strips.pop();
      while (strips.length && strips[0].y > -2) {
        const s = newStrip(0);
        s.y = strips[0].y - s.h;
        strips.unshift(s);
      }
      draw(now);
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
