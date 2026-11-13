"use client";

// Счётчик просмотров разделов (ТЗ 5.8 Д): отправляется только раздел сайта, без cookie и личных данных.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function Beacon({ event = "view" }: { event?: "view" | "not_found" }) {
  const path = usePathname();
  useEffect(() => {
    if (!path) return;
    try {
      const body = JSON.stringify({ path, event });
      if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }))) {
        fetch("/api/hit", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, [path, event]);
  return null;
}
