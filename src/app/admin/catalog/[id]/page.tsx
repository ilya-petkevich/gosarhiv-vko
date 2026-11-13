import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { DocFields } from "@/components/DocForm";
import { STATUS_LABEL, PUBLISH_LABEL, allowedTransitions, type Transition } from "@/lib/workflow";
import { saveDocument, setFileAccess, transitionAction, uploadFiles } from "../../actions";
import { MAX_FILE_MB } from "@/lib/files";

export const metadata = { title: "Запись каталога" };

const T_LABEL: Record<Transition, string> = {
  submit: "Отправить на проверку",
  rework: "Вернуть на доработку",
  approve: "Одобрить",
  publish: "Опубликовать",
  unpublish: "Снять с публикации",
  archive: "В архив",
};
const MSG: Record<string, string> = {
  created: "Черновик создан.", saved: "Изменения сохранены.", submit: "Отправлено на проверку.", rework: "Возвращено на доработку.",
  approve: "Одобрено.", publish: "Опубликовано — запись видна на сайте.", unpublish: "Снято с публикации.", archive: "Перенесено в архив.",
};

export default async function EditDoc({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; m?: string; info?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "catalog.edit", "content.create", "content.edit", "content.review", "content.publish")) redirect("/admin");
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const { e, m, info } = await searchParams;
  const doc = (
    await q<{
      id: number; uid: string; title: { ru: string; kk?: string; en?: string }; description: { ru?: string } | null; cipher: string | null; date_text: string | null;
      year_from: number | null; year_to: number | null; date_uncertain: boolean; doc_type: string; place: string | null; publish_status: string; status: string; doc_author: string | null; language: string | null; sheets: number | null; history_note: { ru?: string } | null;
      version: number; fund_number: string; author: string | null; approver: string | null; created_by: string | null;
    }>(
      `select d.*, d.author as doc_author, f.fund_number, a.full_name as author, ap.full_name as approver from documents d join funds f on f.id = d.fund_id
       left join users a on a.id = d.created_by left join users ap on ap.id = d.approved_by where d.id = $1`,
      [Number(id)],
    )
  )[0];
  if (!doc) notFound();
  const files = await q<{ id: number; access: string; original_name: string | null; mime: string; size_bytes: number; sha256: string; preview: boolean }>(
    `select df.id, df.access, df.original_name, df.mime, df.size_bytes, df.sha256,
            exists (select 1 from digital_files p where p.master_id = df.id) as preview
     from document_files x join digital_files df on df.id = x.file_id where x.document_id = $1 order by x.sort`,
    [doc.id],
  );
  const history = await q<{ from_status: string | null; to_status: string; comment: string | null; at: string; who: string | null }>(
    `select w.from_status, w.to_status, w.comment, to_char(w.at, 'DD.MM.YYYY HH24:MI') at, u.full_name who
     from workflow_transitions w left join users u on u.id = w.actor_id where w.entity_type = 'document' and w.entity_id = $1 order by w.id desc limit 20`,
    [doc.id],
  );
  const canEdit = can(u, "catalog.edit", "content.edit");
  const trans = allowedTransitions(u, doc.status, doc.publish_status, "document", doc.created_by);
  const publishBlocked = doc.status === "approved" && can(u, "content.publish") && doc.publish_status !== "public";

  return (
    <div className="adm-stack">
      <p className="small"><Link href="/admin/catalog">← Каталог</Link></p>
      <div className="row-between">
        <h1 className="h2">{doc.title.ru}</h1>
        <span className={`st st-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
      </div>
      <p className="small muted">Фонд {doc.fund_number} · версия {doc.version} · доступ к описанию: {PUBLISH_LABEL[doc.publish_status]}{doc.author ? ` · автор: ${doc.author}` : ""}{doc.approver ? ` · согласовал: ${doc.approver}` : ""}
        {doc.status === "published" ? <> · <a href={`/ru/catalog/doc/${doc.uid}`} target="_blank" rel="noopener">на сайте ↗</a></> : null}</p>
      {m && MSG[m] ? <p className="notice ok" role="status">{MSG[m]}</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}
      {info ? <p className="notice ok" role="status">{info}</p> : null}

      {trans.length || publishBlocked ? (
        <section className="card adm-card">
          <h2 className="h3">Согласование</h2>
          {publishBlocked ? <p className="notice">Опубликовать нельзя: доступ к описанию — «{PUBLISH_LABEL[doc.publish_status]}». Сначала откройте доступ.</p> : null}
          {trans.length ? (
            <div className="acts-row" style={{ alignItems: "flex-end" }}>
              {trans.map((t) => (
                <form key={t} action={transitionAction} className={t === "rework" ? "adm-form rework" : undefined}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="t" value={t} />
                  {t === "rework" ? <label className="fld"><span className="label">Что доработать *</span><textarea name="comment" rows={2} maxLength={1000} required /></label> : null}
                  <button className={t === "rework" || t === "unpublish" || t === "archive" ? "btn sec" : "btn"} type="submit">{T_LABEL[t]}</button>
                </form>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <form action={saveDocument} className="card adm-card">
        <h2 className="h3">Описание</h2>
        <input type="hidden" name="id" value={doc.id} />
        <DocFields v={doc} disabled={!canEdit} />
        {canEdit ? (
          <div className="acts-row">
            <button className="btn" type="submit">Сохранить</button>
            {doc.status === "published" && !can(u, "content.publish") ? <span className="small muted">После сохранения запись уйдёт на повторную проверку.</span> : null}
          </div>
        ) : <p className="small muted">Просмотр: у вашей роли нет права менять описание.</p>}
      </form>

      <section className="card adm-card">
          <h2 className="h3">Цифровые копии</h2>
          {can(u, "files.upload") ? (
            <form action={uploadFiles} className="adm-form upload">
              <input type="hidden" name="doc_id" value={doc.id} />
              <label className="fld"><span className="label">Добавить файлы (JPEG, PNG, WebP, TIFF, PDF, MP4, WebM, MP3; до {MAX_FILE_MB} МБ каждый, до 20 за раз)</span>
                <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf,video/mp4,video/webm,audio/mpeg" />
              </label>
              <div><button className="btn sec" type="submit">Загрузить</button></div>
              <p className="small muted">Новые файлы закрыты, пока вы не откроете доступ. Мастер-копия хранится без изменений; для изображений на сайте показывается облегчённая копия.</p>
            </form>
          ) : null}
          <p className="small muted">Доступ к файлу задаётся отдельно от описания. «Требует проверки» и «Не публиковать» — файл на сайте не выдаётся.</p>
          {files.length ? <ul className="adm-list">
            {files.map((f) => (
              <li key={f.id} className="row-between">
                <span>{f.original_name ?? `Файл ${f.id}`} <span className="small muted">· {f.mime.replace("image/", "").replace("application/", "").toUpperCase()} · {(f.size_bytes / 1024 / 1024).toFixed(2)} МБ{f.preview ? " · есть облегчённая копия" : ""} · SHA-256 {f.sha256.slice(0, 12)}…</span></span>
                {can(u, "files.upload", "catalog.edit") ? (
                  <form action={setFileAccess} className="acts-row">
                    <input type="hidden" name="file_id" value={f.id} /><input type="hidden" name="doc_id" value={doc.id} />
                    <select name="access" defaultValue={f.access} aria-label="Доступ к файлу">{Object.entries(PUBLISH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className="btn sec sm" type="submit">Применить</button>
                  </form>
                ) : <span className="small">{PUBLISH_LABEL[f.access]}</span>}
              </li>
            ))}
          </ul> : <p className="small muted">Файлов пока нет.</p>}
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
