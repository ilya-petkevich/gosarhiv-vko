"use client";

// Просмотр выставки: лента экспонатов, большой просмотр, увеличение на весь экран, подпись и источник (ТЗ 5.7).

import { useCallback, useEffect, useState } from "react";
import type { ShowcaseText } from "@/i18n/showcase";
import { Icon } from "./Icon";

export type ExhibitView = { id: number; title: string; caption: string; source: string; href: string; date: string | null; file: number | null; mime: string | null };

export function ExhibitionView({ items, t }: { items: ExhibitView[]; t: ShowcaseText }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const n = items.length;
  const cur = items[i];
  const go = useCallback((d: number) => setI((x) => Math.min(n - 1, Math.max(0, x + d))), [n]);

  // ссылка на экспонат: #exhibit-<номер>
  useEffect(() => {
    const m = window.location.hash.match(/^#exhibit-(\d+)$/);
    if (m) setI(Math.min(n - 1, Math.max(0, Number(m[1]) - 1)));
  }, [n]);
  useEffect(() => {
    history.replaceState(null, "", `#exhibit-${i + 1}`);
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") {
        setOpen(false);
        setBig(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!cur) return null;
  const img = cur.file && cur.mime?.startsWith("image/") ? `/api/files/${cur.file}` : null;

  return (
    <div className="exv">
      <div className="exv-main">
        <div className="card exv-stage">
          {img ? (
            <button type="button" className="exv-img" onClick={() => setOpen(true)} aria-label={`${t.zoom}: ${cur.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={cur.title} />
              <span className="exv-zoom"><Icon name="zoom" size={20} /> {t.zoom}</span>
            </button>
          ) : cur.file && cur.mime === "application/pdf" ? (
            <iframe src={`/api/files/${cur.file}`} title={cur.title} className="exv-pdf" />
          ) : (
            <div className="exv-nocopy"><Icon name="doc" size={40} /><span>{t.noCopy}</span></div>
          )}
        </div>
        <div className="exv-info">
          <span className="small muted">{t.exhibit} {i + 1} {t.of} {n}</span>
          <h2 className="h3">{cur.title}</h2>
          <p className="exv-cap">{cur.caption}</p>
          <dl className="card meta">
            {cur.date ? <div><dt>{t.date}</dt><dd>{cur.date}</dd></div> : null}
            <div><dt>{t.source}</dt><dd>{cur.source}</dd></div>
          </dl>
          <div className="acts-row">
            <a className="btn" href={cur.href}><Icon name="doc" size={20} /> {t.toCatalog}</a>
          </div>
          <div className="acts-row">
            <button className="btn sec sm" type="button" onClick={() => go(-1)} disabled={i === 0}><Icon name="left" size={18} /> {t.prev}</button>
            <button className="btn sec sm" type="button" onClick={() => go(1)} disabled={i === n - 1}>{t.next} <Icon name="right" size={18} /></button>
          </div>
          <p className="small muted">{t.zoomHint}</p>
        </div>
      </div>

      <ol className="exv-strip" aria-label={t.exhibit}>
        {items.map((x, k) => (
          <li key={x.id}>
            <button type="button" aria-current={k === i} onClick={() => setI(k)}>
              <span className="exv-th">
                {x.file && x.mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${x.file}`} alt="" loading="lazy" />
                ) : <Icon name="doc" size={26} />}
              </span>
              <span className="small">{k + 1}. {x.title}</span>
            </button>
          </li>
        ))}
      </ol>

      {open && img ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={cur.title}>
          <div className="lb-bar">
            <span>{i + 1} / {n} · {cur.title}</span>
            <span className="acts-row">
              <button type="button" className="btn sec sm" onClick={() => setBig((b) => !b)} aria-pressed={big}><Icon name="zoom" size={18} /> {t.zoom}</button>
              <button type="button" className="btn sec sm" onClick={() => go(-1)} disabled={i === 0} aria-label={t.prev}><Icon name="left" size={18} /></button>
              <button type="button" className="btn sec sm" onClick={() => go(1)} disabled={i === n - 1} aria-label={t.next}><Icon name="right" size={18} /></button>
              <button type="button" className="btn sm" onClick={() => { setOpen(false); setBig(false); }} autoFocus><Icon name="x" size={18} /> {t.close}</button>
            </span>
          </div>
          <div className={`lb-stage${big ? " big" : ""}`} onClick={() => setBig((b) => !b)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={cur.title} />
          </div>
          <p className="lb-cap">{cur.caption} · {t.source}: {cur.source}</p>
        </div>
      ) : null}
    </div>
  );
}
