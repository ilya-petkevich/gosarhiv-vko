"use server";

// Действия админки. Next.js принимает серверные действия только со своего сайта (проверка Origin),
// а каждое действие заново проверяет вход и права для конкретного объекта.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { audit, can, currentStaff, login, logout, type Staff } from "@/lib/auth";
import { canEditBranch, transitionDocument, type Transition } from "@/lib/workflow";
import { DOC_TYPES } from "@/lib/catalog";

const s = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);

async function need(): Promise<Staff> {
  const u = await currentStaff();
  if (!u) redirect("/admin/login?e=session");
  return u;
}

export async function loginAction(f: FormData) {
  const r = await login(s(f, "login", 64), String(f.get("password") ?? "").slice(0, 200));
  if (r === "ok") redirect("/admin");
  redirect(`/admin/login?e=${r}`);
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login?e=bye");
}

// ---------- Каталог ----------

type DocInput = {
  title: { ru: string; kk?: string; en?: string };
  description: { ru: string; kk?: string; en?: string };
  cipher: string;
  date_text: string;
  year_from: number;
  year_to: number;
  date_uncertain: boolean;
  doc_type: string;
  place: string | null;
  publish_status: string;
};

// обязательные поля — чтобы не появлялись неполные карточки (ТЗ 6.3)
function readDoc(f: FormData): { ok: true; v: DocInput } | { ok: false; error: string } {
  const title = s(f, "title_ru", 300);
  const cipher = s(f, "cipher", 120);
  const date = s(f, "date_text", 60);
  const yf = Number(s(f, "year_from", 4));
  const yt = Number(s(f, "year_to", 4) || yf);
  const type = s(f, "doc_type", 20);
  const pub = s(f, "publish_status", 20);
  const missing = [!title && "название", !cipher && "архивный шифр", !date && "дата", !(yf >= 1500 && yf <= 2100) && "год (4 цифры)"].filter(Boolean);
  if (missing.length) return { ok: false, error: `Заполните: ${missing.join(", ")}` };
  if (yt < yf || yt > 2100) return { ok: false, error: "Год «по» не может быть меньше года «с»" };
  if (!(DOC_TYPES as readonly string[]).includes(type)) return { ok: false, error: "Выберите вид материала" };
  if (!["public", "no_publish", "needs_check"].includes(pub)) return { ok: false, error: "Выберите статус доступа" };
  const opt = (k: string, max = 300) => s(f, k, max) || undefined;
  return {
    ok: true,
    v: {
      title: { ru: title, kk: opt("title_kk"), en: opt("title_en") },
      description: { ru: s(f, "desc_ru", 4000), kk: opt("desc_kk", 4000), en: opt("desc_en", 4000) },
      cipher,
      date_text: date,
      year_from: yf,
      year_to: yt,
      date_uncertain: f.get("date_uncertain") === "on",
      doc_type: type,
      place: s(f, "place", 200) || null,
      publish_status: pub,
    },
  };
}

export async function createDocument(f: FormData) {
  const u = await need();
  if (!can(u, "catalog.edit", "content.create")) {
    await audit(u, "document.create", "document", null, "denied");
    redirect("/admin/catalog?e=denied");
  }
  const r = readDoc(f);
  if (!r.ok) redirect(`/admin/catalog/new?e=${encodeURIComponent(r.error)}`);
  const fund = Number(s(f, "fund_id", 12));
  const okFund = (await q(`select 1 from funds where id = $1`, [fund])).length;
  if (!okFund) redirect(`/admin/catalog/new?e=${encodeURIComponent("Выберите фонд")}`);
  const v = r.v;
  const row = (
    await q<{ id: number }>(
      `insert into documents(fund_id, branch_id, cipher, title, description, doc_type, date_text, year_from, year_to, date_uncertain, place,
                             publish_status, status, created_by, updated_by, provenance, is_demo)
       values ($1, (select branch_id from funds where id = $1), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12,$12,'Создано в админке',true) returning id`,
      [fund, v.cipher, v.title, v.description, v.doc_type, v.date_text, v.year_from, v.year_to, v.date_uncertain, v.place, v.publish_status, u.id],
    )
  )[0];
  await q(`insert into content_versions(entity_type, entity_id, version, data, author_id) values ('document',$1,1,$2,$3)`, [row.id, v, u.id]);
  await audit(u, "document.create", "document", row.id, "ok");
  redirect(`/admin/catalog/${row.id}?m=created`);
}

