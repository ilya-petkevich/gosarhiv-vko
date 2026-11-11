"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function MainNav({ lang, items, label }: { lang: string; items: { slug: string; title: string }[]; label: string }) {
  const pathname = usePathname() || "";
  return (
    <nav className="wrap nav" aria-label={label}>
      {items.map((i) => {
        const href = `/${lang}/${i.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={i.slug} href={href} aria-current={active ? "page" : undefined}>
            {i.title}
          </Link>
        );
      })}
    </nav>
  );
}
