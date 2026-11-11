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

export function allowedTransitions(user: Staff, status: string, publishStatus: string): Transition[] {
  return (Object.keys(RULES) as Transition[]).filter(
    (t) => RULES[t].from.includes(status) && can(user, ...RULES[t].perms) && !(t === "publish" && publishStatus !== "public"),
  );
}

export async function transitionDocument(user: Staff, id: number, t: Transition, comment: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Object.prototype.hasOwnProperty.call(RULES, t)) return { ok: false, error: "Неизвестное действие" };
  const rule = RULES[t];
  const doc = (await q<{ status: string; publish_status: string; title: { ru: string } }>(`select status, publish_status, title from documents where id = $1`, [id]))[0];
  if (!doc) return { ok: false, error: "Запись не найдена" };
  if (!can(user, ...rule.perms)) {
    await audit(user, `workflow.${t}`, "document", id, "denied", { reason: "no_permission" });
    return { ok: false, error: "Недостаточно прав для этого действия" };
  }
  if (!rule.from.includes(doc.status)) {
    await audit(user, `workflow.${t}`, "document", id, "denied", { reason: "wrong_status", status: doc.status });
    return { ok: false, error: `Из статуса «${STATUS_LABEL[doc.status]}» это действие недоступно` };
  }
  if (t === "publish" && doc.publish_status !== "public") {
    await audit(user, `workflow.${t}`, "document", id, "denied", { reason: "not_public", publish_status: doc.publish_status });
    return { ok: false, error: "Запись со статусом доступа «" + PUBLISH_LABEL[doc.publish_status] + "» нельзя опубликовать" };
  }
  if (t === "rework" && !comment.trim()) return { ok: false, error: "Напишите, что нужно доработать" };

  await q(
    `update documents set status = $2, updated_by = $3, updated_at = now(),
       approved_by = case when $2 in ('approved','published') then coalesce(approved_by, $3) when $2 in ('rework','review','draft') then null else approved_by end,
       published_at = case when $2 = 'published' then now() when $2 <> 'published' then null else published_at end
     where id = $1`,
    [id, rule.to, user.id],
  );
  await q(`insert into workflow_transitions(entity_type, entity_id, from_status, to_status, actor_id, comment) values ('document',$1,$2,$3,$4,$5)`, [
    id, doc.status, rule.to, user.id, comment.trim().slice(0, 1000) || null,
  ]);
  await audit(user, `workflow.${t}`, "document", id, "ok", { from: doc.status, to: rule.to });

  // уведомления: на проверку — тем, кто проверяет; на доработку — автору
  if (rule.to === "review") {
    await q(
      `insert into notifications(user_id, text, link)
       select distinct ur.user_id, $1, $2 from user_roles ur join role_permissions rp on rp.role_code = ur.role_code
       where rp.perm_code = 'content.review' and ur.user_id <> $3`,
      [`На проверку: «${doc.title.ru}»`, `/admin/catalog/${id}`, user.id],
    );
  }
  if (rule.to === "rework") {
    await q(
      `insert into notifications(user_id, text, link) select created_by, $1, $2 from documents where id = $3 and created_by is not null`,
      [`Нужна доработка: «${doc.title.ru}»`, `/admin/catalog/${id}`, id],
    );
  }
  return { ok: true };
}

// ---------- Филиалы: администратор филиала меняет только свой ----------

export function canEditBranch(user: Staff, branchId: number) {
  return can(user, "branches.edit_all") || (can(user, "branches.edit_own") && user.branch_id === branchId);
}
