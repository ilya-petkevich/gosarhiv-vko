import type { Metadata } from "next";
import Link from "next/link";
import { Onest } from "next/font/google";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { logoutAction } from "./actions";
import "../globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Админка — Госархив ВКО", template: "%s — админка Госархива ВКО" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await currentStaff();
  const roles = u
    ? await q<{ name: { ru: string } }>(`select r.name from user_roles ur join roles r on r.code = ur.role_code where ur.user_id = $1`, [u.id])
    : [];
  const nav = u
    ? [
        { href: "/admin", label: "Сводка", show: true },
        { href: "/admin/catalog", label: "Электронный каталог", show: can(u, "catalog.edit", "content.create", "content.edit", "content.review", "content.publish") },
        { href: "/admin/import", label: "Импорт и выгрузка", show: can(u, "catalog.import") },
        { href: "/admin/branches", label: "Филиалы", show: can(u, "branches.edit_all", "branches.edit_own") },
        { href: "/admin/users", label: "Пользователи и роли", show: can(u, "users.manage") },
        { href: "/admin/audit", label: "Журнал действий", show: can(u, "audit.view") },
      ].filter((x) => x.show)
    : [];
  return (
    <html lang="ru" className={onest.variable}>
      <body className="adm">
        <a className="skip" href="#main">Перейти к содержанию</a>
        <header className="adm-top">
          <Link href="/admin" className="adm-brand">
            <img src="/img/logo-gavko.png" alt="" width={40} height={40} />
            <span>Госархив ВКО · админка</span>
          </Link>
          {u ? (
            <div className="adm-user">
              <span>
                <b>{u.full_name}</b>
                <span className="small">{roles.map((r) => r.name.ru).join(", ")}</span>
              </span>
              <form action={logoutAction}><button className="btn sec sm" type="submit">Выйти</button></form>
            </div>
          ) : null}
        </header>
        <div className="adm-body">
          {u ? (
            <nav className="adm-nav" aria-label="Разделы админки">
              {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
              <a href="/ru" target="_blank" rel="noopener">Открыть сайт ↗</a>
            </nav>
          ) : null}
          <main id="main" className="adm-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
