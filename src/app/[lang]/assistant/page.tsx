import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict, isLang } from "@/i18n/dict";
import { Crumbs } from "@/components/CatalogParts";
import { Kniga } from "@/components/Kniga";
import { AkhmetChat } from "@/components/AkhmetChat";
import { Icon } from "@/components/Icon";
import { AI_INFO } from "@/lib/akhmet";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const d = dict(lang);
  return { title: d.ai.title, description: d.ai.about };
}

export default async function Assistant({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { q } = await searchParams;
  const d = dict(lang);
  const t = d.ai;
  // функции в клиентский компонент не передаются
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { providerNote, ...chatText } = t;
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.title }]} />
      <div className="ai-grid">
        <aside className="ai-side">
          <div className="card ai-card">
            <Kniga size={100} title="Ахмет" anim="blink" />
            <h1 className="h3">{t.title}</h1>
            <p className="small muted">{t.about}</p>
            {AI_INFO.model ? null : <span className="tag">{t.templateTag}</span>}
          </div>
          <div className="card ai-card left">
            <b>{t.canAsk}</b>
            {t.examples.map((x) => (
              <span key={x} className="small ex"><Icon name="check" size={18} /> {x}</span>
            ))}
          </div>
        </aside>
        <AkhmetChat
          lang={lang}
          initial={typeof q === "string" ? q.slice(0, 500) : undefined}
          t={{ ...chatText, types: d.cat.types, voice: d.voice, cipher: d.cat.cipher, hasCopy: d.cat.hasCopy, demoRecord: d.cat.demoRecord }}
        />
      </div>
    </div>
  );
}
