"use client";

// Карта архива и филиалов (ТЗ 5.5, доп. ТЗ 3.3).
// Карта — OpenStreetMap через Leaflet. Геолокация — только по нажатию и с разрешения посетителя,
// координаты посетителя никуда не отправляются: ближайший филиал считается в браузере.
// Маршрут строится во внешнем сервисе по текстовому адресу: метки на карте приблизительные.

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import type { BranchText } from "@/i18n/branches";
import { Icon } from "./Icon";

export type BranchView = {
  slug: string;
  name: string;
  short: string;
  address: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  isMain: boolean;
};

const fullAddress = (b: BranchView) => `Казахстан, Восточно-Казахстанская область, ${b.address.replace(/^\d{6},\s*/, "")}`;
const gis = (b: BranchView) => `https://2gis.kz/search/${encodeURIComponent(fullAddress(b))}`;
const google = (b: BranchView, origin?: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(b))}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`;

function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function BranchesMap({ branches, t }: { branches: BranchView[]; t: BranchText }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const [selected, setSelected] = useState<string>(branches[0]?.slug ?? "");
  const [mapFailed, setMapFailed] = useState(false);
  const [geo, setGeo] = useState<"idle" | "locating" | "denied" | "unsupported" | "done">("idle");
  const [nearest, setNearest] = useState<{ slug: string; dist: number } | null>(null);
  const [origin, setOrigin] = useState("");

  const cur = branches.find((b) => b.slug === selected) ?? branches[0];

  // карта
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapEl.current || map.current) return;
        const m = L.map(mapEl.current, { scrollWheelZoom: false, attributionControl: true });
        map.current = m;
        let tileErrors = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          detectRetina: true, // чёткие плитки на экранах высокой плотности
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on("tileerror", () => {
            if (++tileErrors > 6) setMapFailed(true);
          })
          .addTo(m);
        const pts: [number, number][] = [];
        for (const b of branches) {
          if (b.lat == null || b.lng == null) continue;
          // область касания 40×40 (WCAG 2.2, размер цели), сама точка — 22 px
          const icon = L.divIcon({ className: `pin${b.isMain ? " main" : ""}`, html: "<span></span>", iconSize: [40, 40], iconAnchor: [20, 20] });
          const mk = L.marker([b.lat, b.lng], { icon, title: b.short, keyboard: true, alt: b.name })
            .addTo(m)
            .on("click", () => setSelected(b.slug));
          mk.bindTooltip(b.short, { direction: "top", offset: [0, -12] });
          markers.current[b.slug] = mk;
          pts.push([b.lat, b.lng]);
        }
        if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
      } catch {
        setMapFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current = {};
    };
  }, [branches]);

  // переход по ссылке #филиал (с главной страницы)
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (h && branches.some((b) => b.slug === h)) {
      setSelected(h);
      document.getElementById(`br-${h}`)?.scrollIntoView({ block: "center" });
    }
  }, [branches]);

  // выделение выбранного на карте
  useEffect(() => {
    for (const [slug, mk] of Object.entries(markers.current)) {
      mk.getElement()?.classList.toggle("on", slug === selected);
    }
    const b = branches.find((x) => x.slug === selected);
    if (b?.lat != null && b.lng != null && map.current) map.current.flyTo([b.lat, b.lng], Math.max(map.current.getZoom(), 9), { duration: 0.6 });
  }, [selected, branches]);

  const findNearest = () => {
    if (!("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        let best: { slug: string; dist: number } | null = null;
        for (const b of branches) {
          if (b.lat == null || b.lng == null) continue;
          const d = km(me, [b.lat, b.lng]);
          if (!best || d < best.dist) best = { slug: b.slug, dist: d };
        }
        setNearest(best);
        if (best) setSelected(best.slug);
        setGeo("done");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <div className="br">
      <div className="br-top">
        <button type="button" className="btn" onClick={findNearest} disabled={geo === "locating"}>
          <Icon name="pin" size={20} /> {geo === "locating" ? t.locating : t.nearest}
        </button>
        <p className="small muted">{t.approx}</p>
      </div>
      {geo === "denied" ? <p className="notice" role="status">{t.denied}</p> : null}
      {geo === "unsupported" ? <p className="notice" role="status">{t.unsupported}</p> : null}
      {nearest ? (
        <p className="notice ok" role="status">
          {t.nearestFound} <b>{branches.find((b) => b.slug === nearest.slug)?.short}</b> — {nearest.dist.toFixed(0)} {t.km}
        </p>
      ) : null}

      <div className="br-grid">
        <div className="br-map-col">
          <div className="card br-map" aria-label={t.mapLabel}>
            <div ref={mapEl} className="map" role="application" aria-label={t.mapLabel} />
            {mapFailed ? <p className="map-fail">{t.mapError}</p> : null}
          </div>

          {cur ? (
            <div className="card br-cur" aria-live="polite">
              <span className="small muted">{t.selected}</span>
              <h2 className="h3">{cur.name}</h2>
              <p>{cur.address}</p>
              <form
                className="from"
                onSubmit={(e) => {
                  e.preventDefault();
                  window.open(google(cur, origin.trim() || undefined), "_blank", "noopener");
                }}
              >
                <label htmlFor="from" className="label">{t.fromAddress}</label>
                <div className="from-row">
                  <input id="from" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t.fromPlaceholder} autoComplete="street-address" />
                  <button className="btn" type="submit"><Icon name="route" size={20} /> {t.build}</button>
                </div>
              </form>
              <div className="acts-row">
                <a className="btn sec sm" href={gis(cur)} target="_blank" rel="noopener">{t.route2gis}<span className="sr"> ({t.external})</span></a>
                <a className="btn sec sm" href={google(cur)} target="_blank" rel="noopener">{t.routeGoogle}<span className="sr"> ({t.external})</span></a>
              </div>
            </div>
          ) : null}
        </div>

        <ul className="br-list" aria-label={t.listLabel}>
          {branches.map((b) => (
            <li key={b.slug} id={`br-${b.slug}`} className={`card br-item${b.slug === selected ? " on" : ""}`}>
              <button type="button" className="br-pick" onClick={() => setSelected(b.slug)} aria-pressed={b.slug === selected}>
                <span className="pin-dot" aria-hidden="true" />
                <span>
                  {b.isMain ? <span className="tag red" style={{ marginBottom: 6 }}>{t.main}</span> : null}
                  <b>{b.name}</b>
                  <span className="small muted">{b.address}</span>
                </span>
              </button>
              <div className="br-meta small">
                <span>{t.phone}: {b.phone ? <a href={`tel:${b.phone.replace(/[^\d+]/g, "").replace(/^8/, "+7")}`}>{b.phone}</a> : t.noPhone}</span>
                {b.email ? <span>{t.email}: <a href={`mailto:${b.email}`}>{b.email}</a></span> : null}
                <span>{t.hours}: {b.hours ?? t.hoursUnknown}</span>
              </div>
              <div className="acts-row">
                <a className="btn sec sm" href={gis(b)} target="_blank" rel="noopener"><Icon name="route" size={18} /> {t.route2gis}<span className="sr"> ({t.external})</span></a>
                <a className="btn sec sm" href={google(b)} target="_blank" rel="noopener">{t.routeGoogle}<span className="sr"> ({t.external})</span></a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