export async function saveDocument(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const doc = (await q<{ status: string; version: number }>(`select status, version from documents where id = $1`, [id]))[0];
  if (!doc) redirect("/admin/catalog?e=notfound");
  if (!can(u, "catalog.edit", "content.edit")) {
    await audit(u, "document.update", "document", id, "denied");
    redirect(`/admin/catalog/${id}?e=${encodeURIComponent("Недостаточно прав для изменения записи")}`);
  }
  const r = readDoc(f);
  if (!r.ok) redirect(`/admin/catalog/${id}?e=${encodeURIComponent(r.error)}`);
  const v = r.v;
  // правка опубликованной записи без права публикации — снова на проверку, публично не видна до согласования
  const backToReview = doc.status === "published" && !can(u, "content.publish");
  const nextStatus = backToReview ? "review" : doc.status;
  // если описание закрыли — снять с публикации
  const finalStatus = v.publish_status !== "public" && nextStatus === "published" ? "review" : nextStatus;
  await q(
    `update documents set cipher=$2, title=$3, description=$4, doc_type=$5, date_text=$6, year_from=$7, year_to=$8, date_uncertain=$9, place=$10,
       publish_status=$11, status=$12, updated_by=$13, updated_at=now(), version = version + 1,
       published_at = case when $12 = 'published' then published_at else null end
     where id = $1`,
    [id, v.cipher, v.title, v.description, v.doc_type, v.date_text, v.year_from, v.year_to, v.date_uncertain, v.place, v.publish_status, finalStatus, u.id],
  );
  await q(`insert into content_versions(entity_type, entity_id, version, data, author_id) values ('document',$1,$2,$3,$4)`, [id, doc.version + 1, v, u.id]);
  if (finalStatus !== doc.status) {
    await q(`insert into workflow_transitions(entity_type, entity_id, from_status, to_status, actor_id, comment) values ('document',$1,$2,$3,$4,$5)`, [
      id, doc.status, finalStatus, u.id, "Изменено после публикации — повторная проверка",
    ]);
  }
  await audit(u, "document.update", "document", id, "ok", { version: doc.version + 1, status: finalStatus });
  revalidatePath("/[lang]/catalog", "layout");
  redirect(`/admin/catalog/${id}?m=saved`);
}

export async function setFileAccess(f: FormData) {
  const u = await need();
  const fileId = Number(s(f, "file_id", 12));
  const docId = Number(s(f, "doc_id", 12));
  const access = s(f, "access", 20);
  if (!can(u, "files.upload", "catalog.edit")) {
    await audit(u, "file.access", "file", fileId, "denied");
    redirect(`/admin/catalog/${docId}?e=${encodeURIComponent("Недостаточно прав")}`);
  }
  if (!["public", "no_publish", "needs_check"].includes(access)) redirect(`/admin/catalog/${docId}`);
  await q(`update digital_files set access = $2 where id = $1 and exists (select 1 from document_files where file_id = $1 and document_id = $3)`, [fileId, access, docId]);
  await audit(u, "file.access", "file", fileId, "ok", { access });
  redirect(`/admin/catalog/${docId}?m=saved`);
}

export async function transitionAction(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const t = s(f, "t", 20) as Transition;
  const r = await transitionDocument(u, id, t, s(f, "comment", 1000));
  redirect(`/admin/catalog/${id}?${r.ok ? `m=${t}` : `e=${encodeURIComponent(r.error)}`}`);
}

