// Поиск по электронному каталогу. Все правила доступа — здесь, на сервере (доп. ТЗ 3.1):
// в выдачу и карточки попадают только опубликованные записи со статусом «Публично»,
// файл выдаётся, только если открыт сам файл и запись, к которой он привязан.

import { q } from "./db";
import type { L10n } from "@/i18n/dict";

export const PAGE_SIZE = 20;

export const DOC_VISIBLE = `d.publish_status = 'public' and d.status = 'published'`;
export const FUND_VISIBLE = `f.publish_status = 'public' and f.status = 'published'`;
export const FILE_VISIBLE = `df_file.access = 'public'`;

export const DOC_TYPES = ["photo", "document", "map", "newspaper", "metric_book", "audio", "video"] as const;
export type DocType = (typeof DOC_TYPES)[number];

// Распространённые варианты написания (доп. ТЗ 3.1)
const SYNONYMS: string[][] = [
  ["усть-каменогорск", "өскемен", "оскемен", "ust-kamenogorsk", "oskemen", "устькаменогорск"],
  ["риддер", "лениногорск", "ridder", "leninogorsk"],
  ["семипалатинск", "семей", "semey", "semipalatinsk"],
  ["иртыш", "ертіс", "ертис", "irtysh"],
  ["зайсан", "zaisan", "zaysan"],
  ["шемонаиха", "shemonaikha"],
  ["метрическая", "метрические", "метрикалық"],
];

export type Parsed = { text: string; decadeFrom?: number; decadeTo?: number; docType?: DocType };

// Слова о виде материала превращаются в фильтр: «фотографии», «карты», «газеты»…
const TYPE_WORDS: [RegExp, DocType][] = [
  [/^(фото\p{L}*|снимк\p{L}*|снимок|фотосурет\p{L}*|сурет\p{L}*|photo\p{L}*|pictures?)$/iu, "photo"],
  [/^(карт[аыу]?|карт-?схем\p{L}*|план[аы]?|карта\p{L}*|maps?)$/iu, "map"],
  [/^(газет\p{L}*|газет|newspapers?)$/iu, "newspaper"],
  [/^(метрическ\p{L}*|метрикалық|registers?)$/iu, "metric_book"],
  [/^(видео\p{L}*|кинохроник\p{L}*|фильм\p{L}*|videos?|films?)$/iu, "video"],
  [/^(аудио\p{L}*|звукозапис\p{L}*|audio)$/iu, "audio"],
];

// «фото Усть-Каменогорска 1960-х» → текст «фото Усть-Каменогорска», период 1960–1969
export function parseQuery(raw: string): Parsed {
  let text = raw.trim().slice(0, 200);
  let decadeFrom: number | undefined;
  let decadeTo: number | undefined;
  const dec = text.match(/\b(1[6-9]\d|20[0-2])0[-‐–]?(?:х|е|x|s)(?:\s*(?:годов|годы|годах|гг\.?|жылдар\w*))?/i);
  if (dec) {
    decadeFrom = Number(dec[1] + "0");
    decadeTo = decadeFrom + 9;
    text = text.replace(dec[0], " ");
  } else {
    const y = text.match(/\b(1[6-9]\d\d|20[0-2]\d)\s*(?:год[ау]?|г\.|жыл\w*)?/);
    if (y) {
      decadeFrom = decadeTo = Number(y[1]);
      text = text.replace(y[0], " ");
    }
  }
  let docType: DocType | undefined;
  const words = text.split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => {
    const hit = TYPE_WORDS.find(([re]) => re.test(w.replace(/[^\p{L}-]/gu, "")));
    if (hit && !docType && hit[1] !== "metric_book") {
      docType = hit[1];
      return false;
    }
    return true;
  });
  text = kept.join(" ").trim();
  return { text, decadeFrom, decadeTo, docType };
}

// Запрос: каждое слово ищется по русской морфологии и как есть (для казахского и английского),
// с вариантами написания через OR; слова соединяются через AND.
// Возвращает SQL-выражение tsquery, значения уходят параметрами.
function tsqExpr(text: string, add: (v: unknown) => string): string | null {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  const parts = words.map((w) => {
    const group = SYNONYMS.find((g) => g.some((s) => w.startsWith(s.slice(0, Math.max(5, s.length - 2)))));
    const alts = group ? [w, ...group.filter((s) => s !== w)] : [w];
    return "(" + alts.map((a) => {
      const p = add(a);
      return `plainto_tsquery('russian', ${p}) || plainto_tsquery('simple', ${p})`;
    }).join(" || ") + ")";
  });
  return "(" + parts.join(" && ") + ")";
}

