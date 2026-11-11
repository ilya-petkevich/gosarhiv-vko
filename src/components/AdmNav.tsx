"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdmNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav className="adm-nav" aria-label="Разделы админки">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined}>{n.label}</Link>
      ))}
      <a href="/ru" target="_blank" rel="noopener">Открыть сайт ↗</a>
    </nav>
  );
}
