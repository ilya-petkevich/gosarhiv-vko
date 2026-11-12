"use client";

// Экранный диктор: читает вслух выделенный текст или содержимое страницы.
// Синтез речи встроен в браузер — текст никуда не отправляется. Если браузер не умеет — кнопки нет.

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/i18n/dict";
import { Icon } from "./Icon";

const LOCALE: Record<Lang, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

function pickVoice(lang: Lang) {
  const voices = window.speechSynthesis.getVoices();
  const want = LOCALE[lang].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(want.slice(0, 2))) ??
    // казахского голоса в браузере может не быть — читаем русским
    (lang === "kk" ? voices.find((v) => v.lang.toLowerCase().startsWith("ru")) : undefined)
  );
}

function pageText() {
  const sel = window.getSelection()?.toString().trim();
  if (sel) return sel;
  const main = document.getElementById("main");
  if (!main) return "";
  const copy = main.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("script, style, svg, [aria-hidden='true'], .sr-skip").forEach((n) => n.remove());
  return (copy.innerText || copy.textContent || "").replace(/\s+\n/g, "\n").trim();
}

// длинный текст браузеры обрывают — читаем кусками по предложениям
function chunks(text: string) {
  const parts = text.split(/(?<=[.!?…:;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).length > 220 && cur) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

export function ReadAloud({ lang, labels, className = "row" }: { lang: Lang; labels: { start: string; stop: string }; className?: string }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setOk(true);
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, []);

  // при переходе на другую страницу чтение останавливается
  useEffect(() => {
    const stop = () => { stopped.current = true; window.speechSynthesis?.cancel(); setOn(false); };
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, []);

  if (!ok) return null;

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const list = chunks(pageText());
    if (!list.length) return;
    stopped.current = false;
    const voice = pickVoice(lang);
    setOn(true);
    let i = 0;
    const next = () => {
      if (stopped.current || i >= list.length) { setOn(false); return; }
      const u = new SpeechSynthesisUtterance(list[i++]);
      u.lang = voice?.lang ?? LOCALE[lang];
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = next;
      u.onerror = () => setOn(false);
      synth.speak(u);
    };
    next();
  };
  const stop = () => { stopped.current = true; window.speechSynthesis.cancel(); setOn(false); };

  return (
    <button type="button" className={`read-aloud ${className}`} aria-pressed={on} onClick={on ? stop : start}>
      <Icon name={on ? "stop" : "speaker"} size={18} /> {on ? labels.stop : labels.start}
    </button>
  );
}
