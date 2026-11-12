"use client";

// Глаза Ахмета следят за курсором: сдвиг зрачков до 3,5 единиц внутри головы-книги.
// Только при мыши (на телефоне курсора нет) и без «уменьшить движение» — тогда и улыбка-анимация ставится на паузу.

import { useEffect } from "react";

export function KnigaGaze() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      document.querySelectorAll<SVGSVGElement>("svg.kn").forEach((s) => s.pauseAnimations?.());
      return;
    }
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      document.querySelectorAll<SVGSVGElement>("svg.kn").forEach((s) => {
        const r = s.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 260);
        s.style.setProperty("--gx", `${((dx / dist) * 3.5 * k).toFixed(2)}px`);
        s.style.setProperty("--gy", `${((dy / dist) * 2.8 * k).toFixed(2)}px`);
      });
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => document.querySelectorAll<SVGSVGElement>("svg.kn").forEach((s) => { s.style.removeProperty("--gx"); s.style.removeProperty("--gy"); });
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
