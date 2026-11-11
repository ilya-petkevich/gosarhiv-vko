"use client";

// Голосовой ввод через распознавание речи браузера (Web Speech API).
// Звук обрабатывает сам браузер; сайт получает только распознанный текст.
// Если браузер не умеет распознавать речь, кнопка не показывается.

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Rec = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

const LOCALES: Record<string, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

export function VoiceButton({ inputId, lang, label }: { inputId: string; lang: string; label: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new R();
    r.lang = LOCALES[lang] ?? "ru-RU";
    r.interimResults = true;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = text;
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  };

  return (
    <button type="button" className="voice" aria-pressed={on} onClick={toggle}>
      <Icon name="mic" size={22} />
      {label}
    </button>
  );
}