export type Filters = {
  q?: string;
  docType?: string;
  from?: number;
  to?: number;
  fund?: string;
  branch?: string;
  copy?: boolean;
  sort?: "relevance" | "old" | "new";
  page?: number;
};

export type DocHit = {
  uid: string; title: L10n; cipher: string | null; doc_type: DocType; date_text: string | null; date_uncertain: boolean;
  place: string | null; is_demo: boolean; fund_number: string; branch: L10n | null; has_copy: boolean; preview_id: number | null;
  files_total: number;
};

function buildDocWhere(f: Filters, p: Parsed, params: unknown[], useText: boolean) {
  const where = [DOC_VISIBLE, FUND_VISIBLE];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  let tsq: string | null = null;
  if (useText && p.text) {
    tsq = tsqExpr(p.text, add);
    if (tsq) where.push(`d.search_vector @@ ${tsq}`);
  }
  const from = f.from ?? p.decadeFrom;
  const to = f.to ?? p.decadeTo;
  if (from) where.push(`coalesce(d.year_to, d.year_from) >= ${add(from)}`);
  if (to) where.push(`d.year_from <= ${add(to)}`);
  const docType = f.docType || p.docType;
  if (docType && (DOC_TYPES as readonly string[]).includes(docType)) where.push(`d.doc_type = ${add(docType)}`);
  if (f.fund) where.push(`f.fund_number = ${add(f.fund)}`);
  if (f.branch) where.push(`b.slug = ${add(f.branch)}`);
  if (f.copy) where.push(`exists (select 1 from document_files x join digital_files df_file on df_file.id = x.file_id where x.document_id = d.id and ${FILE_VISIBLE})`);
  return { where: where.join(" and "), tsq };
}

