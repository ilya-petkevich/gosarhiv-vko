// Шапка и подвал сайта.

import Link from "next/link";
import { dict, type Lang } from "@/i18n/dict";
import { Icon } from "./Icon";
import { LangSwitch, ThemeToggle } from "./SiteTools";
import { MainNav } from "./MainNav";
import { MobileMenu, MobileBar } from "./MobileNav";

export const SOCIAL = {
  instagram: "https://www.instagram.com/arhiv_vko/",
  facebook: "https://www.facebook.com/vkoarhiv",
};

export function Header({ lang, theme }: { lang: Lang; theme: "light" | "dark" | null }) {
  const d = dict(lang);
  const nav = [
    { slug: "about", title: d.nav.about },
    { slug: "catalog", title: d.nav.catalog },
    { slug: "chronicle", title: d.nav.chronicle },
    { slug: "exhibitions", title: d.nav.exhibitions },
    { slug: "services", title: d.nav.services },
    { slug: "branches", title: d.nav.branches },
    { slug: "news", title: d.nav.news },
  ];
  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <div className="group">
            <a className="row" href="tel:+77232255976">
              <Icon name="phone" size={18} /> {d.reception}: 8 (7232) 25-59-76
            </a>
            <span className="row hours">
              <Icon name="clock" size={18} /> {lang === "kk" ? "Дс–Жм 8:00–17:00, оқу залы 9:00–16:00" : lang === "en" ? "Mon–Fri 8:00–17:00, reading room 9:00–16:00" : "Пн–Пт 8:00–17:00, читальный зал 9:00–16:00"}
            </span>
          </div>
          <div className="group">
            <Link className="row" href={`/${lang}/accessibility`}>
              <Icon name="eye" size={18} /> {d.lowVision}
            </Link>
            <span className="row social">
              <a href={SOCIAL.instagram} aria-label="Instagram" rel="noopener" target="_blank"><Icon name="insta" size={20} /></a>
              <a href={SOCIAL.facebook} aria-label="Facebook" rel="noopener" target="_blank"><Icon name="fb" size={20} /></a>
            </span>
          </div>
        </div>
      </div>
      <header className="header">
        <div className="wrap bar">
          <Link className="brand" href={`/${lang}`}>
            <img src="/img/logo-gavko.png" alt="" width={84} height={84} />
            <span className="serif brand-full">{d.orgName}</span>
            <span className="serif brand-short">{d.orgShort}</span>
          </Link>
          <div className="tools">
            <LangSwitch lang={lang} label={d.langLabel} />
            <ThemeToggle initial={theme} labels={{ light: d.themeLight, dark: d.themeDark, title: d.themeLabel }} />
            <Link className="btn sm catalog-btn" href={`/${lang}/catalog`}>
              <Icon name="search" size={20} /> {d.catalogBtn}
            </Link>
            <MobileMenu
              lang={lang}
              items={nav}
              label={d.mob.menu}
              extra={
                <>
                  <LangSwitch lang={lang} label={d.langLabel} />
                  <ThemeToggle initial={theme} labels={{ light: d.themeLight, dark: d.themeDark, title: d.themeLabel }} />
                  <Link className="m-row" href={`/${lang}/accessibility`}><Icon name="eye" size={20} /> {d.lowVision}</Link>
                </>
              }
            />
          </div>
        </div>
        <MainNav lang={lang} items={nav} label={d.orgShort} />
      </header>
      <MobileBar lang={lang} labels={d.mob} />
    </>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  const d = dict(lang);
  const L = (slug: string) => `/${lang}/${slug}`;
  const ru = lang === "ru";
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div className="org">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img src="/img/logo-gavko.png" alt="" width={72} height={72} />
              <b className="serif" style={{ fontSize: 18, lineHeight: 1.3 }}>{d.orgLegal}</b>
            </div>
            <span className="small">070000, {ru || lang === "kk" ? "г. Усть-Каменогорск, ул. Бейбітшілік, 26/1 (Головкова, 26/1)" : "26/1 Beibitshilik St, Ust-Kamenogorsk"}</span>
            <span className="small">
              {d.reception}: <a href="tel:+77232255976">8 (7232) 25-59-76</a>
              <br />
              <a href="mailto:arhiv-ukg@yandex.kz">arhiv-ukg@yandex.kz</a>
            </span>
          </div>
          <div className="col">
            <b>{d.footerArchive}</b>
            <Link href={L("about")}>{d.nav.about}</Link>
            <Link href={L("catalog")}>{d.nav.catalog}</Link>
            <Link href={L("exhibitions")}>{d.nav.exhibitions}</Link>
            <Link href={L("news")}>{d.nav.news}</Link>
          </div>
          <div className="col">
            <b>{d.footerVisitors}</b>
            <Link href={L("services/gov")}>{d.tiles.gov}</Link>
            <Link href={L("services/paid")}>{d.tiles.paid}</Link>
            <Link href={L("about/laws")}>{d.tiles.laws}</Link>
            <Link href={L("branches")}>{d.nav.branches}</Link>
            <Link href={L("faq")}>{d.faq}</Link>
          </div>
          <div className="col">
            <b>{d.footerLinks}</b>
            <a className="ext" href="https://egov.kz" rel="noopener" target="_blank">eGov.kz</a>
            <a className="ext" href="https://eotinish.kz" rel="noopener" target="_blank">e-Otinish</a>
            <a className="ext" href="https://adilet.zan.kz" rel="noopener" target="_blank">ИПС «Әділет»</a>
            <Link href={L("useful")}>{d.useful}</Link>
          </div>
        </div>
        <div className="bottom">
          <span>© 2010–{new Date().getFullYear()} {d.orgShort}. {d.footerNote}</span>
          <Link href={L("privacy")}>{d.privacy}</Link>
        </div>
      </div>
    </footer>
  );
}
