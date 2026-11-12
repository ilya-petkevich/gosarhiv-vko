// Согласование публикаций (ТЗ 6.7, доп. ТЗ 3.5). Все проверки — на сервере, для каждого объекта.
//
// Статусы: draft → review → (rework | approved) → published → archived.
// - отправить на проверку: автор с правом создания/редактирования;
// - вернуть на доработку / одобрить: content.review;
// - опубликовать: content.publish и только если описание открыто (publish_status = public):
//   смена статуса не обходит проверку прав на публикацию закрытых материалов;
// - каждое изменение статуса пишется в workflow_transitions и в журнал; при сохранении — новая версия.

import { q } from "./db";
import { audit, can, type Staff } from "./auth";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  review: "На проверке",
  rework: "Требует доработки",
  approved: "Одобрено",
  published: "Опубликовано",
  archived: "Архивировано",
};
export const PUBLISH_LABEL: Record<string, string> = { public: "Публично", no_publish: "Не публиковать", needs_check: "Требует проверки" };

export type Transition = "submit" | "rework" | "approve" | "publish" | "unpublish" | "archive";

const RULES: Record<Transition, { from: string[]; to: string; perms: string[] }> = {
  submit: { from: ["draft", "rework"], to: "review", perms: ["content.create", "content.edit", "catalog.edit"] },
  rework: { from: ["review", "approved"], to: "rework", perms: ["content.review"] },
  approve: { from: ["review"], to: "approved", perms: ["content.review"] },
  publish: { from: ["approved"], to: "published", perms: ["content.publish"] },
  unpublish: { from: ["published"], to: "review", perms: ["content.publish"] },
  archive: { from: ["published", "approved", "draft", "rework"], to: "archived", perms: ["content.publish"] },
};

export type Kind = "document" | "collection" | "exhibition" | "news";

const ENT: Record<Kind, { table: string; label: string; link: (id: number) => string; editPerms: string[] }> = {
  document: { table: "documents", label: "запись", link: (id) => `/admin/catalog/${id}`, editPerms: ["content.create", "content.edit", "catalog.edit"] },
  collection: { table: "collections", label: "подборка", link: (id) => `/admin/showcase/collection/${id}`, editPerms: ["memory.edit"] },
  exhibition: { table: "exhibitions", label: "выставка", link: (id) => `/admin/showcase/exhibition/${id}`, editPerms: ["exhibitions.edit"] },
  news: { table: "news", label: "новость", link: (id) => `/admin/news/${id}`, editPerms: ["news.edit"] },
};
export const entityLink = (kind: Kind, id: number) => ENT[kind].link(id);
export const canEditEntity = (user: Staff, kind: Kind) => can(user, ...ENT[kind].editPerms);

const permsFor = (kind: Kind, t: Transition) => (t === "submit" ? ENT[kind].editPerms : RULES[t].perms);

// Проверка «вторым человеком»: автор не одобряет и не публикует свой материал сам (ТЗ 6.7)
const SELF_BLOCKED: Transition[] = ["approve", "publish"];

export function allowedTransitions(user: Staff, status: string, publishStatus: string | null, kind: Kind = "document", createdBy: string | null = null): Transition[] {
  return (Object.keys(RULES) as Transition[]).filter(
    (t) =>
      RULES[t].from.includes(status) &&
      can(user, ...permsFor(kind, t)) &&
      !(t === "publish" && kind === "document" && publishStatus !== "public") &&
      !(SELF_BLOCKED.includes(t) && createdBy === user.id),
  );
}

// Что мешает опубликовать подборку или выставку: только открытые опубликованные материалы, с источниками
// и проверенным правом на публикацию (доп. ТЗ 3.2)
export async function publishProblems(kind: Kind, id: number): Promise<string[]> {
  if (kind === "collection") {
    const items = await q<{ n: number; bad: number }>(
      `select count(*)::int n,
              count(*) filter (where (i.item_type = 'document' and not exists (
                 select 1 from documents d join funds f on f.id = d.fund_id where d.id = i.item_id
                 and d.publish_status = 'public' and d.status = 'published' and f.publish_status = 'public' and f.status = 'published'))
               or (i.item_type = 'event' and not exists (select 1 from historical_events e where e.id = i.item_id and e.status = 'published'))
               or coalesce(i.source, '') = '')::int bad
       from collection_items i where i.collection_id = $1`,
      [id],
    );
    const out = [];
    if (!items[0].n) out.push("в подборке нет материалов");
    if (items[0].bad) out.push(`материалов закрытых, неопубликованных или без источника: ${items[0].bad}`);
    return out;
  }
  if (kind === "exhibition") {
    const items = await q<{ n: number; closed: number; rights: number }>(
      `select count(*)::int n,
              count(*) filter (where not exists (select 1 from documents d join funds f on f.id = d.fund_id where d.id = x.document_id
                 and d.publish_status = 'public' and d.status = 'published' and f.publish_status = 'public' and f.status = 'published'))::int closed,
              count(*) filter (where not x.rights_checked)::int rights
       from exhibits x where x.exhibition_id = $1`,
      [id],
    );
    const out = [];
    if (!items[0].n) out.push("в выставке нет экспонатов");
    if (items[0].closed) out.push(`экспонатов из закрытых или неопубликованных записей: ${items[0].closed}`);
    if (items[0].rights) out.push(`экспонатов без отметки о проверке права на публикацию: ${items[0].rights}`);
    return out;
  }
  if (kind === "news") {
    const n = (await q<{ body: { ru?: string } | null; title: { ru?: string } }>(`select title, body from news where id = $1`, [id]))[0];
    const out = [];
    if (!n?.title?.ru) out.push("нет заголовка");
    if (!n?.body?.ru) out.push("нет текста новости");
    return out;
  }
  return [];
}

