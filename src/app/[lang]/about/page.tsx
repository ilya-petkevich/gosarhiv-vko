import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { contentText } from "@/i18n/content";
import { listAboutPages } from "@/lib/content";
import { Crumbs } from "@/components/CatalogParts";
import { Icon, type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = contentText(lang);
  return { title: t.about, description: t.aboutLead };
}

const ICONS: Record<string, IconName> = { history: "history", structure: "list", "reading-room": "lamp", compliance: "scale", laws: "doc" };

export default async function About({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = contentText(lang);
  const d = dict(lang);
  const pages = await listAboutPages();
  const cards: { href: string; title: string; text?: string; icon: IconName }[] = [
    ...pages.map((p) => ({ href: `/${lang}/about/${p.slug}`, title: pick(p.title, lang).text, icon: ICONS[p.slug] ?? "doc" })),
    { href: `/${lang}/about/calendar`, title: t.calendar, text: t.calendarText, icon: "calendar" },
    { href: `/${lang}/catalog?tab=funds`, title: t.funds, text: t.fundsText, icon: "folder" },
    { href: `/${lang}/branches`, title: t.branches, text: t.branchesText, icon: "pin" },
  ];
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.about }]} />
      <h1>{t.about}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.aboutLead}</p>
      <div className="about-grid">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card about-card">
            <span className="ib"><Icon name={c.icon} size={28} /></span>
            <b lang="ru">{c.title}</b>
            {c.text ? <span className="small muted">{c.text}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
