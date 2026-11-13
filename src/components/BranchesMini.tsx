"use client";

// Небольшая карта филиалов на главной (ТЗ 5.1, блок «Наши филиалы»): метки ведут на страницу филиала с маршрутом.
// Если карта не загрузилась, рядом остаётся список с адресами и кнопками маршрута.

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

export type MiniPoint = { slug: string; short: string; lat: number; lng: number; isMain: boolean };

export function BranchesMini({ points, lang, label, error }: { points: MiniPoint[]; lang: string; label: string; error: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !el.current) return;
        map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
        let errs = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          detectRetina: true,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on("tileerror", () => {
            if (++errs > 6) setFailed(true);
          })
          .addTo(map);
        const pts: [number, number][] = [];
        for (const p of points) {
          const icon = L.divIcon({ className: `pin${p.isMain ? " main" : ""}`, html: "<span></span>", iconSize: [40, 40], iconAnchor: [20, 20] });
          L.marker([p.lat, p.lng], { icon, title: p.short, keyboard: true, alt: p.short })
            .addTo(map)
            .bindTooltip(p.short, { direction: "top", offset: [0, -12] })
            .on("click", () => {
              window.location.href = `/${lang}/branches#${p.slug}`;
            });
          pts.push([p.lat, p.lng]);
        }
        if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, lang]);

  return (
    <div className="mini-map-wrap">
      <div ref={el} className="mini-map" role="application" aria-label={label} />
      {failed ? <p className="map-fail">{error}</p> : null}
    </div>
  );
}
