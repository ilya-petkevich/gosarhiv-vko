import type { Metadata } from "next";
import { Onest, Literata } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LANGS, dict, isLang, type Lang } from "@/i18n/dict";
import { Header, Footer } from "@/components/Chrome";
import "../globals.css";

// Onest и Literata содержат казахские буквы (Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І)
const onest = Onest({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-onest", display: "swap" });
const literata = Literata({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-literata", display: "swap", weight: ["600", "700"] });

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const d = dict(lang);
  return {
    title: { default: d.orgName, template: `%s — ${d.orgShort}` },
    description: d.helloText,
    alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}`])) },
    openGraph: { siteName: d.orgName, locale: lang === "kk" ? "kk_KZ" : lang === "en" ? "en_US" : "ru_RU", type: "website" },
    icons: { icon: "/img/logo-gavko.png" },
  };
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const c = await cookies();
  const tc = c.get("theme")?.value;
  const theme = tc === "dark" || tc === "light" ? tc : null;

  return (
    <html lang={lang} data-theme={theme ?? undefined} className={`${onest.variable} ${literata.variable}`}>
      <body>
        <a className="skip" href="#main">{lang === "kk" ? "Негізгі мазмұнға өту" : lang === "en" ? "Skip to content" : "Перейти к содержанию"}</a>
        <Header lang={lang as Lang} theme={theme} />
        <main id="main">{children}</main>
        <Footer lang={lang as Lang} />
      </body>
    </html>
  );
}