export async function markNotificationsRead() {
  const u = await need();
  await q(`update notifications set is_read = true where user_id = $1`, [u.id]);
  redirect("/admin");
}

// ---------- Филиалы ----------

export async function saveBranch(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  if (!canEditBranch(u, id)) {
    // проверка на сервере: скрытой кнопки недостаточно (доп. ТЗ 3.5)
    await audit(u, "branch.update", "branch", id, "denied", { reason: "not_own_branch" });
    redirect(`/admin/branches?e=${encodeURIComponent("Можно менять сведения только своего филиала")}`);
  }
  const phone = s(f, "phone", 60) || null;
  const email = s(f, "email", 120) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/admin/branches/${id}?e=${encodeURIComponent("Проверьте адрес почты")}`);
  const address = s(f, "address", 300);
  if (!address) redirect(`/admin/branches/${id}?e=${encodeURIComponent("Адрес обязателен")}`);
  const hours = s(f, "hours", 200);
  const visible = f.get("is_visible") === "on";
  const before = (await q(`select address, phone, email, hours, is_visible from branches where id = $1`, [id]))[0];
  await q(
    `update branches set address = jsonb_set(address, '{ru}', to_jsonb($2::text)), phone = $3, email = $4,
       hours = case when $5 = '' then null else jsonb_build_object('ru', $5::text) end, is_visible = $6, updated_at = now() where id = $1`,
    [id, address, phone, email, hours, visible],
  );
  await audit(u, "branch.update", "branch", id, "ok", { before });
  redirect(`/admin/branches/${id}?m=saved`);
}

// ---------- Цифровые копии: пакетная загрузка ----------

export async function uploadFiles(f: FormData) {
  const u = await need();
  const docId = Number(s(f, "doc_id", 12));
  if (!can(u, "files.upload")) {
    await audit(u, "file.upload", "document", docId, "denied");
    redirect(`/admin/catalog/${docId}?e=${encodeURIComponent("Недостаточно прав для загрузки файлов")}`);
  }
  if (!(await q(`select 1 from documents where id = $1`, [docId])).length) redirect("/admin/catalog");
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 20);
  if (!files.length) redirect(`/admin/catalog/${docId}?e=${encodeURIComponent("Выберите файлы")}`);
  const { saveUpload } = await import("@/lib/files");
  const base = (await q<{ n: number }>(`select coalesce(max(sort), 0)::int as n from document_files where document_id = $1`, [docId]))[0].n;
  const results = [];
  for (const [i, file] of files.entries()) results.push(await saveUpload(docId, file, u.id, base + i + 1));
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r): r is { name: string; ok: false; error: string } => !r.ok);
  await audit(u, "file.upload", "document", docId, bad.length && !ok ? "error" : "ok", { uploaded: ok, rejected: bad.map((b) => `${b.name}: ${b.error}`) });
  const msg = `Загружено: ${ok}.` + (bad.length ? ` Не принято: ${bad.map((b) => `${b.name} — ${b.error}`).join("; ")}` : "");
  redirect(`/admin/catalog/${docId}?${bad.length ? "e" : "info"}=${encodeURIComponent(msg)}`);
}

// ---------- Импорт CSV / XLSX ----------

export async function uploadImport(f: FormData) {
  const u = await need();
  if (!can(u, "catalog.import")) {
    await audit(u, "import.upload", "import", null, "denied");
    redirect("/admin?e=denied");
  }
  const file = f.get("file");
  const fund = Number(s(f, "fund_id", 12));
  if (!(file instanceof File) || !file.size) redirect(`/admin/import?e=${encodeURIComponent("Выберите файл")}`);
  if (!(await q(`select 1 from funds where id = $1`, [fund])).length) redirect(`/admin/import?e=${encodeURIComponent("Выберите фонд")}`);
  const { parseFile, guessMapping } = await import("@/lib/importer");
  const parsed = await parseFile(file.name, Buffer.from(await file.arrayBuffer()));
  if ("error" in parsed) {
    await audit(u, "import.upload", "import", null, "error", { file: file.name.slice(0, 120), error: parsed.error });
    redirect(`/admin/import?e=${encodeURIComponent(parsed.error)}`);
  }
  const job = (
    await q<{ id: number }>(
      `insert into import_jobs(kind, filename, status, mapping, total_rows, created_by, fund_id, columns, rows) values ('documents',$1,'preview',$2,$3,$4,$5,$6::text::jsonb,$7::text::jsonb) returning id`,
      [file.name.slice(0, 200), guessMapping(parsed.columns), parsed.rows.length, u.id, fund, JSON.stringify(parsed.columns), JSON.stringify(parsed.rows)],
    )
  )[0];
  await audit(u, "import.upload", "import", job.id, "ok", { file: file.name.slice(0, 120), rows: parsed.rows.length });
  redirect(`/admin/import/${job.id}`);
}

async function ownJob(u: Staff, id: number) {
  if (!can(u, "catalog.import")) redirect("/admin");
  const job = (await q<{ id: number; status: string; rows: string[][]; mapping: Record<string, number>; fund_id: number; filename: string; created_ids: number[] }>(
    `select id, status, rows, mapping, fund_id, filename, created_ids from import_jobs where id = $1`, [id],
  ))[0];
  if (!job) redirect("/admin/import");
  return job;
}

export async function saveMapping(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const job = await ownJob(u, id);
  if (job.status !== "preview") redirect(`/admin/import/${id}`);
  const { FIELDS } = await import("@/lib/importer");
  const m: Record<string, number> = {};
  for (const fl of FIELDS) {
    const v = s(f, `map_${fl.key}`, 6);
    if (v !== "" && /^\d+$/.test(v)) m[fl.key] = Number(v);
  }
  await q(`update import_jobs set mapping = $2 where id = $1`, [id, m]);
  redirect(`/admin/import/${id}`);
}

export async function runImport(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const job = await ownJob(u, id);
  if (job.status !== "preview") redirect(`/admin/import/${id}`);
  const { checkRows, toDocType } = await import("@/lib/importer");
  await q(`update import_jobs set status = 'running' where id = $1`, [id]);
  const checks = await checkRows(job.rows, job.mapping);
  const created: number[] = [];
  const errors: { row: number; error: string }[] = [];
  for (const c of checks) {
    if (c.errors.length) {
      errors.push({ row: c.n, error: c.errors.join("; ") });
      continue;
    }
    const v = c.values;
    try {
      // каждая строка сохраняется отдельно: сбой одной не откатывает остальные
      const yf = Number(v.year_from!.slice(0, 4));
      const row = (await q<{ id: number }>(
        `insert into documents(fund_id, branch_id, cipher, title, description, doc_type, date_text, year_from, year_to, place,
                               publish_status, status, created_by, updated_by, provenance, import_job_id)
         values ($1,(select branch_id from funds where id = $1),$2,$3,$4,$5,$6,$7,$8,$9,'needs_check','draft',$10,$10,$11,$12) returning id`,
        [
          job.fund_id, v.cipher, { ru: v.title_ru, ...(v.title_kk ? { kk: v.title_kk } : {}), ...(v.title_en ? { en: v.title_en } : {}) },
          v.desc_ru ? { ru: v.desc_ru } : null, toDocType(v.doc_type), v.date_text, yf, v.year_to ? Number(v.year_to.slice(0, 4)) : yf, v.place || null,
          u.id, `Импорт из файла «${job.filename}», строка ${c.n}`, id,
        ],
      ))[0];
      created.push(row.id);
    } catch (e) {
      errors.push({ row: c.n, error: "ошибка сохранения" });
      console.error("import row", c.n, String(e).slice(0, 200));
    }
  }
  await q(
    `update import_jobs set status = 'done', ok_rows = $2, failed_rows = $3, errors = $4::text::jsonb, created_ids = $5, finished_at = now() where id = $1`,
    [id, created.length, errors.length, JSON.stringify(errors), created],
  );
  await audit(u, "import.run", "import", id, "ok", { created: created.length, failed: errors.length });
  redirect(`/admin/import/${id}`);
}

export async function rollbackImport(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const job = await ownJob(u, id);
  if (job.status !== "done") redirect(`/admin/import/${id}`);
  // удаляются только записи этого импорта, которые остались черновиками и без файлов
  const del = await q<{ id: number }>(
    `delete from documents d where d.import_job_id = $1 and d.status = 'draft'
       and not exists (select 1 from document_files x where x.document_id = d.id) returning d.id`,
    [id],
  );
  const kept = job.created_ids.length - del.length;
  await q(`update import_jobs set status = 'rolled_back' where id = $1`, [id]);
  await audit(u, "import.rollback", "import", id, "ok", { deleted: del.length, kept });
  redirect(`/admin/import/${id}?info=${encodeURIComponent(`Удалено записей: ${del.length}.` + (kept ? ` Оставлено ${kept}: они уже изменены или ушли на согласование.` : ""))}`);
}

// ---------- Подборки «Большого архива памяти» и онлайн-выставки ----------

const TR: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i" };
const slugify = (t: string) =>
  t.toLowerCase().split("").map((c) => TR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";

type SKind = "collection" | "exhibition";
const isSKind = (k: string): k is SKind => k === "collection" || k === "exhibition";
const STABLE: Record<SKind, string> = { collection: "collections", exhibition: "exhibitions" };

async function needEdit(kind: SKind) {
  const u = await need();
  const { canEditEntity } = await import("@/lib/workflow");
  if (!canEditEntity(u, kind)) {
    await audit(u, `${kind}.edit`, kind, null, "denied");
    redirect(`/admin/showcase?kind=${kind}&e=${encodeURIComponent("Недостаточно прав")}`);
  }
  return u;
}

export async function createShowcase(f: FormData) {
  const kind = s(f, "kind", 20);
  if (!isSKind(kind)) redirect("/admin/showcase");
  const u = await needEdit(kind);
  const title = s(f, "title_ru", 300);
  const summary = s(f, "summary_ru", 2000);
  if (!title) redirect(`/admin/showcase/${kind}/new?e=${encodeURIComponent("Заполните название")}`);
  const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
  const row = kind === "collection"
    ? (await q<{ id: number }>(
        `insert into collections(slug, title, summary, editorial_note, status, created_by) values ($1,$2,$3,$4,'draft',$5) returning id`,
        [slug, { ru: title }, summary ? { ru: summary } : null, s(f, "editorial_ru", 2000) ? { ru: s(f, "editorial_ru", 2000) } : null, u.id],
      ))[0]
    : (await q<{ id: number }>(
        `insert into exhibitions(slug, title, description, status, created_by) values ($1,$2,$3,'draft',$4) returning id`,
        [slug, { ru: title }, summary ? { ru: summary } : null, u.id],
      ))[0];
  await audit(u, `${kind}.create`, kind, row.id, "ok");
  redirect(`/admin/showcase/${kind}/${row.id}?m=created`);
}

async function backToReviewIfPublished(u: Staff, kind: SKind, id: number) {
  // правка опубликованного без права публикации — снова на проверку
  const st = (await q<{ status: string }>(`select status from ${STABLE[kind]} where id = $1`, [id]))[0]?.status;
  if (st === "published" && !can(u, "content.publish")) {
    await q(`update ${STABLE[kind]} set status = 'review', published_at = null where id = $1`, [id]);
    await q(`insert into workflow_transitions(entity_type, entity_id, from_status, to_status, actor_id, comment) values ($1,$2,'published','review',$3,'Изменено после публикации — повторная проверка')`, [kind, id, u.id]);
  }
}

export async function saveShowcase(f: FormData) {
  const kind = s(f, "kind", 20);
  if (!isSKind(kind)) redirect("/admin/showcase");
  const u = await needEdit(kind);
  const id = Number(s(f, "id", 12));
  const title = s(f, "title_ru", 300);
  if (!title) redirect(`/admin/showcase/${kind}/${id}?e=${encodeURIComponent("Заполните название")}`);
  const summary = s(f, "summary_ru", 2000);
  if (kind === "collection") {
    const ed = s(f, "editorial_ru", 2000);
    await q(`update collections set title = $2, summary = $3, editorial_note = $4, updated_at = now(), version = version + 1 where id = $1`, [
      id, { ru: title }, summary ? { ru: summary } : null, ed ? { ru: ed } : null,
    ]);
  } else {
    await q(`update exhibitions set title = $2, description = $3, updated_at = now(), version = version + 1 where id = $1`, [id, { ru: title }, summary ? { ru: summary } : null]);
  }
  await backToReviewIfPublished(u, kind, id);
  await audit(u, `${kind}.update`, kind, id, "ok");
  redirect(`/admin/showcase/${kind}/${id}?m=saved`);
}

export async function addShowcaseItem(f: FormData) {
  const kind = s(f, "kind", 20);
  if (!isSKind(kind)) redirect("/admin/showcase");
  const u = await needEdit(kind);
  const id = Number(s(f, "id", 12));
  const what = s(f, "what", 10);
  const query = s(f, "query", 300);
  const note = s(f, "note", 1000);
  const back = (e: string) => redirect(`/admin/showcase/${kind}/${id}?e=${encodeURIComponent(e)}`);
  if (!query) back("Укажите шифр или название");
  const sort = (await q<{ n: number }>(
    kind === "collection" ? `select coalesce(max(sort), -1)::int + 1 n from collection_items where collection_id = $1` : `select coalesce(max(sort), -1)::int + 1 n from exhibits where exhibition_id = $1`,
    [id],
  ))[0].n;
  if (what === "event" && kind === "collection") {
    const ev = (await q<{ id: number; sources: string; title: { ru: string } }>(
      `select id, sources, title from historical_events where status = 'published' and title->>'ru' ilike $1 order by year limit 1`,
      [`%${query.replace(/[%_]/g, "")}%`],
    ))[0];
    if (!ev) back(`Событие «${query}» не найдено в хронологии`);
    await q(`insert into collection_items(collection_id, item_type, item_id, body, source, sort) values ($1,'event',$2,$3,$4,$5)`, [id, ev.id, note ? { ru: note } : null, ev.sources, sort]);
    await backToReviewIfPublished(u, kind, id);
    await audit(u, `${kind}.add_item`, kind, id, "ok", { event: ev.id });
    redirect(`/admin/showcase/${kind}/${id}?info=${encodeURIComponent(`Добавлено событие: «${ev.title.ru}»`)}`);
  }
  // только опубликованные записи с открытым описанием: в подборку и на выставку попадают разрешённые материалы
  const doc = (await q<{ id: number; cipher: string; title: { ru: string }; file: number | null }>(
    `select d.id, d.cipher, d.title,
            (select x.file_id from document_files x join digital_files m on m.id = x.file_id where x.document_id = d.id and m.access = 'public' order by x.sort limit 1) as file
     from documents d join funds f on f.id = d.fund_id
     where d.publish_status = 'public' and d.status = 'published' and f.publish_status = 'public' and f.status = 'published'
       and (lower(d.cipher) = lower($1) or d.title->>'ru' ilike $2)
     order by (lower(d.cipher) = lower($1)) desc, d.id limit 1`,
    [query, `%${query.replace(/[%_]/g, "")}%`],
  ))[0];
  if (!doc) back(`Среди опубликованных открытых записей каталога нет «${query}». Добавлять можно только их.`);
  if (kind === "collection") {
    await q(`insert into collection_items(collection_id, item_type, item_id, body, source, sort) values ($1,'document',$2,$3,$4,$5)`, [id, doc.id, note ? { ru: note } : null, doc.cipher, sort]);
  } else {
    if (!note) back("Для экспоната нужна подпись");
    await q(
      `insert into exhibits(exhibition_id, title, caption, source, document_id, file_id, rights_checked, sort) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, doc.title, { ru: note }, doc.cipher, doc.id, doc.file, f.get("rights") === "on", sort],
    );
  }
  await backToReviewIfPublished(u, kind, id);
  await audit(u, `${kind}.add_item`, kind, id, "ok", { document: doc.id });
  redirect(`/admin/showcase/${kind}/${id}?info=${encodeURIComponent(`Добавлено: «${doc.title.ru}» (${doc.cipher})`)}`);
}

