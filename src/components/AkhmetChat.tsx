"use client";

// Окно вопросов к помощнику. Вопросы живут только на этой странице и никуда не сохраняются.

import { useEffect, useRef, useState } from "react";
import type { Answer, Source } from "@/lib/akhmet";
import type { Dict } from "@/i18n/dict";
import { Kniga } from "./Kniga";
import { Icon } from "./Icon";
import { VoiceButton } from "./VoiceButton";

type Item = { q: string; a?: Answer; error?: boolean };
type L = Omit<Dict["ai"], "providerNote"> & { types: Record<string, string>; voice: string; cipher: string; hasCopy: string; demoRecord: string };

function Para({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (m && sources[Number(m[1]) - 1]) return <sup key={i}><a href={`#src-${m[1]}`}>{m[1]}</a></sup>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

function SourceCard({ s, n, lang, t }: { s: Source; n: number; lang: string; t: L }) {
  if (s.kind === "doc") {
    return (
      <a id={`src-${n}`} className="card src" href={`/${lang}/catalog/doc/${s.uid}`}>
        <span className="src-n">{n}</span>
        <span className="src-im">
          {s.preview_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${s.preview_id}`} alt="" loading="lazy" />
          ) : (
            <Icon name="doc" size={26} />
          )}
        </span>
        <span className="src-tx">
          <b>{s.title}</b>
          <span className="small muted">{s.date}{s.cipher ? ` · ${t.cipher}: ${s.cipher}` : ""}</span>
          <span className="tags">
            {s.has_copy ? <span className="tag green">{t.hasCopy}</span> : null}
            {s.is_demo ? <span className="tag grey">{t.demoRecord}</span> : null}
          </span>
        </span>
      </a>
    );
  }
  return (
    <a id={`src-${n}`} className="card src" href={`/${lang}/catalog/fund/${s.id}`}>
      <span className="src-n">{n}</span>
      <span className="src-tx">
        <b>{t.fundShort} {s.fund_number} — {s.title}</b>
        <span className="small muted">{s.years}</span>
      </span>
    </a>
  );
}

// Разговор хранится только во вкладке браузера (sessionStorage), на сервере — нет.
// Нужно, чтобы при возврате «Назад» ответ остался как был: без повторного запроса и без повторной анимации.
const STORE = "akhmet-chat";
type Saved = { lang: string; initial: string; items: Item[] };

function readSaved(): Saved | null {
  try {
    const s = sessionStorage.getItem(STORE);
    return s ? (JSON.parse(s) as Saved) : null;
  } catch {
    return null;
  }
}

export function AkhmetChat({ lang, t, initial }: { lang: string; t: L; initial?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [stillUpTo, setStillUpTo] = useState(0); // ответы до этого номера восстановлены — без анимации
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  const restored = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    q = q.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setItems((x) => [...x, { q }]);
    if (inputRef.current) inputRef.current.value = "";
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, lang }) });
      if (!res.ok) throw new Error(String(res.status));
      const a = (await res.json()) as Answer;
      setItems((x) => x.map((it, i) => (i === x.length - 1 ? { ...it, a } : it)));
    } catch {
      setItems((x) => x.map((it, i) => (i === x.length - 1 ? { ...it, error: true } : it)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = readSaved();
    if (saved && saved.lang === lang && saved.initial === (initial ?? "") && saved.items.length) {
      restored.current = true;
      setStillUpTo(saved.items.length);
      setItems(saved.items);
      return;
    }
    if (initial) void send(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (busy) return;
    const done = items.filter((it) => it.a || it.error);
    if (!done.length) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ lang, initial: initial ?? "", items: done } satisfies Saved));
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  }, [items, busy, lang, initial]);

  useEffect(() => {
    if (restored.current) {
      restored.current = false; // после «Назад» браузер сам вернёт прокрутку
      return;
    }
    if (items.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {items.map((it, i) => (
          <div className={i < stillUpTo ? "turn still" : "turn"} key={i}>
            <div className="q-bubble">{it.q}</div>
            <div className="a-row">
              <Kniga size={48} mood={it.a ? it.a.mood : it.error ? "sad" : "think"} />
              <div className="a-col">
                {!it.a && !it.error ? <div className="card a-card muted rise">{t.thinking}<span className="thinking" aria-hidden="true"><i /><i /><i /></span></div> : null}
                {it.error ? <div className="card a-card rise">{t.error}</div> : null}
                {it.a ? (
                  <>
                    <div className="card a-card rise">
                      {it.a.mode === "template" || it.a.mode === "empty" ? <span className="tag" style={{ marginBottom: 12 }}>{t.templateTag}</span> : null}
                      {it.a.mode === "restricted" ? <span className="tag red" style={{ marginBottom: 12 }}><Icon name="lock" size={16} /> {t.restrictedTag}</span> : null}
                      {it.a.notice === "masked" ? <p className="notice">{t.masked}</p> : null}
                      {it.a.notice === "limit" ? <p className="notice">{t.limit}</p> : null}
                      {it.a.notice === "model_error" ? <p className="notice">{t.modelError}</p> : null}
                      {it.a.paragraphs.map((p, k) => <Para key={k} text={p} sources={it.a!.sources} />)}
                      <p className="auto small muted"><Icon name="sparkle" size={18} /> {t.auto}</p>
                    </div>
                    {it.a.sources.length ? (
                      <div className="srcs">
                        <b>{t.sources}</b>
                        {it.a.sources.map((s, k) => <SourceCard key={k} s={s} n={k + 1} lang={lang} t={t} />)}
                      </div>
                    ) : null}
                    {it.a.links.length ? (
                      <div className="acts-row">
                        {it.a.links.map((l) => (
                          <a key={l.href} className={l.href.startsWith("/") ? "btn" : "btn sec"} href={l.href} {...(l.external ? { target: "_blank", rel: "noopener" } : {})}>
                            {l.external ? <Icon name="globe" size={20} /> : null}{l.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {it.a.suggestions.length && i === items.length - 1 ? (
                      <div className="chips-row">
                        <span className="muted">{t.suggest}</span>
                        {it.a.suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {!items.length ? (
        <div className="chips-row" style={{ marginBottom: 16 }}>
          {t.examples.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      ) : null}

      <form
        className="card ask-box"
        onSubmit={(e) => {
          e.preventDefault();
          void send(inputRef.current?.value ?? "");
        }}
      >
        <label htmlFor="ask" className="sr">{t.placeholder}</label>
        <textarea
          id="ask"
          ref={inputRef}
          rows={2}
          maxLength={500}
          placeholder={t.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e.currentTarget.value);
            }
          }}
        />
        <VoiceButton inputId="ask" lang={lang} label={t.voice} />
        <button className="btn" type="submit" disabled={busy}><Icon name="arrow" size={20} /> {t.send}</button>
      </form>
      <p className="small muted" style={{ marginTop: 10 }}><Icon name="lock" size={16} /> {t.privacy}</p>
    </div>
  );
}
