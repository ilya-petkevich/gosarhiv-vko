"use client";

// Голосовой ввод через распознавание речи браузера (Web Speech API).
// Звук обрабатывает сам браузер; сайт получает только распознанный текст.
// Если браузер не умеет распознавать речь, кнопка не показывается.
// После фразы поиск запускается сам; ошибки (нет доступа к микрофону, тишина) объясняются сообщением.

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type RecResult = { isFinal: boolean; 0: { transcript: string } };
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<RecResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecCtor = new () => Rec;

const LOCALES: Record<string, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

const MSG: Record<string, Record<string, string>> = {
  ru: {
    listening: "Слушаю…",
    "not-allowed": "Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера и нажмите ещё раз.",
    "no-speech": "Не расслышал. Нажмите «Голосом» и скажите ещё раз.",
    "audio-capture": "Микрофон не найден. Проверьте, что он подключён.",
    network: "Распознавание речи сейчас недоступно в этом браузере. Попробуйте Chrome, Safari или Edge — или напишите запрос.",
    other: "Не получилось распознать речь. Попробуйте ещё раз или напишите запрос.",
  },
  kk: {
    listening: "Тыңдап тұрмын…",
    "not-allowed": "Микрофонға рұқсат жоқ. Браузер баптауларында осы сайтқа микрофонды рұқсат етіп, қайта басыңыз.",
    "no-speech": "Естімедім. «Дауыспен» батырмасын басып, қайта айтыңыз.",
    "audio-capture": "Микрофон табылмады.",
    network: "Бұл браузерде сөзді тану қазір қолжетімсіз. Chrome, Safari немесе Edge қолданып көріңіз — не сұрауды жазыңыз.",
    other: "Сөзді тану мүмкін болмады. Қайталап көріңіз немесе сұрауды жазыңыз.",
  },
  en: {
    listening: "Listening…",
    "not-allowed": "No access to the microphone. Allow the microphone for this site in your browser settings and try again.",
    "no-speech": "I didn't hear anything. Press “Voice” and speak again.",
    "audio-capture": "No microphone found.",
    network: "Speech recognition is unavailable in this browser right now. Try Chrome, Safari or Edge — or type your query.",
    other: "Couldn't recognise speech. Try again or type your query.",
  },
};

function ctor(): RecCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function VoiceButton({ inputId, lang, label }: { inputId: string; lang: string; label: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<Rec | null>(null);
  const t = MSG[lang] ?? MSG.ru;

  useEffect(() => {
    setSupported(Boolean(ctor()));
    return () => rec.current?.abort();
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 7000);
    return () => clearTimeout(id);
  }, [note]);

  if (!supported) return null;

  const listen = (locale: string) => {
    const R = ctor();
    if (!R) return;
    const r = new R();
    r.lang = locale;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    let failed = false;
    r.onresult = (e) => {
      const parts = Array.from(e.results);
      const text = parts.map((x) => x[0].transcript).join(" ").trim();
      const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (input) input.value = text;
      if (parts.length && parts[parts.length - 1].isFinal) finalText = text;
    };
    r.onerror = (e) => {
      failed = true;
      // казахский поддерживают не все браузеры — тогда слушаем по-русски
      if (e.error === "language-not-supported" && locale !== "ru-RU") {
        rec.current = null;
        setTimeout(() => listen("ru-RU"), 0);
        return;
      }
      if (e.error === "aborted") return;
      setNote(t[e.error === "service-not-allowed" ? "not-allowed" : e.error] ?? t.other);
    };
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      if (!rec.current) setOn(false);
      if (failed) return;
      const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
      const text = finalText || input?.value.trim() || "";
      if (!text) {
        setNote(t["no-speech"]);
        return;
      }
      // фраза распознана — запускаем поиск, как будто нажали «Найти»
      input?.form?.requestSubmit();
    };
    rec.current = r;
    setOn(true);
    setNote("");
    try {
      r.start();
    } catch {
      rec.current = null;
      setOn(false);
      setNote(t.other);
    }
  };

  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    listen(LOCALES[lang] ?? "ru-RU");
  };

  return (
    <>
      <button type="button" className="voice" aria-pressed={on} onClick={toggle}>
        <Icon name="mic" size={22} />
        {on ? t.listening : label}
      </button>
      <span className={note ? "voice-note on" : "voice-note"} role="status" aria-live="polite">{note}</span>
    </>
  );
}