export async function removeShowcaseItem(f: FormData) {
  const kind = s(f, "kind", 20);
  if (!isSKind(kind)) redirect("/admin/showcase");
  const u = await needEdit(kind);
  const id = Number(s(f, "id", 12));
  const item = Number(s(f, "item", 12));
  await q(kind === "collection" ? `delete from collection_items where id = $1 and collection_id = $2` : `delete from exhibits where id = $1 and exhibition_id = $2`, [item, id]);
  await backToReviewIfPublished(u, kind, id);
  await audit(u, `${kind}.remove_item`, kind, id, "ok", { item });
  redirect(`/admin/showcase/${kind}/${id}?m=saved`);
}

export async function toggleRights(f: FormData) {
  const u = await needEdit("exhibition");
  const id = Number(s(f, "id", 12));
  const item = Number(s(f, "item", 12));
  const on = s(f, "on", 2) === "1";
  await q(`update exhibits set rights_checked = $3 where id = $1 and exhibition_id = $2`, [item, id, on]);
  await audit(u, "exhibition.rights", "exhibit", item, "ok", { rights_checked: on });
  redirect(`/admin/showcase/exhibition/${id}?m=saved`);
}

export async function showcaseTransition(f: FormData) {
  const u = await need();
  const kind = s(f, "kind", 20);
  if (!isSKind(kind)) redirect("/admin/showcase");
  const id = Number(s(f, "id", 12));
  const { transitionEntity } = await import("@/lib/workflow");
  const r = await transitionEntity(u, kind, id, s(f, "t", 20) as Transition, s(f, "comment", 1000));
  redirect(`/admin/showcase/${kind}/${id}?${r.ok ? `m=${s(f, "t", 20)}` : `e=${encodeURIComponent(r.error)}`}`);
}

