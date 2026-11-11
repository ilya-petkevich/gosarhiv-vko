import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { savePage } from "../../actions";

export const metadata = { title: "Страница" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; m?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "pages.edit")) redirect("/admin");
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const { e, m } = await searchParams;
  const p = (await q<{ id: number; slug: string; title: { ru: string; kk?: string; en?: string }; body: { ru?: string; kk?: string; en?: string }; source: string | null; version: number }>(
    `select id, slug, title, body, source, version from pages where id = $1`, [Number(id)],
  ))[0];
  if (!p) notFound();
  const versions = await q<{ version: number; at: string; who: string | null }>(
    `select v.version, to_char(v.created_at, 'DD.MM.YYYY HH24:MI') at, u.full_name who from content_versions v left join users u on u.id = v.author_id where v.entity_type = 'page' and v.entity_id = $1 order by v.version desc limit 10`,
    [p.id],
  );
  return (
    <div className="adm-stack">
      <p className="small"><Link href="/admin/pages">← Страницы</Link> · <a href={`/ru/about/${p.slug}`} target="_blank" rel="noopener">на сайте ↗</a></p>
      <h1 className="h2">{p.title.ru}</h1>
      <p className="small muted">Версия {p.version}{p.source ? ` · источник: ${p.source}` : ""}</p>
      {m === "saved" ? <p className="notice ok" role="status">Сохранено. Прежняя версия сохранена в истории.</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <form action={savePage} className="card adm-card adm-form">
        <input type="hidden" name="id" value={p.id} />
        <label className="fld"><span className="label">Заголовок *</span><input name="title_ru" defaultValue={p.title.ru} required maxLength={200} /></label>
        <div className="grid2">
          <label className="fld"><span className="label">Заголовок (қаз)</span><input name="title_kk" defaultValue={p.title.kk} maxLength={200} /></label>
          <label className="fld"><span className="label">Заголовок (eng)</span><input name="title_en" defaultValue={p.title.en} maxLength={200} /></label>
        </div>
        <label className="fld"><span className="label">Текст *</span><textarea name="body_ru" rows={16} defaultValue={p.body.ru} required maxLength={40000} /></label>
        <details><summary>Перевод на казахский и английский</summary>
          <label className="fld"><span className="label">Текст (қаз)</span><textarea name="body_kk" rows={8} defaultValue={p.body.kk ?? ""} maxLength={40000} /></label>
          <label className="fld"><span className="label">Текст (eng)</span><textarea name="body_en" rows={8} defaultValue={p.body.en ?? ""} maxLength={40000} /></label>
        </details>
        <p className="small muted">Абзацы — через пустую строку. Подзаголовок — «## », пункт списка — «- », жирный — **текст**, ссылка — [текст](адрес).</p>
        <div><button className="btn" type="submit">Сохранить</button></div>
      </form>
      {versions.length ? <section className="card adm-card"><h2 className="h3">История версий</h2><ul className="adm-list">{versions.map((v) => <li key={v.version} className="small">Версия {v.version} · {v.at} · {v.who ?? "—"}</li>)}</ul></section> : null}
    </div>
  );
}
