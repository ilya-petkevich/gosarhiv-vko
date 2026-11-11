"use client";

// Переключатели языка и темы. Оба сохраняют открытую страницу и текущий поисковый запрос (доп. ТЗ 3.3).

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LANGS, type Lang } from "@/i18n/dict";
import { Icon } from "./Icon";

const NAMES: Record<Lang, string> = { kk: "Қаз", ru: "Рус", en: "Eng" };

export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const pathname = usePathname() || `/${lang}`;
  const rest = pathname.split("/").slice(2).join("/");
  return (
    <nav className="seg" aria-label={label}>
      {LANGS.map((l) => (
        <a
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}`}
          lang={l}
          hrefLang={l}
          aria-current={l === lang ? "true" : undefined}
          onClick={(e) => {
            // добавить текущий запрос (?q=…) к адресу на другом языке
            e.currentTarget.href += window.location.search;
            document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          {NAMES[l]}
        </a>
      ))}
    </nav>
  );
}

type Theme = "light" | "dark";

export function ThemeToggle({ initial, labels }: { initial: Theme | null; labels: { light: string; dark: string; title: string } }) {
  const [theme, setTheme] = useState<Theme | null>(initial);

  useEffect(() => {
    if (theme === null) {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, [theme]);

  const current = theme ?? "light";
  const next: Theme = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-btn"
      aria-label={`${labels.title}: ${current === "dark" ? labels.dark : labels.light}`}
      onClick={() => {
        // меняем атрибут без перезагрузки — страница и введённый запрос остаются
        document.documentElement.dataset.theme = next;
        document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
        setTheme(next);
      }}
    >
      <Icon name={current === "dark" ? "moon" : "sun"} size={20} />
      {current === "dark" ? labels.dark : labels.light}
    </button>
  );
}
