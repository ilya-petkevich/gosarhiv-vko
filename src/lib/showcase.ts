// Онлайн-выставки (ТЗ 5.7) и «Большой архив памяти» — исторические подборки и хронология (ТЗ 5.6, 8.2).
// На сайте видны только опубликованные выставки и подборки, а внутри них — только открытые
// опубликованные записи каталога: если запись закрыли, она исчезает и из выставки (доп. ТЗ 3.1, 3.2).

import { q } from "./db";
import { DOC_VISIBLE, FUND_VISIBLE } from "./catalog";
import type { L10n } from "@/i18n/dict";

// облегчённая копия открытого мастер-файла (или сам файл, если копии нет)
const SERVED = (col: string) =>
  `(select coalesce((select pv.id from digital_files pv where pv.master_id = m.id and pv.kind = 'preview' limit 1), m.id)
    from digital_files m where m.id = ${col} and m.access = 'public')`;
const FIRST_FILE = `(select x.file_id from document_files x join digital_files m on m.id = x.file_id where x.document_id = d.id and m.access = 'public' order by x.sort limit 1)`;

export type ExhibitionCard = { slug: string; title: L10n; description: L10n | null; is_demo: boolean; count: number; cover: number | null };

// фильтр по тематике и историческому периоду (ТЗ 5.7): период — по годам документов-экспонатов
export async function listExhibitions(opts: { category?: string; period?: string } = {}) {
  const cat = opts.category && /^[a-z-]{2,30}$/.test(opts.category) ? opts.category : null;
  const p = PERIODS.find((x) => x.key === opts.period);
  return q<ExhibitionCard>(
    `select e.slug, e.title, e.description, e.is_demo,
            (select count(*)::int from exhibits x join documents d on d.id = x.document_id join funds f on f.id = d.fund_id where x.exhibition_id = e.id and ${DOC_VISIBLE} and ${FUND_VISIBLE}) as count,
            (select ${SERVED("coalesce(x.file_id, " + FIRST_FILE + ")")} from exhibits x join documents d on d.id = x.document_id join funds f on f.id = d.fund_id
              where x.exhibition_id = e.id and ${DOC_VISIBLE} and ${FUND_VISIBLE} order by x.sort limit 1) as cover
     from exhibitions e left join categories c on c.id = e.category_id
     where e.status = 'published' and ($1::text is null or c.slug = $1)
       and ($2::int is null or exists (select 1 from exhibits x join documents d on d.id = x.document_id
             where x.exhibition_id = e.id and coalesce(d.year_to, d.year_from) >= $2 and d.year_from <= $3))
     order by e.published_at desc nulls last, e.id`,
    [cat, p?.from ?? null, p?.to ?? null],
  );
}

export async function exhibitionCategories() {
  return q<{ slug: string; name: L10n }>(
    `select c.slug, c.name from categories c where c.kind = 'exhibition' and exists (select 1 from exhibitions e where e.category_id = c.id and e.status = 'published') order by c.sort`,
  );
}

export type Exhibit = { id: number; title: L10n; caption: L10n | null; source: string; uid: string; date_text: string | null; file: number | null; mime: string | null; doc_title: L10n };

export async function getExhibition(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const e = (await q<{ id: number; slug: string; title: L10n; description: L10n | null; is_demo: boolean }>(
    `select id, slug, title, description, is_demo from exhibitions where slug = $1 and status = 'published'`,
    [slug],
  ))[0];
  if (!e) return null;
  const items = await q<Exhibit>(
    `select x.id, x.title, x.caption, x.source, d.uid, d.date_text, d.title as doc_title,
            ${SERVED("coalesce(x.file_id, " + FIRST_FILE + ")")} as file,
            (select mm.mime from digital_files mm where mm.id = ${SERVED("coalesce(x.file_id, " + FIRST_FILE + ")")}) as mime
     from exhibits x join documents d on d.id = x.document_id join funds f on f.id = d.fund_id
     where x.exhibition_id = $1 and x.rights_checked and ${DOC_VISIBLE} and ${FUND_VISIBLE} order by x.sort, x.id`,
    [e.id],
  );
  return { ...e, items };
}

export type CollectionCard = { slug: string; title: L10n; summary: L10n | null; is_demo: boolean; count: number; cover: number | null };

export async function listCollections() {
  return q<CollectionCard>(
    `select c.slug, c.title, c.summary, c.is_demo,
            (select count(*)::int from collection_items i where i.collection_id = c.id) as count,
            (select ${SERVED(FIRST_FILE)} from collection_items i join documents d on d.id = i.item_id join funds f on f.id = d.fund_id
              where i.collection_id = c.id and i.item_type = 'document' and ${DOC_VISIBLE} and ${FUND_VISIBLE} and ${FIRST_FILE} is not null order by i.sort limit 1) as cover
     from collections c where c.status = 'published' order by c.published_at desc nulls last, c.id`,
  );
}

export type CollectionItem =
  | { kind: "document"; note: L10n | null; source: string | null; uid: string; title: L10n; date_text: string | null; cipher: string | null; file: number | null; doc_type: string }
  | { kind: "event"; note: L10n | null; source: string | null; title: L10n; date_text: string | null; year: number };

