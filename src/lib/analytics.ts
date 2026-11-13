// Обезличенная аналитика сайта (ТЗ 5.8 Д): без IP, cookie и персональных данных.
// Поисковые запросы хранятся урезанными: цифры длиннее 4 знаков (ИИН, телефоны) и адреса почты вырезаются.

import { q } from "./db";

export function cleanQuery(text: string) {
  return text
    .toLowerCase()
    .replace(/\S+@\S+/g, "")
    .replace(/\d{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function track(event: string, path: string, lang: string | null, value?: string | null) {
  // не ждём записи: аналитика не должна замедлять страницу
  q(`insert into page_events(path, lang, event, value) values ($1,$2,$3,$4)`, [path.slice(0, 120), lang, event, value ?? null]).catch(() => {});
}
