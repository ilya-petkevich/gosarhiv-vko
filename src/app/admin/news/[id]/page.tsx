import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL, allowedTransitions, type Transition } from "@/lib/workflow";
import { newsTransition, saveNews } from "../../actions";

export const metadata = { title: "Новость" };
const T_LABEL: Record<Transition, string> = { submit: "Отправить на проверку", rework: "Вернуть на доработку", approve: "Одобрить", publish: "Опубликовать", unpublish: "Снять с публикации", archive: "В архив" };
const MSG: Record<string, string> = { created: "Черновик создан.", saved: "Сохранено.", submit: "Отправлено на проверку.", rework: "Возвращено на доработку.", approve: "Одобрено.", publish: "Опубликовано — видно на сайте.", unpublish: "Снято с публикации.", archive: "Перенесено в архив." };

export default async function EditNews({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; m?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "news.edit", "content.review", "content.publish")) redirect("/admin");
  const { id } = await params;
  const { e, m } = await searchParams;
  const isNew = id === "new";
  if (!isNew && !/^\d{1,9}$/.test(id)) notFound();
  const n = isNew ? null : (await q<{ id: number; slug: string; title: { ru: string; kk?: string; en?: string }; summary: { ru?: string } | null; body: { ru?: string } | null; video_url: string | null; cat: string | null; branch_id: number | null; status: string; created_by: string | null }>(
    `select n.id, n.slug, n.title, n.summary, n.body, n.video_url, c.slug cat, n.branch_id, n.status, n.created_by from news n left join categories c on c.id = n.category_id where n.id = $1`, [Number(id)],
  ))[0];
  if (!isNew && !n) notFound();
  const ownOnly = can(u, "branches.edit_own") && !can(u, "branches.edit_all");
  if (n && ownOnly && n.branch_id !== u.branch_id) redirect(`/admin/news?e=${encodeURIComponent("Можно открывать только новости своего филиала")}`);
  const cats = await q<{ slug: string; name: { ru: string } }>(`select slug, name from categories where kind = 'news' order by sort`);
  const branches = await q<{ id: number; name: { ru: string } }>(`select id, short_name name from branches order by sort`);
  const trans = n ? allowedTransitions(u, n.status, null, "news", n.created_by) : [];
  const editable = can(u, "news.edit");
  return (
    <div className="adm-stack">
      <p className="small"><Link href="/admin/news">← Новости</Link></p>
      <div className="row-between"><h1 className="h2">{n ? n.title.ru : "Новая новость"}</h1>{n ? <span className={`st st-${n.status}`}>{STATUS_LABEL[n.status]}</span> : null}</div>
      {n?.status === "published" ? <p className="small"><a href={`/ru/news/${n.slug}`} target="_blank" rel="noopener">на сайте ↗</a></p> : null}
      {m && MSG[m] ? <p className="notice ok" role="status">{MSG[m]}</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}
      {n && trans.length ? (
        <section className="card adm-card">
          <h2 className="h3">Согласование</h2>
          <div className="acts-row" style={{ alignItems: "flex-end" }}>
            {trans.map((t) => (
              <form key={t} action={newsTransition} className={t === "rework" ? "adm-form rework" : undefined}>
                <input type="hidden" name="id" value={n.id} /><input type="hidden" name="t" value={t} />
                {t === "rework" ? <label className="fld"><span className="label">Что доработать *</span><textarea name="comment" rows={2} required maxLength={1000} /></label> : null}
                <button className={t === "rework" || t === "unpublish" || t === "archive" ? "btn sec" : "btn"} type="submit">{T_LABEL[t]}</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
      <form action={saveNews} className="card adm-card">
        <fieldset className="adm-form" disabled={!editable}>
          {n ? <input type="hidden" name="id" value={n.id} /> : null}
          <label className="fld"><span className="label">Заголовок *</span><input name="title_ru" defaultValue={n?.title.ru} required maxLength={300} /></label>
          <div className="grid2">
            <label className="fld"><span className="label">Заголовок (қаз)</span><input name="title_kk" defaultValue={n?.title.kk} maxLength={300} /></label>
            <label className="fld"><span className="label">Заголовок (eng)</span><input name="title_en" defaultValue={n?.title.en} maxLength={300} /></label>
          </div>
          <label className="fld"><span className="label">Кратко (одно-два предложения)</span><textarea name="summary_ru" rows={2} defaultValue={n?.summary?.ru ?? ""} maxLength={600} /></label>
          <label className="fld"><span className="label">Текст *</span><textarea name="body_ru" rows={10} defaultValue={n?.body?.ru ?? ""} maxLength={20000} /></label>
          <label className="fld"><span className="label">Видео (ссылка на YouTube, Vimeo или Rutube)</span><input name="video_url" type="url" defaultValue={n?.video_url ?? ""} maxLength={300} placeholder="https://" /></label>
          <p className="small muted">Абзацы — через пустую строку. Подзаголовок — строка с «## », пункт списка — с «- », ссылка — [текст](адрес).</p>
          <div className="grid2">
            <label className="fld"><span className="label">Рубрика</span><select name="category" defaultValue={n?.cat ?? ""}><option value="">—</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name.ru}</option>)}</select></label>
            <label className="fld"><span className="label">Филиал</span>
              <select name="branch_id" defaultValue={String(ownOnly ? u.branch_id ?? "" : n?.branch_id ?? "")} disabled={ownOnly}><option value="">Архив в целом</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name.ru}</option>)}</select>
            </label>
          </div>
        </fieldset>
        {editable ? <div><button className="btn" type="submit">{n ? "Сохранить" : "Создать черновик"}</button></div> : null}
      </form>
    </div>
  );
}
