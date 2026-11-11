"use client";

// Блок фильтров: на компьютере открыт, на телефоне свёрнут, чтобы сразу были видны результаты.

import { useEffect, useRef } from "react";

export function FiltersBox({ children, keepOpen }: { children: React.ReactNode; keepOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!keepOpen && window.matchMedia("(max-width: 1024px)").matches && ref.current) ref.current.open = false;
  }, [keepOpen]);
  return (
    <details ref={ref} className="card filters" open>
      {children}
    </details>
  );
}