export async function searchDocuments(f: Filters) {
  const p = parseQuery(f.q ?? "");
  const page = Math.max(1, f.page ?? 1);

  const run = async (mode: "fts" | "fuzzy") => {
    const params: unknown[] = [];
    const built = buildDocWhere(f, p, params, mode === "fts");
    let where = built.where;
    let rank = built.tsq ? `ts_rank(d.search_vector, ${built.tsq})` : "0";
    if (mode === "fuzzy") {
      // похожие по написанию названия — если точный поиск ничего не дал
      params.push(p.text.toLowerCase());
      const hay = `lower(coalesce(d.title->>'ru', '') || ' ' || coalesce(d.place, '') || ' ' || coalesce(d.title->>'kk', '') || ' ' || coalesce(d.title->>'en', ''))`;
      where += ` and word_similarity($${params.length}, ${hay}) > 0.35`;
      rank = `word_similarity($${params.length}, ${hay})`;
    }
    const order =
      f.sort === "old" ? "d.year_from asc nulls last, d.id" :
      f.sort === "new" ? "d.year_from desc nulls last, d.id" :
      rank === "0" ? "d.year_from asc nulls last, d.id" :
      `${rank} desc, d.year_from asc nulls last, d.id`;
    const base = `from documents d join funds f on f.id = d.fund_id left join branches b on b.id = d.branch_id where ${where}`;
    const total = (await q<{ n: number }>(`select count(*)::int as n ${base}`, params))[0].n;
    params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const rows = await q<DocHit>(
      `select d.uid, d.title, d.cipher, d.doc_type, d.date_text, d.date_uncertain, d.place, d.is_demo, f.fund_number,
              b.short_name as branch,
              (select df_file.id from document_files x join digital_files df_file on df_file.id = x.file_id
                where x.document_id = d.id and ${FILE_VISIBLE} order by x.sort limit 1) as preview_id,
              (select count(*)::int from document_files x where x.document_id = d.id) as files_total,
              exists (select 1 from document_files x join digital_files df_file on df_file.id = x.file_id
                where x.document_id = d.id and ${FILE_VISIBLE}) as has_copy
       ${base} order by ${order} limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return { total, rows };
  };

  let res = await run("fts");
  let fuzzy = false;
  if (res.total === 0 && p.text.length >= 3) {
    res = await run("fuzzy");
    fuzzy = res.total > 0;
  }
  return { ...res, page, pages: Math.max(1, Math.ceil(res.total / PAGE_SIZE)), parsed: p, fuzzy };
}

export type FundHit = {
  id: number; fund_number: string; title: L10n; kind: string; year_from: number | null; year_to: number | null;
  units_text: string | null; is_demo: boolean; names_count: number;
};

export async function searchFunds(f: Filters & { kind?: string }) {
  const p = parseQuery(f.q ?? "");
  const page = Math.max(1, f.page ?? 1);
  const params: unknown[] = [];
  const where = [FUND_VISIBLE];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  let rank = "0";
  if (p.text) {
    // номер фонда целиком: «Р-1», «1П»
    const tsq = tsqExpr(p.text, add) ?? "''::tsquery";
    const n = add(p.text.replace(/^(ф\.?|фонд)\s*/i, "").replace(/\s+/g, "").toUpperCase());
    // номер фонда целиком: «Р-1», «1П»; в таблице встречаются приписки «ч.с.»
    const num = `upper(replace(f.fund_number, ' ', ''))`;
    where.push(`(f.search_vector @@ ${tsq} or ${num} = ${n} or ${num} like ${n} || 'Ч%' or ${num} like ${n} || '/%')`);
    rank = `(case when ${num} = ${n} or ${num} like ${n} || 'Ч%' or ${num} like ${n} || '/%' then 10 else 0 end + ts_rank(f.search_vector, ${tsq}))`;
  }
  const from = f.from ?? p.decadeFrom;
  const to = f.to ?? p.decadeTo;
  if (from) where.push(`coalesce(f.year_to, f.year_from) >= ${add(from)}`);
  if (to) where.push(`f.year_from <= ${add(to)}`);
  if (f.kind === "personal") where.push(`f.kind = 'personal'`);
  const order =
    f.sort === "old" ? "f.year_from asc nulls last, f.id" :
    f.sort === "new" ? "f.year_from desc nulls last, f.id" :
    p.text ? `${rank} desc, f.id` : "f.is_demo desc, f.id";
  const base = `from funds f where ${where.join(" and ")}`;
  const total = (await q<{ n: number }>(`select count(*)::int as n ${base}`, params))[0].n;
  params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const rows = await q<FundHit>(
    `select f.id, f.fund_number, f.title, f.kind, f.year_from, f.year_to, f.units_text, f.is_demo, jsonb_array_length(f.names)::int as names_count
     ${base} order by ${order} limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return { total, rows, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), parsed: p };
}

// ---------- Карточки ----------

export type DocCard = {
  id: number; uid: string; title: L10n; description: L10n | null; cipher: string | null; doc_type: DocType;
  date_text: string | null; date_uncertain: boolean; year_from: number | null; year_to: number | null; place: string | null;
  author: string | null; provenance: string | null; is_demo: boolean; i18n_status: Record<string, string>; published_at: string | null;
  fund_id: number; fund_number: string; fund_title: L10n; inv_number: string | null; inv_title: L10n | null;
  case_number: string | null; case_title: L10n | null; branch_slug: string | null; branch_name: L10n | null; branch_address: L10n | null;
};

export async function getDocument(uid: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const rows = await q<DocCard>(
    `select d.id, d.uid, d.title, d.description, d.cipher, d.doc_type, d.date_text, d.date_uncertain, d.year_from, d.year_to, d.place,
            d.author, d.provenance, d.is_demo, d.i18n_status, d.published_at,
            f.id as fund_id, f.fund_number, f.title as fund_title, i.number as inv_number, i.title as inv_title,
            c.number as case_number, c.title as case_title, b.slug as branch_slug, b.name as branch_name, b.address as branch_address
     from documents d join funds f on f.id = d.fund_id
     left join cases c on c.id = d.case_id left join inventories i on i.id = c.inventory_id
     left join branches b on b.id = d.branch_id
     where d.uid = $1 and ${DOC_VISIBLE} and ${FUND_VISIBLE}`,
    [uid],
  );
  const doc = rows[0];
  if (!doc) return null;
  const files = await q<{ id: number; access: string; mime: string; width: number | null; height: number | null; sort: number }>(
    `select df_file.id, df_file.access, df_file.mime, df_file.width, df_file.height, x.sort
     from document_files x join digital_files df_file on df_file.id = x.file_id where x.document_id = $1 order by x.sort`,
    [doc.id],
  );
  const related = await q<DocHit>(
    `select d.uid, d.title, d.cipher, d.doc_type, d.date_text, d.date_uncertain, d.place, d.is_demo, f.fund_number, null as branch,
            (select df_file.id from document_files x join digital_files df_file on df_file.id = x.file_id
              where x.document_id = d.id and ${FILE_VISIBLE} order by x.sort limit 1) as preview_id,
            0 as files_total, false as has_copy
     from documents d join funds f on f.id = d.fund_id
     where ${DOC_VISIBLE} and ${FUND_VISIBLE} and d.id <> $1
       and (d.fund_id = $2 or d.place = $3 or abs(coalesce(d.year_from, 0) - $4) <= 5)
     order by (d.fund_id = $2 and d.doc_type = $5) desc, (d.place = $3) desc, abs(coalesce(d.year_from, 0) - $4), d.id limit 4`,
    [doc.id, doc.fund_id, doc.place, doc.year_from ?? 0, doc.doc_type],
  );
  return {
    doc,
    openFiles: files.filter((f) => f.access === "public"),
    closedCount: files.filter((f) => f.access !== "public").length,
    related,
  };
}

export type FundCard = {
  id: number; fund_number: string; title: L10n; annotation: L10n | null; kind: string; year_from: number | null; year_to: number | null;
  units_text: string | null; cases_count: number | null; names: { dates: string | null; name: string }[]; first_received: string | null;
  ownership: string | null; source: string | null; is_demo: boolean; branch_name: L10n | null;
};

export async function getFund(id: number) {
  const rows = await q<FundCard>(
    `select f.id, f.fund_number, f.title, f.annotation, f.kind, f.year_from, f.year_to, f.units_text, f.cases_count, f.names,
            f.first_received::text, f.ownership, f.source, f.is_demo, b.name as branch_name
     from funds f left join branches b on b.id = f.branch_id where f.id = $1 and ${FUND_VISIBLE}`,
    [id],
  );
  const fund = rows[0];
  if (!fund) return null;
  const inventories = await q<{ id: number; number: string; title: L10n; docs: number }>(
    `select i.id, i.number, i.title,
            (select count(*)::int from documents d join cases c on c.id = d.case_id where c.inventory_id = i.id and ${DOC_VISIBLE}) as docs
     from inventories i where i.fund_id = $1 and i.publish_status = 'public' and i.status = 'published' order by i.number`,
    [id],
  );
  const docs = await searchDocuments({ fund: fund.fund_number, sort: "old" });
  return { fund, inventories, docs };
}

// Файл для отдачи: открыт сам файл, запись опубликована и открыта (доп. ТЗ 3.1, сценарий «закрытый файл не выдаётся»)
export async function getPublicFile(id: number) {
  const rows = await q<{ storage_key: string; mime: string; sha256: string }>(
    `select df_file.storage_key, df_file.mime, df_file.sha256
     from digital_files df_file
     join document_files x on x.file_id = df_file.id
     join documents d on d.id = x.document_id
     join funds f on f.id = d.fund_id
     where df_file.id = $1 and ${FILE_VISIBLE} and ${DOC_VISIBLE} and ${FUND_VISIBLE}
     limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function catalogFacets() {
  const funds = await q<{ fund_number: string; title: L10n }>(
    `select f.fund_number, f.title from funds f where ${FUND_VISIBLE} and exists (select 1 from documents d where d.fund_id = f.id and ${DOC_VISIBLE}) order by f.fund_number`,
  );
  const branches = await q<{ slug: string; short_name: L10n }>(
    `select b.slug, b.short_name from branches b where b.is_visible and exists (select 1 from documents d join funds f on f.id = d.fund_id where d.branch_id = b.id and ${DOC_VISIBLE} and ${FUND_VISIBLE}) order by b.sort`,
  );
  return { funds, branches };
}