// ---------- Новости ----------

async function newsBranch(u: Staff, requested: number | null) {
  // администратор филиала пишет новости только от своего филиала
  if (can(u, "branches.edit_all") || !can(u, "branches.edit_own")) return requested;
  return u.branch_id;
}

export async function saveNews(f: FormData) {
  const u = await need();
  if (!can(u, "news.edit")) {
    await audit(u, "news.edit", "news", null, "denied");
    redirect("/admin?e=denied");
  }
  const id = Number(s(f, "id", 12)) || null;
  const title = s(f, "title_ru", 300);
  const body = s(f, "body_ru", 20000);
  const back = (e: string) => redirect(`/admin/news/${id ?? "new"}?e=${encodeURIComponent(e)}`);
  if (!title) back("Заполните заголовок");
  const cat = s(f, "category", 30);
  const branchReq = Number(s(f, "branch_id", 6)) || null;
  const branch = await newsBranch(u, branchReq);
  const values = [
    { ru: title, ...(s(f, "title_kk", 300) ? { kk: s(f, "title_kk", 300) } : {}), ...(s(f, "title_en", 300) ? { en: s(f, "title_en", 300) } : {}) },
    s(f, "summary_ru", 600) ? { ru: s(f, "summary_ru", 600) } : null,
    body ? { ru: body } : null,
    cat || null,
    branch,
  ];
  if (!id) {
    const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
    const row = (await q<{ id: number }>(
      `insert into news(slug, title, summary, body, category_id, branch_id, status, created_by)
       values ($1,$2,$3,$4,(select id from categories where kind = 'news' and slug = $5),$6,'draft',$7) returning id`,
      [slug, ...values, u.id],
    ))[0];
    await audit(u, "news.create", "news", row.id, "ok");
    redirect(`/admin/news/${row.id}?m=created`);
  }
  const cur = (await q<{ branch_id: number | null; status: string }>(`select branch_id, status from news where id = $1`, [id]))[0];
  if (!cur) redirect("/admin/news");
  if (can(u, "branches.edit_own") && !can(u, "branches.edit_all") && cur.branch_id !== u.branch_id) {
    await audit(u, "news.update", "news", id, "denied", { reason: "not_own_branch" });
    redirect(`/admin/news?e=${encodeURIComponent("Можно менять только новости своего филиала")}`);
  }
  await q(
    `update news set title = $2, summary = $3, body = $4, category_id = (select id from categories where kind = 'news' and slug = $5), branch_id = $6,
       updated_at = now(), version = version + 1,
       status = case when status = 'published' and not $7 then 'review' else status end,
       published_at = case when status = 'published' and not $7 then null else published_at end
     where id = $1`,
    [id, ...values, can(u, "content.publish")],
  );
  await audit(u, "news.update", "news", id, "ok");
  redirect(`/admin/news/${id}?m=saved`);
}