export async function transitionEntity(user: Staff, kind: Kind, id: number, t: Transition, comment: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Object.prototype.hasOwnProperty.call(RULES, t) || !ENT[kind]) return { ok: false, error: "Неизвестное действие" };
  const rule = RULES[t];
  const e = ENT[kind];
  const row = (await q<{ status: string; publish_status: string | null; title: { ru: string }; created_by: string | null }>(
    `select status, ${kind === "document" ? "publish_status" : "null::text as publish_status"}, title, created_by from ${e.table} where id = $1`,
    [id],
  ))[0];
  if (!row) return { ok: false, error: "Не найдено" };
  if (!can(user, ...permsFor(kind, t))) {
    await audit(user, `workflow.${t}`, kind, id, "denied", { reason: "no_permission" });
    return { ok: false, error: "Недостаточно прав для этого действия" };
  }
  if (!rule.from.includes(row.status)) {
    await audit(user, `workflow.${t}`, kind, id, "denied", { reason: "wrong_status", status: row.status });
    return { ok: false, error: `Из статуса «${STATUS_LABEL[row.status]}» это действие недоступно` };
  }
  if (SELF_BLOCKED.includes(t) && row.created_by === user.id) {
    await audit(user, `workflow.${t}`, kind, id, "denied", { reason: "own_material" });
    return { ok: false, error: "Свой материал одобряет и публикует другой сотрудник" };
  }
  if (t === "publish" && kind === "document" && row.publish_status !== "public") {
    await audit(user, `workflow.${t}`, kind, id, "denied", { reason: "not_public", publish_status: row.publish_status });
    return { ok: false, error: "Запись со статусом доступа «" + PUBLISH_LABEL[row.publish_status ?? ""] + "» нельзя опубликовать" };
  }
  if (t === "publish" || t === "approve") {
    const problems = await publishProblems(kind, id);
    if (problems.length) {
      await audit(user, `workflow.${t}`, kind, id, "denied", { reason: "content", problems });
      return { ok: false, error: `Нельзя ${t === "publish" ? "опубликовать" : "одобрить"}: ${problems.join("; ")}` };
    }
  }
  if (t === "rework" && !comment.trim()) return { ok: false, error: "Напишите, что нужно доработать" };

  await q(
    `update ${e.table} set status = $2, ${kind === "document" ? "updated_by = $3," : ""} updated_at = now(),
       approved_by = case when $2 in ('approved','published') then coalesce(approved_by, $3) when $2 in ('rework','review','draft') then null else approved_by end,
       published_at = case when $2 = 'published' then now() else null end
     where id = $1`,
    [id, rule.to, user.id],
  );
  await q(`insert into workflow_transitions(entity_type, entity_id, from_status, to_status, actor_id, comment) values ($1,$2,$3,$4,$5,$6)`, [
    kind, id, row.status, rule.to, user.id, comment.trim().slice(0, 1000) || null,
  ]);
  await audit(user, `workflow.${t}`, kind, id, "ok", { from: row.status, to: rule.to });

  // уведомления: на проверку — тем, кто проверяет; на доработку — автору
  if (rule.to === "review") {
    await q(
      `insert into notifications(user_id, text, link)
       select distinct ur.user_id, $1, $2 from user_roles ur join role_permissions rp on rp.role_code = ur.role_code
       where rp.perm_code = 'content.review' and ur.user_id <> $3`,
      [`На проверку (${e.label}): «${row.title.ru}»`, e.link(id), user.id],
    );
  }
  if (rule.to === "rework") {
    await q(`insert into notifications(user_id, text, link) select created_by, $1, $2 from ${e.table} where id = $3 and created_by is not null`, [
      `Нужна доработка (${e.label}): «${row.title.ru}»`, e.link(id), id,
    ]);
  }
  return { ok: true };
}

export const transitionDocument = (user: Staff, id: number, t: Transition, comment: string) => transitionEntity(user, "document", id, t, comment);

// ---------- Филиалы: администратор филиала меняет только свой ----------

export function canEditBranch(user: Staff, branchId: number) {
  return can(user, "branches.edit_all") || (can(user, "branches.edit_own") && user.branch_id === branchId);
}
