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