export async function newsTransition(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  const cur = (await q<{ branch_id: number | null }>(`select branch_id from news where id = $1`, [id]))[0];
  if (cur && can(u, "branches.edit_own") && !can(u, "branches.edit_all") && cur.branch_id !== u.branch_id) {
    await audit(u, "workflow", "news", id, "denied", { reason: "not_own_branch" });
    redirect(`/admin/news?e=${encodeURIComponent("Можно работать только с новостями своего филиала")}`);
  }
  const { transitionEntity } = await import("@/lib/workflow");
  const r = await transitionEntity(u, "news", id, s(f, "t", 20) as Transition, s(f, "comment", 1000));
  redirect(`/admin/news/${id}?${r.ok ? `m=${s(f, "t", 20)}` : `e=${encodeURIComponent(r.error)}`}`);
}

// ---------- Информационные страницы ----------

export async function savePage(f: FormData) {
  const u = await need();
  const id = Number(s(f, "id", 12));
  if (!can(u, "pages.edit")) {
    await audit(u, "page.update", "page", id, "denied");
    redirect("/admin?e=denied");
  }
  const cur = (await q<{ version: number; title: unknown; body: unknown }>(`select version, title, body from pages where id = $1`, [id]))[0];
  if (!cur) redirect("/admin/pages");
  const t = { ru: s(f, "title_ru", 200), ...(s(f, "title_kk", 200) ? { kk: s(f, "title_kk", 200) } : {}), ...(s(f, "title_en", 200) ? { en: s(f, "title_en", 200) } : {}) };
  const b = { ru: s(f, "body_ru", 40000), ...(s(f, "body_kk", 40000) ? { kk: s(f, "body_kk", 40000) } : {}), ...(s(f, "body_en", 40000) ? { en: s(f, "body_en", 40000) } : {}) };
  if (!t.ru || !b.ru) redirect(`/admin/pages/${id}?e=${encodeURIComponent("Заголовок и текст на русском обязательны")}`);
  // прежняя версия сохраняется, чтобы её можно было восстановить
  await q(`insert into content_versions(entity_type, entity_id, version, data, author_id) values ('page',$1,$2,$3,$4) on conflict do nothing`, [
    id, cur.version, { title: cur.title, body: cur.body }, u.id,
  ]);
  await q(`update pages set title = $2, body = $3, i18n_status = $4, updated_by = $5, updated_at = now(), version = version + 1 where id = $1`, [
    id, t, b, { kk: b.kk ? "machine" : "none", en: b.en ? "machine" : "none" }, u.id,
  ]);
  await audit(u, "page.update", "page", id, "ok", { version: cur.version + 1 });
  redirect(`/admin/pages/${id}?m=saved`);
}
