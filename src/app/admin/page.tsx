import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/workflow";
import { Icon, type IconName } from "@/components/Icon";
import { markNotificationsRead } from "./actions";

export const metadata = { title: "Сводка" };

const ACTION_LABEL: Record<string, string> = {
  login: "Вход", logout: "Выход", "document.create": "Новая запись каталога", "document.update": "Правка записи каталога",
  "file.upload": "Загрузка копии", "file.access": "Доступ к копии", workflow: "Смена статуса", "news.create": "Новая новость",
  "news.edit": "Правка новости", "news.update": "Правка новости", "page.update": "Правка страницы", "branch.update": "Правка филиала",
  "branch.open": "Открыт филиал", "import.upload": "Загрузка файла импорта", "import.run": "Импорт", "import.rollback": "Откат импорта",
  "catalog.export": "Выгрузка каталога", "exhibition.rights": "Отметка о праве на публикацию",
};
const RESULT_LABEL: Record<string, string> = { ok: "", denied: " — отказано", error: " — ошибка" };
const AI_MODE: Record<string, string> = { model: "Ответ с источниками", template: "Ответ по шаблону", empty: "Нет данных", restricted: "Закрытые сведения" };

const fmt = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

export default async function Dashboard() {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");

  const [notes, counts, totals, review, mine, branch, feed, ai] = await Promise.all([
    q<{ id: number; text: string; link: string | null }>(`select id, text, link from notifications where user_id = $1 and not is_read order by id desc limit 20`, [u.id]),
    q<{ status: string; n: number }>(`select status, count(*)::int n from documents group by status order by n desc`),
    q<{ funds: number; docs: number; files: number; exhibitions: number; news: number; events: number }>(
      `select (select count(*)::int from funds where publish_status = 'public' and status = 'published') funds,
              (select count(*)::int from documents where status = 'published' and publish_status = 'public') docs,
              (select count(*)::int from digital_files where kind = 'master' and access = 'public') files,
              (select count(*)::int from exhibitions where status = 'published') exhibitions,
              (select count(*)::int from news where status = 'published') news,
              (select count(*)::int from historical_events) events`,
    ),
    can(u, "content.review", "content.publish")
      ? q<{ kind: string; id: number; title: { ru: string }; at: string }>(
          `select * from (
             select 'document' kind, id, title, updated_at::text at from documents where status = 'review'
             union all select 'exhibition', id, title, updated_at::text from exhibitions where status = 'review'
             union all select 'collection', id, title, updated_at::text from collections where status = 'review'
             union all select 'news', id, title, updated_at::text from news where status = 'review'
           ) x order by at desc limit 10`,
        )
      : Promise.resolve([]),
    q<{ id: number; title: { ru: string }; status: string }>(`select id, title, status from documents where created_by = $1 order by updated_at desc limit 6`, [u.id]),
    u.branch_id ? q<{ name: { ru: string } }>(`select name from branches where id = $1`, [u.branch_id]) : Promise.resolve([]),
    can(u, "audit.view")
      ? q<{ at: string; user_login: string | null; action: string; result: string }>(`select at::text, user_login, action, result from audit_log order by id desc limit 8`)
      : Promise.resolve([]),
    can(u, "analytics.view", "audit.view")
      ? q<{ mode: string; n: number }>(
          `select split_part(value, ':', 1) mode, count(*)::int n from page_events where event = 'ai_answer' and at > now() - interval '30 days' group by 1 order by 2 desc`,
        )
      : Promise.resolve([]),
  ]);
  const t = totals[0];
  const docTotal = counts.reduce((s, c) => s + c.n, 0) || 1;
  const aiTotal = ai.reduce((s, c) => s + c.n, 0);
  const reviewHref = (r: { kind: string; id: number }) =>
    r.kind === "document" ? `/admin/catalog/${r.id}` : r.kind === "news" ? `/admin/news/${r.id}` : `/admin/showcase/${r.kind}/${r.id}`;
  const KIND: Record<string, string> = { document: "Запись каталога", exhibition: "Выставка", collection: "Подборка", news: "Новость" };

  const kpis: { n: number; l: string; icon: IconName; href: string; c: string }[] = [
    { n: t.funds, l: "фондов на сайте", icon: "folder", href: "/admin/catalog", c: "b" },
    { n: t.docs, l: "документов опубликовано", icon: "doc", href: "/admin/catalog", c: "" },
    { n: t.files, l: "открытых цифровых копий", icon: "image", href: "/admin/catalog", c: "o" },
    { n: t.exhibitions + t.news, l: "выставок и новостей на сайте", icon: "film", href: "/admin/showcase", c: "g" },
  ];

  return (
    <div className="adm-stack">
      <div className="hello-row">
        <div>
          <h1>Здравствуйте, {u.full_name}</h1>
          {branch[0] ? <p className="muted">Ваш филиал: {branch[0].name.ru}. Вы можете менять только его сведения.</p> : <p className="muted">Что происходит на сайте сейчас</p>}
        </div>
        <div className="quick-acts">
          {can(u, "catalog.edit", "content.create") ? <Link className="btn sm" href="/admin/catalog/new">+ Новая запись</Link> : null}
          {can(u, "news.edit") ? <Link className="btn sec sm" href="/admin/news">Новость</Link> : null}
          {can(u, "catalog.import") ? <Link className="btn sec sm" href="/admin/import">Импорт</Link> : null}
        </div>
      </div>

      <div className="dash-grid">
        {kpis.map((k, i) => (
          <Link key={k.l} href={k.href} className={`card kpi ${k.c}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="ib"><Icon name={k.icon} size={20} /></span>
            <span className="n">{k.n.toLocaleString("ru-RU")}</span>
            <span className="l">{k.l}</span>
          </Link>
        ))}
      </div>

      {notes.length ? (
        <section className="card adm-card">
          <div className="row-between"><h2 className="h3">Уведомления</h2><form action={markNotificationsRead}><button className="btn sec sm">Отметить прочитанными</button></form></div>
          <ul className="adm-list">{notes.map((n) => <li key={n.id}>{n.link ? <Link href={n.link}>{n.text}</Link> : n.text}</li>)}</ul>
        </section>
      ) : null}

      <div className="dash-two">
        <section className="card adm-card">
          <div className="row-between"><h2 className="h3">Ждут проверки</h2>{review.length ? <span className="st st-review">{review.length}</span> : null}</div>
          {review.length ? (
            <ul className="feed">
              {review.map((r) => (
                <li key={`${r.kind}${r.id}`}><time>{fmt(r.at)}</time><span><Link href={reviewHref(r)}>{r.title.ru}</Link> <span className="muted">· {KIND[r.kind]}</span></span></li>
              ))}
            </ul>
          ) : (
            <p className="muted">{can(u, "content.review", "content.publish") ? "Очередь пуста — всё проверено." : "Проверку ведут редактор и модератор."}</p>
          )}
        </section>

        <section className="card adm-card">
          <h2 className="h3">Каталог по статусам</h2>
          <div className="bars">
            {counts.map((c, i) => (
              <div className="bar-row" key={c.status}>
                <span>{STATUS_LABEL[c.status]}</span>
                <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${Math.max(3, (c.n / docTotal) * 100)}%`, animationDelay: `${i * 0.08}s` }} /></span>
                <b style={{ textAlign: "right" }}>{c.n}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dash-two">
        {feed.length ? (
          <section className="card adm-card">
            <div className="row-between"><h2 className="h3">Последние действия</h2><Link className="more" href="/admin/audit">Весь журнал <Icon name="arrow" size={18} /></Link></div>
            <ul className="feed">
              {feed.map((f, i) => (
                <li key={i}><time>{fmt(f.at)}</time><span>{ACTION_LABEL[f.action] ?? f.action}{RESULT_LABEL[f.result] ?? ""} <span className="muted">· {f.user_login ?? "гость"}</span></span></li>
              ))}
            </ul>
          </section>
        ) : null}

        {ai.length || can(u, "analytics.view", "audit.view") ? (
          <section className="card adm-card">
            <h2 className="h3">Помощник «Ахмет» за 30 дней</h2>
            {aiTotal ? (
              <div className="bars">
                {ai.map((a, i) => (
                  <div className="bar-row" key={a.mode}>
                    <span>{AI_MODE[a.mode] ?? a.mode}</span>
                    <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${Math.max(3, (a.n / aiTotal) * 100)}%`, animationDelay: `${i * 0.08}s` }} /></span>
                    <b style={{ textAlign: "right" }}>{a.n}</b>
                  </div>
                ))}
              </div>
            ) : <p className="muted">Вопросов пока не было.</p>}
            <p className="small muted">Считается только вид ответа — текст вопросов не хранится.</p>
          </section>
        ) : null}
      </div>

      {mine.length ? (
        <section className="card adm-card">
          <h2 className="h3">Мои материалы</h2>
          <ul className="feed">{mine.map((d) => <li key={d.id}><span className={`st st-${d.status}`}>{STATUS_LABEL[d.status]}</span><Link href={`/admin/catalog/${d.id}`}>{d.title.ru}</Link></li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