export async function getCollection(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const c = (await q<{ id: number; title: L10n; summary: L10n | null; editorial_note: L10n | null; is_demo: boolean }>(
    `select id, title, summary, editorial_note, is_demo from collections where slug = $1 and status = 'published'`,
    [slug],
  ))[0];
  if (!c) return null;
  const docs = await q<{ sort: number; note: L10n | null; source: string | null; uid: string; title: L10n; date_text: string | null; cipher: string | null; file: number | null; doc_type: string }>(
    `select i.sort, i.body as note, i.source, d.uid, d.title, d.date_text, d.cipher, d.doc_type, ${SERVED(FIRST_FILE)} as file
     from collection_items i join documents d on d.id = i.item_id join funds f on f.id = d.fund_id
     where i.collection_id = $1 and i.item_type = 'document' and ${DOC_VISIBLE} and ${FUND_VISIBLE}`,
    [c.id],
  );
  const events = await q<{ sort: number; note: L10n | null; source: string | null; title: L10n; date_text: string | null; year: number }>(
    `select i.sort, i.body as note, i.source, e.title, e.date_text, e.year
     from collection_items i join historical_events e on e.id = i.item_id
     where i.collection_id = $1 and i.item_type = 'event' and e.status = 'published'`,
    [c.id],
  );
  const items: (CollectionItem & { sort: number })[] = [
    ...docs.map((d) => ({ kind: "document" as const, ...d })),
    ...events.map((e) => ({ kind: "event" as const, ...e })),
  ].sort((a, b) => a.sort - b.sort);
  return { ...c, items };
}

export const PERIODS = [
  { key: "pre1900", label: { ru: "до 1900", kk: "1900 дейін", en: "before 1900" }, from: 1000, to: 1899 },
  { key: "1900-1916", label: { ru: "1900–1916", kk: "1900–1916", en: "1900–1916" }, from: 1900, to: 1916 },
  { key: "1917-1940", label: { ru: "1917–1940", kk: "1917–1940", en: "1917–1940" }, from: 1917, to: 1940 },
  { key: "1941-1945", label: { ru: "1941–1945", kk: "1941–1945", en: "1941–1945" }, from: 1941, to: 1945 },
  { key: "1946-1990", label: { ru: "1946–1990", kk: "1946–1990", en: "1946–1990" }, from: 1946, to: 1990 },
  { key: "1991", label: { ru: "с 1991", kk: "1991 жылдан", en: "since 1991" }, from: 1991, to: 2100 },
] as const;

export type EventRow = { slug: string; title: L10n; date_text: string | null; year: number; theme: string | null; theme_name: L10n | null; sources: string | null };

export async function listEvents(period?: string, theme?: string) {
  const p = PERIODS.find((x) => x.key === period);
  return q<EventRow>(
    `select e.slug, e.title, e.date_text, e.year, c.slug as theme, c.name as theme_name, e.sources
     from historical_events e left join categories c on c.id = e.category_id
     where e.status = 'published' and ($1::int is null or e.year between $1 and $2) and ($3::text is null or c.slug = $3)
     order by e.year, e.id`,
    [p?.from ?? null, p?.to ?? null, theme && /^[a-z-]{2,20}$/.test(theme) ? theme : null],
  );
}

export async function eventThemes() {
  return q<{ slug: string; name: L10n; n: number }>(
    `select c.slug, c.name, count(e.id)::int n from categories c left join historical_events e on e.category_id = c.id and e.status = 'published'
     where c.kind = 'chronicle' group by c.slug, c.name, c.sort order by c.sort`,
  );
}

// Исторические личности (ТЗ 5.6): отдельные страницы, связанные события хронологии и записи каталога
export type PersonCard = { slug: string; name: L10n; years: string | null; biography: L10n | null; sources: string | null; match: string | null };

export async function listPersons() {
  return q<PersonCard>(`select slug, name, years, biography, sources, match from persons where status = 'published' order by sort, id`);
}

export async function getPerson(slug: string) {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const p = (await q<PersonCard>(`select slug, name, years, biography, sources, match from persons where slug = $1 and status = 'published'`, [slug]))[0];
  if (!p) return null;
  const m = p.match && p.match.length >= 3 ? `%${p.match.replace(/[\\%_]/g, "")}%` : null;
  const [events, docs] = m
    ? await Promise.all([
        q<EventRow>(
          `select e.slug, e.title, e.date_text, e.year, c.slug as theme, c.name as theme_name, e.sources
           from historical_events e left join categories c on c.id = e.category_id
           where e.status = 'published' and e.title->>'ru' ilike $1 order by e.year, e.id limit 20`,
          [m],
        ),
        q<{ uid: string; title: L10n; date_text: string | null; cipher: string | null }>(
          `select d.uid, d.title, d.date_text, d.cipher from documents d join funds f on f.id = d.fund_id
           where ${DOC_VISIBLE} and ${FUND_VISIBLE} and (d.title->>'ru' ilike $1 or d.author ilike $1 or d.description->>'ru' ilike $1) order by d.year_from limit 12`,
          [m],
        ),
      ])
    : [[], []];
  return { ...p, events, docs };
}
