// Сводка для раздела «Аналитика» (ТЗ 5.8 Д): обезличенные цифры за 30 дней и правила-рекомендации.
import { q } from "./db";

const SECTION: Record<string, string> = {
  "/": "Главная", "/catalog": "Фонды (каталог)", "/search": "Поиск", "/assistant": "Помощник", "/exhibitions": "Выставки",
  "/chronicle": "Летопись ВКО", "/branches": "Филиалы", "/news": "Новости", "/about": "Об архиве", "/services": "Услуги",
  "/faq": "Частые вопросы", "/help": "Как пользоваться сайтом", "/useful": "Полезные ссылки", "/anticorruption": "Противодействие коррупции", "/privacy": "Конфиденциальность",
};
const AI_MODE: Record<string, string> = { model: "Ответ с источниками", template: "Ответ по шаблону", empty: "Нет данных", restricted: "Закрытые сведения" };

export async function siteStats() {
  const [views, searches, empty, ai, notFound, catalog, stale] = await Promise.all([
    q<{ path: string; n: number }>(`select path, count(*)::int n from page_events where event = 'view' and at > now() - interval '30 days' group by path order by n desc`),
    q<{ value: string; n: number }>(`select value, count(*)::int n from page_events where event = 'search' and at > now() - interval '30 days' group by value order by n desc limit 10`),
    q<{ value: string; n: number }>(`select value, count(*)::int n from page_events where event = 'search_empty' and at > now() - interval '30 days' group by value order by n desc limit 10`),
    q<{ mode: string; n: number }>(`select split_part(value, ':', 1) mode, count(*)::int n from page_events where event = 'ai_answer' and at > now() - interval '30 days' group by 1 order by 2 desc`),
    q<{ value: string; n: number }>(`select value, count(*)::int n from page_events where event = 'not_found' and at > now() - interval '30 days' group by value order by n desc limit 8`),
    q<{ docs: number; with_copy: number; no_publish: number; funds: number }>(
      `select (select count(*)::int from documents where status = 'published' and publish_status = 'public') docs,
              (select count(*)::int from documents d where d.status = 'published' and d.publish_status = 'public'
                 and exists (select 1 from document_files x join digital_files m on m.id = x.file_id where x.document_id = d.id and m.access = 'public')) with_copy,
              (select count(*)::int from documents where publish_status <> 'public') no_publish,
              (select count(*)::int from funds where status = 'published' and publish_status = 'public') funds`,
    ),
    q<{ title: { ru: string }; slug: string; days: number }>(
      `select title, slug, (current_date - updated_at::date)::int days from pages where status = 'published' and updated_at < now() - interval '180 days' order by updated_at limit 8`,
    ).catch(() => []),
  ]);
  const totalViews = views.reduce((s, v) => s + v.n, 0);
  const searchTotal = searches.reduce((s, v) => s + v.n, 0);
  const emptyTotal = empty.reduce((s, v) => s + v.n, 0);
  const aiTotal = ai.reduce((s, v) => s + v.n, 0);
  const c = catalog[0];

  // правила: что дополнить и что исправить
  const tips: string[] = [];
  if (emptyTotal && searchTotal + emptyTotal > 0) {
    const share = Math.round((emptyTotal / (searchTotal + emptyTotal)) * 100);
    tips.push(`${share}% запросов к каталогу остаются без результатов. Чаще всего не находят: ${empty.slice(0, 3).map((e) => `«${e.value}»`).join(", ")}. Проверьте, есть ли такие материалы в фондах, и опубликуйте описания или добавьте варианты написания.`);
  }
  if (c && c.docs && c.with_copy / c.docs < 0.5) {
    tips.push(`Цифровые копии есть у ${c.with_copy} из ${c.docs} опубликованных документов. В первую очередь стоит оцифровать то, что чаще ищут: ${searches.slice(0, 3).map((e) => `«${e.value}»`).join(", ") || "популярные темы"}.`);
  }
  const noAnswer = ai.find((a) => a.mode === "empty")?.n ?? 0;
  if (aiTotal && noAnswer / aiTotal > 0.2) tips.push(`Помощник не нашёл ответа в ${Math.round((noAnswer / aiTotal) * 100)}% вопросов. Дополните частые вопросы и описания фондов по этим темам.`);
  if (notFound.length) tips.push(`Посетители попадают на несуществующие адреса (${notFound.slice(0, 3).map((x) => x.value).join(", ")}). Добавьте перенаправления или исправьте ссылки.`);
  for (const p of stale.slice(0, 3)) tips.push(`Страница «${p.title.ru}» не обновлялась ${p.days} дн. Проверьте, актуальны ли сведения.`);
  const quiet = Object.keys(SECTION).filter((k) => totalViews > 50 && !views.some((v) => v.path === k));
  if (quiet.length) tips.push(`Разделы без посещений за месяц: ${quiet.map((k) => SECTION[k]).join(", ")}. Добавьте на них ссылки с главной или из меню.`);
  if (!tips.length) tips.push("Данных пока мало: рекомендации появятся, когда накопится статистика посещений и поиска.");

  // сводка для модели — только агрегаты, без персональных данных
  const brief = [
    `Просмотры разделов за 30 дней (всего ${totalViews}): ${views.slice(0, 10).map((v) => `${SECTION[v.path] ?? v.path} — ${v.n}`).join("; ") || "нет данных"}.`,
    `Частые запросы к каталогу: ${searches.map((s) => `${s.value} (${s.n})`).join("; ") || "нет"}.`,
    `Запросы без результатов: ${empty.map((s) => `${s.value} (${s.n})`).join("; ") || "нет"}.`,
    `Ответы помощника: ${ai.map((a) => `${AI_MODE[a.mode] ?? a.mode} — ${a.n}`).join("; ") || "нет"}.`,
    c ? `Каталог: ${c.funds} фондов, ${c.docs} опубликованных документов, из них с цифровой копией ${c.with_copy}; закрытых или не проверенных описаний ${c.no_publish}.` : "",
    `Несуществующие адреса: ${notFound.map((x) => `${x.value} (${x.n})`).join("; ") || "нет"}.`,
    `Давно не обновлялись: ${stale.map((p) => `${p.title.ru} (${p.days} дн.)`).join("; ") || "нет"}.`,
  ].join("\n");

  return { views, searches, empty, ai, notFound, catalog: c, stale, totalViews, searchTotal, emptyTotal, aiTotal, tips, brief, SECTION, AI_MODE };
}
