import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL, allowedTransitions, canEditEntity, publishProblems, type Transition } from "@/lib/workflow";
import { addShowcaseItem, removeShowcaseItem, saveShowcase, showcaseTransition, toggleRights } from "../../../actions";

export const metadata = { title: "Подборка или выставка" };

const T_LABEL: Record<Transition, string> = { submit: "Отправить на проверку", rework: "Вернуть на доработку", approve: "Одобрить", publish: "Опубликовать", unpublish: "Снять с публикации", archive: "В архив" };
const MSG: Record<string, string> = { created: "Черновик создан.", saved: "Сохранено.", submit: "Отправлено на проверку.", rework: "Возвращено на доработку.", approve: "Одобрено.", publish: "Опубликовано — видно на сайте.", unpublish: "Снято с публикации.", archive: "Перенесено в архив." };

type Item = { id: number; type: string; title: { ru: string }; note: { ru?: string } | null; source: string | null; ok: boolean; rights: boolean | null; date_text: string | null };

export default async function EditShowcase({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ e?: string; m?: string; info?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  const { kind, id: idS } = await params;
  if ((kind !== "collection" && kind !== "exhibition") || !/^\d{1,9}$/.test(idS)) notFound();
  if (!can(u, "memory.edit", "exhibitions.edit", "content.review", "content.publish")) redirect("/admin");
  const id = Number(idS);
  const { e, m, info } = await searchParams;
  const isCol = kind === "collection";
  const row = (await q<{ id: number; slug: string; title: { ru: string }; summary: { ru?: string } | null; editorial: { ru?: string } | null; status: string; author: string | null; approver: string | null }>(
    isCol
      ? `select c.id, c.slug, c.title, c.summary, c.editorial_note editorial, c.status, a.full_name author, ap.full_name approver from collections c left join users a on a.id = c.created_by left join users ap on ap.id = c.approved_by where c.id = $1`
      : `select c.id, c.slug, c.title, c.description summary, null::jsonb editorial, c.status, a.full_name author, ap.full_name approver from exhibitions c left join users a on a.id = c.created_by left join users ap on ap.id = c.approved_by where c.id = $1`,
    [id],
  ))[0];
  if (!row) notFound();
  const VIS = `d.publish_status = 'public' and d.status = 'published'`;
  const items = await q<Item>(
    isCol
      ? `select i.id, i.item_type type, coalesce(d.title, e.title) title, i.body note, i.source, coalesce(d.date_text, e.date_text) date_text,
                case when i.item_type = 'document' then coalesce(${VIS}, false) else coalesce(e.status = 'published', false) end ok, null::boolean rights
         from collection_items i left join documents d on i.item_type = 'document' and d.id = i.item_id left join historical_events e on i.item_type = 'event' and e.id = i.item_id
         where i.collection_id = $1 order by i.sort, i.id`
      : `select x.id, 'document' type, x.title, x.caption note, x.source, d.date_text, coalesce(${VIS}, false) ok, x.rights_checked rights
         from exhibits x left join documents d on d.id = x.document_id where x.exhibition_id = $1 order by x.sort, x.id`,
    [id],
  );
  const history = await q<{ from_status: string | null; to_status: string; comment: string | null; at: string; who: string | null }>(
    `select w.from_status, w.to_status, w.comment, to_char(w.at, 'DD.MM.YYYY HH24:MI') at, u.full_name who from workflow_transitions w left join users u on u.id = w.actor_id
     where w.entity_type = $1 and w.entity_id = $2 order by w.id desc limit 20`,
    [kind, id],
  );
  const editable = canEditEntity(u, kind);
  const trans = allowedTransitions(u, row.status, null, kind);
  const problems = await publishProblems(kind, id);

  return (
    <div className="adm-stack">
      <p className="small"><Link href={`/admin/showcase?kind=${kind}`}>← Подборки и выставки</Link></p>
      <div className="row-between">
        <h1 className="h2">{row.title.ru}</h1>
        <span className={`st st-${row.status}`}>{STATUS_LABEL[row.status]}</span>
      </div>
      <p className="small muted">{isCol ? "Историческая подборка" : "Онлайн-выставка"}{row.author ? ` · автор: ${row.author}` : ""}{row.approver ? ` · согласовал: ${row.approver}` : ""}
        {row.status === "published" ? <> · <a href={`/ru/${isCol ? "chronicle" : "exhibitions"}/${row.slug}`} target="_blank" rel="noopener">на сайте ↗</a></> : null}</p>
      {m && MSG[m] ? <p className="notice ok" role="status">{MSG[m]}</p> : null}
      {info ? <p className="notice ok" role="status">{info}</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}

      <section className="card adm-card">
        <h2 className="h3">Согласование</h2>
        {problems.length && row.status !== "published" ? <p className="notice">Перед публикацией: {problems.join("; ")}.</p> : null}
        {trans.length ? (
          <div className="acts-row" style={{ alignItems: "flex-end" }}>
            {trans.map((t) => (
              <form key={t} action={showcaseTransition} className={t === "rework" ? "adm-form rework" : undefined}>
                <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} />
                {t === "rework" ? <label className="fld"><span className="label">Что доработать *</span><textarea name="comment" rows={2} maxLength={1000} required /></label> : null}
                <button className={t === "rework" || t === "unpublish" || t === "archive" ? "btn sec" : "btn"} type="submit">{T_LABEL[t]}</button>
              </form>
            ))}
          </div>
        ) : <p className="small muted">Для вашей роли действий нет.</p>}
      </section>

      <form action={saveShowcase} className="card adm-card">
        <h2 className="h3">Описание</h2>
        <fieldset className="adm-form" disabled={!editable}>
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
          <label className="fld"><span className="label">Название *</span><input name="title_ru" defaultValue={row.title.ru} required maxLength={300} /></label>
          <label className="fld"><span className="label">{isCol ? "Кратко о подборке" : "Описание выставки"}</span><textarea name="summary_ru" rows={3} defaultValue={row.summary?.ru ?? ""} maxLength={2000} /></label>
          {isCol ? <label className="fld"><span className="label">Пояснение редакции</span><textarea name="editorial_ru" rows={3} defaultValue={row.editorial?.ru ?? ""} maxLength={2000} /></label> : null}
        </fieldset>
        {editable ? <div><button className="btn" type="submit">Сохранить</button></div> : null}
      </form>

      <section className="card adm-card">
        <h2 className="h3">{isCol ? "Материалы подборки" : "Экспонаты"}: {items.length}</h2>
        {items.length ? (
          <ul className="adm-list">
            {items.map((it) => (
              <li key={it.id} className="row-between sc-adm-item">
                <span>
                  <span className={`st ${it.ok ? "st-published" : "st-rework"}`}>{it.type === "event" ? "событие" : "документ"}{it.ok ? "" : " · закрыт или не опубликован"}</span>{" "}
                  <b>{it.title?.ru}</b> <span className="small muted">{it.date_text ?? ""}</span>
                  {it.note?.ru ? <div className="small">{it.note.ru}</div> : null}
                  <div className="small muted">Источник: {it.source || <b>не указан</b>}</div>
                </span>
                {editable ? (
                  <span className="acts-row">
                    {!isCol ? (
                      <form action={toggleRights}>
                        <input type="hidden" name="id" value={id} /><input type="hidden" name="item" value={it.id} /><input type="hidden" name="on" value={it.rights ? "0" : "1"} />
                        <button className={`btn sm ${it.rights ? "sec" : ""}`} type="submit">{it.rights ? "✓ Право проверено" : "Отметить: право проверено"}</button>
                      </form>
                    ) : null}
                    <form action={removeShowcaseItem}>
                      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="item" value={it.id} />
                      <button className="btn sec sm" type="submit">Убрать</button>
                    </form>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="small muted">Пока пусто.</p>}
        {editable ? (
          <form action={addShowcaseItem} className="adm-form sc-add">
            <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
            <h3 className="h3" style={{ fontSize: 18 }}>Добавить</h3>
            {isCol ? (
              <div className="chips-row">
                <label className="check"><input type="radio" name="what" value="document" defaultChecked /> Запись каталога</label>
                <label className="check"><input type="radio" name="what" value="event" /> Событие хронологии</label>
              </div>
            ) : <input type="hidden" name="what" value="document" />}
            <label className="fld"><span className="label">{isCol ? "Шифр или название записи / текст события *" : "Шифр или название записи каталога *"}</span><input name="query" required maxLength={300} placeholder="Например: ДЕМО-1, оп. 1, д. 12" /></label>
            <label className="fld"><span className="label">{isCol ? "Комментарий к материалу" : "Подпись к экспонату *"}</span><textarea name="note" rows={2} maxLength={1000} required={!isCol} /></label>
            {!isCol ? <label className="check"><input type="checkbox" name="rights" /> Право на открытую публикацию проверено, источник указан</label> : null}
            <p className="small muted">Добавить можно только опубликованные записи каталога с открытым описанием. Источник (архивный шифр) подставляется сам.</p>
            <div><button className="btn sec" type="submit">Добавить</button></div>
          </form>
        ) : null}
      </section>

      {history.length ? (
        <section className="card adm-card">
          <h2 className="h3">История согласования</h2>
          <ul className="adm-list">{history.map((h, i) => <li key={i}><span className="small muted">{h.at}</span> {h.who ?? "—"}: {h.from_status ? STATUS_LABEL[h.from_status] : "—"} → <b>{STATUS_LABEL[h.to_status]}</b>{h.comment ? ` — «${h.comment}»` : ""}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
