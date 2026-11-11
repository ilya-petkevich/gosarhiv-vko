// Временная страница для разделов, которые ещё не сделаны. Закрыта от индексации.

import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang } from "@/i18n/dict";
import { Kniga } from "@/components/Kniga";

export const metadata = { robots: { index: false, follow: false } };

export default async function Wip({ params }: { params: Promise<{ lang: string; rest: string[] }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = dict(lang);
  return (
    <div className="wrap" style={{ padding: "72px 0", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
      <Kniga size={120} mood="think" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <h1 style={{ fontSize: 32 }}>{d.wip}</h1>
        <p className="muted">{d.wipText}</p>
        <div><Link className="btn" href={`/${lang}`}>{d.toHome}</Link></div>
      </div>
    </div>
  );
}
