// Информационные страницы, новости и календарь памятных дат.
import { q } from "./db";
import type { L10n } from "@/i18n/dict";

export type Page = { slug: string; title: L10n; body: L10n | null; source: string | null; updated_at: string };

export async function getPage(slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  return (await q<Page>(`select slug, title, body, source, to_char(updated_at, 'DD.MM.YYYY') updated_at from pages where slug = $1 and status = 'published'`, [slug]))[0] ?? null;
}

export async function listAboutPages() {
  return q<{ slug: string; title: L10n }>(`select slug, title from pages where section = 'about' and status = 'published' order by sort`);
}

export type NewsRow = { slug: string; title: L10n; summary: L10n | null; date: string; iso: string; category: string | null; category_name: L10n | null; is_demo: boolean; branch: L10n | null };

export async function listNews(opts: { category?: string; limit?: number; offset?: number } = {}) {
  const cat = opts.category && /^[a-z-]{2,30}$/.test(opts.category) ? opts.category : null;
  const where = `n.status = 'published' and ($1::text is null or c.slug = $1)`;
  const rows = await q<NewsRow>(
    `select n.slug, n.title, n.summary, to_char(n.published_at, 'DD.MM.YYYY') date, n.published_at::date::text iso, c.slug category, c.name category_name, n.is_demo, b.short_name branch
     from news n left join categories c on c.id = n.category_id left join branches b on b.id = n.branch_id
     where ${where} order by n.published_at desc, n.id desc limit $2 offset $3`,
    [cat, opts.limit ?? 20, opts.offset ?? 0],
  );
  const total = (await q<{ n: number }>(`select count(*)::int n from news n left join categories c on c.id = n.category_id where ${where}`, [cat]))[0].n;
  return { rows, total };
}

export async function getNews(slug: string) {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  return (
    await q<NewsRow & { body: L10n | null }>(
      `select n.slug, n.title, n.summary, n.body, to_char(n.published_at, 'DD.MM.YYYY') date, n.published_at::date::text iso, c.slug category, c.name category_name, n.is_demo, b.short_name branch
       from news n left join categories c on c.id = n.category_id left join branches b on b.id = n.branch_id
       where n.slug = $1 and n.status = 'published'`,
      [slug],
    )
  )[0] ?? null;
}

export async function newsCategories() {
  return q<{ slug: string; name: L10n }>(`select slug, name from categories where kind = 'news' order by sort`);
}

export type CalendarRow = { title: L10n; date_text: string | null; year: number; month: number | null; day: number | null };

// Календарь памятных дат на год: события из календаря этого года (материалы архива)
export async function calendarFor(year: number) {
  return q<CalendarRow>(
    `select title, date_text, year, month, day from historical_events where status = 'published' and $1 = any(calendar_years)
     order by coalesce(month, 13), coalesce(day, 32), year`,
    [year],
  );
}

export async function calendarYears() {
  return (await q<{ y: number }>(`select distinct unnest(calendar_years) y from historical_events order by y desc`)).map((r) => r.y);
}

// ближайшие памятные даты — для главной
export async function upcomingDates(limit = 3) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return q<CalendarRow>(
    `select title, date_text, year, month, day from historical_events
     where status = 'published' and $1 = any(calendar_years) and month is not null and (month > $2 or (month = $2 and coalesce(day, 32) >= $3))
     order by month, coalesce(day, 32), year limit $4`,
    [y, m, d, limit],
  );
}
