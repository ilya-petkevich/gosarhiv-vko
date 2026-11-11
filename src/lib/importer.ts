// Пакетный импорт описаний из CSV / XLSX (ТЗ 6.3, доп. ТЗ 3.5).
// 1) файл разбирается и сохраняется в import_jobs (status = preview), колонки сопоставляются с полями автоматически;
// 2) сотрудник проверяет сопоставление и предварительный просмотр с ошибками по строкам;
// 3) импорт: каждая строка — отдельно; ошибка в строке не затрагивает уже сохранённые записи;
//    дубликаты определяются по архивному шифру (в файле и в базе) и пропускаются;
// 4) все записи создаются черновиками с закрытым описанием — на сайт попадают только после согласования;
// 5) откат удаляет записи этого импорта, которые ещё в черновиках и без файлов.

import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { DOC_TYPES } from "./catalog";
import { q } from "./db";

export const MAX_IMPORT_MB = process.env.VERCEL ? 4 : 5;
export const MAX_ROWS = 5000;

export const FIELDS = [
  { key: "cipher", label: "Архивный шифр", required: true, guess: ["шифр", "cipher", "архивный шифр", "ф. оп. д."] },
  { key: "title_ru", label: "Название (рус)", required: true, guess: ["название", "заголовок", "наименование", "title", "заголовок дела"] },
  { key: "date_text", label: "Дата (как в документе)", required: true, guess: ["дата", "даты", "крайние даты", "date"] },
  { key: "year_from", label: "Год с", required: true, guess: ["год", "год с", "год начала", "нач. год", "year", "year_from"] },
  { key: "year_to", label: "Год по", required: false, guess: ["год по", "год окончания", "кон. год", "year_to"] },
  { key: "doc_type", label: "Вид материала", required: false, guess: ["вид", "тип", "вид документа", "type"] },
  { key: "place", label: "Место", required: false, guess: ["место", "населённый пункт", "населенный пункт", "place"] },
  { key: "desc_ru", label: "Описание (рус)", required: false, guess: ["описание", "аннотация", "содержание", "description"] },
  { key: "title_kk", label: "Название (қаз)", required: false, guess: ["атауы", "название каз", "title_kk"] },
  { key: "title_en", label: "Название (eng)", required: false, guess: ["title en", "title_en", "english"] },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>;

const TYPE_WORDS: Record<string, string> = {
  фото: "photo", фотография: "photo", фотодокумент: "photo", photo: "photo",
  документ: "document", document: "document", дело: "document",
  карта: "map", план: "map", map: "map",
  газета: "newspaper", newspaper: "newspaper",
  "метрическая книга": "metric_book", метрическая: "metric_book",
  звукозапись: "audio", аудио: "audio", audio: "audio",
  кинодокумент: "video", видео: "video", кинохроника: "video", video: "video",
};

const norm = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

export async function parseFile(name: string, buf: Buffer): Promise<{ columns: string[]; rows: string[][] } | { error: string }> {
  if (buf.length > MAX_IMPORT_MB * 1024 * 1024) return { error: `Файл больше ${MAX_IMPORT_MB} МБ` };
  const lower = name.toLowerCase();
  let table: string[][];
  try {
    if (lower.endsWith(".xlsx")) {
      if (buf.subarray(0, 2).toString("latin1") !== "PK") return { error: "Файл не похож на XLSX" };
      const data = await readSheet(buf);
      table = data.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : norm(c))));
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      let text = buf.toString("utf8");
      if (text.includes("�")) text = new TextDecoder("windows-1251").decode(buf); // выгрузки из Excel часто в cp1251
      const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"] });
      table = res.data.map((r) => r.map(norm));
    } else {
      return { error: "Нужен файл .csv или .xlsx" };
    }
  } catch {
    return { error: "Не удалось прочитать файл" };
  }
  table = table.filter((r) => r.some((c) => c));
  if (table.length < 2) return { error: "В файле нет строк с данными (первая строка — заголовки)" };
  if (table.length - 1 > MAX_ROWS) return { error: `Слишком много строк: ${table.length - 1} (не больше ${MAX_ROWS} за раз)` };
  const columns = table[0].map((c, i) => c || `Колонка ${i + 1}`);
  return { columns, rows: table.slice(1).map((r) => columns.map((_, i) => r[i] ?? "")) };
}

export function guessMapping(columns: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  for (const f of FIELDS) {
    const idx = columns.findIndex((c, i) => !used.has(i) && f.guess.some((g) => c.toLowerCase().replace(/[«»"]/g, "").trim() === g));
    if (idx >= 0) {
      m[f.key] = idx;
      used.add(idx);
    }
  }
  return m;
}

export type RowCheck = { n: number; values: Partial<Record<FieldKey, string>>; errors: string[]; duplicate: boolean };

export async function checkRows(rows: string[][], mapping: Mapping): Promise<RowCheck[]> {
  const ciphers = rows.map((r) => (mapping.cipher != null ? norm(r[mapping.cipher]).toLowerCase() : ""));
  const existing = new Set(
    (await q<{ c: string }>(`select lower(cipher) c from documents where lower(cipher) = any($1::text[])`, [ciphers.filter(Boolean)])).map((x) => x.c),
  );
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const values: Partial<Record<FieldKey, string>> = {};
    for (const f of FIELDS) if (mapping[f.key] != null) values[f.key] = norm(r[mapping[f.key]!]);
    const errors: string[] = [];
    for (const f of FIELDS) if (f.required && !values[f.key]) errors.push(`нет поля «${f.label}»`);
    const yf = values.year_from ? Number(values.year_from.slice(0, 4)) : NaN;
    if (values.year_from && !(yf >= 1500 && yf <= 2100)) errors.push("год «с» — 4 цифры");
    const yt = values.year_to ? Number(values.year_to.slice(0, 4)) : yf;
    if (values.year_to && !(yt >= yf && yt <= 2100)) errors.push("год «по» меньше года «с» или неверный");
    if (values.doc_type && !TYPE_WORDS[values.doc_type.toLowerCase()] && !(DOC_TYPES as readonly string[]).includes(values.doc_type)) errors.push(`неизвестный вид «${values.doc_type}»`);
    const c = ciphers[i];
    let duplicate = false;
    if (c && (existing.has(c) || seen.has(c))) {
      duplicate = true;
      errors.push(existing.has(c) ? "такой шифр уже есть в каталоге" : "шифр повторяется в файле");
    }
    if (c) seen.add(c);
    return { n: i + 2, values, errors, duplicate };
  });
}

export function toDocType(v: string | undefined) {
  if (!v) return "document";
  return TYPE_WORDS[v.toLowerCase()] ?? ((DOC_TYPES as readonly string[]).includes(v) ? v : "document");
}
