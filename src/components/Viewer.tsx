"use client";

// Просмотр открытых цифровых копий: листы, увеличение, клавиши ← → и Esc.
// Закрытые файлы сюда не передаются вовсе — сервер их не выдаёт.

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Labels = { sheet: string; zoom: string; unzoom: string; prev: string; next: string; openFull: string };

export function Viewer({ files, alt, labels }: { files: number[]; alt: string; labels: Labels }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const n = files.length;
  const src = `/api/files/${files[i]}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(n - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  return (
    <div className="card viewer">
      <div className={`stage${zoom ? " z" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${alt}. ${labels.sheet.replace("{i}", String(i + 1)).replace("{n}", String(n))}`} onClick={() => setZoom((z) => !z)} />
      </div>
      {n > 1 ? (
        <div className="thumbs" role="tablist">
          {files.map((id, k) => (
            <button key={id} type="button" role="tab" aria-selected={k === i} aria-current={k === i} aria-label={labels.sheet.replace("{i}", String(k + 1)).replace("{n}", String(n))} onClick={() => setI(k)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${id}`} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="bar">
        <span className="small muted" aria-live="polite">{labels.sheet.replace("{i}", String(i + 1)).replace("{n}", String(n))}</span>
        <div className="acts-row">
          {n > 1 ? (
            <>
              <button className="btn sec sm" type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><Icon name="left" size={18} /> {labels.prev}</button>
              <button className="btn sec sm" type="button" onClick={() => setI(Math.min(n - 1, i + 1))} disabled={i === n - 1}>{labels.next} <Icon name="right" size={18} /></button>
            </>
          ) : null}
          <button className="btn sec sm" type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}><Icon name="zoom" size={18} /> {zoom ? labels.unzoom : labels.zoom}</button>
          <a className="btn sec sm" href={src} target="_blank" rel="noopener">{labels.openFull}</a>
        </div>
      </div>
    </div>
  );
}

export function CopyButton({ text, label, done, icon = "copy", className = "btn sec sm" }: { text?: string; label: string; done: string; icon?: "copy" | "share"; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const value = text ?? window.location.href;
        try {
          if (!text && navigator.share) {
            await navigator.share({ url: value, title: document.title });
            return;
          }
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          /* отменено пользователем */
        }
      }}
    >
      <Icon name={ok ? "check" : icon} size={20} /> <span aria-live="polite">{ok ? done : label}</span>
    </button>
  );
}
