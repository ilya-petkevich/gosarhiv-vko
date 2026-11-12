"use client";

// Телефон: кнопка «Меню» в шапке (разделы, язык, тема, версия для слабовидящих) и нижняя панель вкладок.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

type Item = { slug: string; title: string };

export function MobileMenu({ lang, items, label, extra }: { lang: string; items: Item[]; label: string; extra: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("m-open", open);
  }, [open]);
  return (
    <div className="m-menu">
      <button type="button" className="m-menu-btn" aria-expanded={open} aria-controls="m-panel" onClick={() => setOpen(!open)}>
        <Icon name={open ? "x" : "menu"} size={22} /> {label}
      </button>
      {open ? (
        <div id="m-panel" className="m-panel">
          <nav className="m-links">
            {items.map((i) => {
              const href = `/${lang}/${i.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={i.slug} href={href} aria-current={active ? "page" : undefined}>
                  {i.title} <Icon name="right" size={20} />
                </Link>
              );
            })}
          </nav>
          <div className="m-extra">{extra}</div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileBar({ lang, labels }: { lang: string; labels: { home: string; catalog: string; ai: string; branches: string; call: string } }) {
  const pathname = usePathname() || "";
  const tabs: [IconName, string, string][] = [
    ["home", labels.home, `/${lang}`],
    ["search", labels.catalog, `/${lang}/catalog`],
    ["sparkle", labels.ai, `/${lang}/assistant`],
    ["pin", labels.branches, `/${lang}/branches`],
  ];
  return (
    <nav className="m-bar" aria-label={labels.home}>
      {tabs.map(([icon, title, href]) => {
        const active = href === `/${lang}` ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon name={icon} size={24} />
            {title}
          </Link>
        );
      })}
      <a href="tel:+77232255976">
        <Icon name="phone" size={24} />
        {labels.call}
      </a>
    </nav>
  );
}
