import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/workflow";
import { markNotificationsRead } from "./actions";

export const metadata = { title: "Сводка" };

export default async function Dashboard() {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  const notes = await q<{ id: number; text: string; link: string | null; created_at: string }>(
    `select id, text, link, created_at::text from notifications where user_id = $1 and not is_read order by id desc limit 20`,
    [u.id],
  );
  const counts = await q<{ status: string; n: number }>(`select status, count(*)::int n from documents group by status`);
  const review = can(u, "content.review")
    ? await q<{ id: number; title: { ru: string }; updated_at: string }>(`select id, title, updated_at::text from documents where status = 'review' order by updated_at desc limit 10`)
    : [];
  const mine = await q<{ id: number; title: { ru: string }; status: string }>(
    `select id, title, status from documents where created_by = $1 order by updated_at desc limit 10`,
    [u.id],
  );
  const branch = u.branch_id ? (await q<{ name: { ru: string } }>(`select name from branches where id = $1`, [u.branch_id]))[0] : null;

  return (
    <div className="adm-stack">
      <h1>Здравствуйте, {u.full_name}</h1>
      {branch ? <p className="muted">Ваш филиал: {branch.name.ru}. Вы можете менять только его сведения.</p> : null}

      {notes.length ? (
        <section className="card adm-card">
          <div className="row-between"><h2 className="h3">Уведомления</h2><form action={markNotificationsRead}><button className="btn sec sm">Отметить прочитанными</button></form></div>
          <ul className="adm-list">{notes.map((n) => <li key={n.id}>{n.link ? <Link href={n.link}>{n.text}</Link> : n.text}</li>)}</ul>
        </section>
      ) : null}

      {review.length ? (
        <section className="card adm-card">
          <h2 className="h3">Ждут проверки</h2>
          <ul className="adm-list">{review.map((d) => <li key={d.id}><Link href={`/admin/catalog/${d.id}`}>{d.title.ru}</Link></li>)}</ul>
        </section>
      ) : null}

      {mine.length ? (
        <section className="card adm-card">
          <h2 className="h3">Мои материалы</h2>
          <ul className="adm-list">{mine.map((d) => <li key={d.id}><Link href={`/admin/catalog/${d.id}`}>{d.title.ru}</Link> <span className={`st st-${d.status}`}>{STATUS_LABEL[d.status]}</span></li>)}</ul>
        </section>
      ) : null}

      {can(u, "catalog.edit", "content.review", "content.publish", "analytics.view") ? (
        <section className="card adm-card">
          <h2 className="h3">Документы каталога по статусам</h2>
          <div className="adm-stats">{counts.map((c) => <div key={c.status}><b>{c.n}</b><span>{STATUS_LABEL[c.status]}</span></div>)}</div>
        </section>
      ) : null}
    </div>
  );
}
