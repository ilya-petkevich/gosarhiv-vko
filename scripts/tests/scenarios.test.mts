// Проверка пользовательских сценариев доп. ТЗ (раздел 6) по HTTP — без входа в админку.
// Запуск: BASE=https://gosarhiv-vko.vercel.app npx tsx scripts/tests/scenarios.test.mts
//         (по умолчанию BASE=http://localhost:3000)
// ASK=1 — дополнительно задать помощнику один вопрос (платно: около $0,001).

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/+$/, "");
const results: { scenario: string; check: string; ok: boolean; info: string }[] = [];

async function get(path: string, init?: RequestInit) {
  const t = Date.now();
  const r = await fetch(BASE + path, { redirect: "manual", ...init });
  const body = await r.text();
  return { status: r.status, body, ms: Date.now() - t, headers: r.headers };
}
function check(scenario: string, name: string, ok: boolean, info = "") {
  results.push({ scenario, check: name, ok, info });
}
const json = (s: string) => JSON.parse(s);

// 1. Поиск документа
{
  const s = "1. Поиск документа";
  const r = await get(`/api/catalog?q=${encodeURIComponent("фотографии Усть-Каменогорска 1960-х")}`);
  const d = json(r.body);
  check(s, "поиск по словам находит записи", d.total > 0, `найдено ${d.total}, ${r.ms} мс`);
  check(s, "период и вид поняты из запроса", d.parsed.decadeFrom === 1960 && d.parsed.docType === "photo", JSON.stringify(d.parsed));
  const f = json((await get(`/api/catalog?doc_type=photo&from=1960&to=1969&copy=1`)).body);
  check(s, "фильтры: вид, годы, наличие копии", f.total > 0 && f.rows.every((x: { doc_type: string; has_copy: boolean }) => x.doc_type === "photo" && x.has_copy), `найдено ${f.total}`);
  const doc = d.rows.find((x: { has_copy: boolean }) => x.has_copy);
  const card = await get(`/ru/catalog/doc/${doc.uid}`);
  check(s, "карточка открывается, есть шифр", card.status === 200 && card.body.includes(doc.cipher), `${card.status}`);
  const file = await get(`/api/files/${doc.preview_id}`);
  check(s, "разрешённая копия выдаётся", file.status === 200 && /^image\//.test(file.headers.get("content-type") ?? ""), `${file.status} ${file.headers.get("content-type")}`);
  const fund = json((await get(`/api/catalog?tab=funds&q=${encodeURIComponent("Р-1")}`)).body);
  check(s, "поиск фонда по номеру", fund.rows[0]?.fund_number?.startsWith("Р-1"), fund.rows[0]?.fund_number ?? "—");
  const v = json((await get(`/api/catalog?q=${encodeURIComponent("Өскемен")}`)).body);
  check(s, "варианты написания (Өскемен)", v.total > 0, `найдено ${v.total}`);
}

// 2. Интеллектуальный поиск
{
  const s = "2. Интеллектуальный поиск";
  const page = await get(`/ru/assistant`);
  check(s, "страница помощника открывается", page.status === 200, `${page.status}`);
  const restricted = await get(`/api/assistant`, {
    method: "POST",
    headers: { Origin: BASE, "Content-Type": "application/json" },
    body: JSON.stringify({ q: "Покажите личное дело соседа Иванова, ИИН 850101300123", lang: "ru" }),
  });
  const a = json(restricted.body);
  check(s, "запрос к закрытым данным — отказ и порядок запроса, без модели", a.mode === "restricted" && a.sources.length === 0, a.mode);
  check(s, "ИИН вырезан из вопроса", a.notice === "masked", String(a.notice));
  const foreign = await get(`/api/assistant`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ q: "тест" }) });
  check(s, "запросы с чужого сайта отклоняются", foreign.status === 403, `${foreign.status}`);
  if (process.env.ASK === "1") {
    const r = await get(`/api/assistant`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: JSON.stringify({ q: "Есть ли документы о строительстве метро в Усть-Каменогорске?", lang: "ru" }) });
    const x = json(r.body);
    check(s, "нет данных — честный ответ без выдуманных шифров", !/Р-\d{3,}|ДЕМО-\d, оп/.test(x.paragraphs.join(" ").replace(/\[шифр не подтверждён\]/g, "")) || x.sources.length > 0, `${x.mode}, ${r.ms} мс`);
  }
}

// 3. Информация об услугах
{
  const s = "3. Информация об услугах";
  const gov = await get(`/ru/services/gov`);
  check(s, "раздел госуслуги: срок, бесплатно, ссылка eGov", gov.status === 200 && gov.body.includes("11 рабочих дней") && gov.body.includes("egov.kz/cms/ru/services/apostil/e_059"), `${gov.status}`);
  const paid = await get(`/ru/services/paid`);
  check(s, "прейскурант и постановление (PDF)", paid.status === 200 && paid.body.includes("postanovlenie-289-2023-prejskurant-ru.pdf") && paid.body.includes("833,0"), `${paid.status}`);
  const pdf = await get(`/docs/postanovlenie-289-2023-prejskurant-ru.pdf`);
  check(s, "PDF постановления открывается", pdf.status === 200 && (pdf.headers.get("content-type") ?? "").includes("pdf"), `${pdf.status}`);
  check(s, "на сайте нет форм заявлений и оплаты", !/<form[^>]*action="[^"]*(order|pay|zayav|application)/i.test(gov.body + paid.body) && !/type="file"/.test(gov.body + paid.body), "форм нет");
}

// 4. Поиск филиала
{
  const s = "4. Поиск филиала";
  const br = await get(`/ru/branches`);
  const n = (br.body.match(/class="card br-item/g) ?? []).length;
  check(s, "список архива и филиалов", br.status === 200 && n >= 14, `${n} подразделений`);
  check(s, "маршрут во внешнем сервисе по адресу", br.body.includes("2gis.kz/search/") && br.body.includes("google.com/maps/dir/"), "2GIS и Google Карты");
  check(s, "работа без геолокации: адреса, телефоны, маршрут от адреса", br.body.includes("Маршрут от адреса") && /tel:\+7/.test(br.body), "есть");
}

// 5. Просмотр выставки
{
  const s = "5. Просмотр выставки";
  const list = await get(`/ru/exhibitions`);
  check(s, "список выставок", list.status === 200 && list.body.includes("gorod-na-irtyshe"), `${list.status}`);
  const ex = await get(`/ru/exhibitions/gorod-na-irtyshe`);
  check(s, "выставка: экспонаты, подпись, источник, переход в каталог", ex.status === 200 && ex.body.includes("Источник") && ex.body.includes("/ru/catalog/doc/"), `${ex.status}`);
}

// 8. Историческая подборка (публичная часть)
{
  const s = "8. Историческая подборка";
  const ch = await get(`/ru/chronicle`);
  check(s, "летопись: подборки и хронология", ch.status === 200 && ch.body.includes("Хронология"), `${ch.status}`);
  const col = await get(`/ru/chronicle/mosty-i-transport`);
  check(s, "подборка: материалы с источниками, пояснение редакции отдельно", col.status === 200 && col.body.includes("Пояснение редакции") && col.body.includes("Источник"), `${col.status}`);
}

// 9. Негативные сценарии
{
  const s = "9. Негативные сценарии";
  const none = await get(`/ru/catalog?q=${encodeURIComponent("Рудный Алтай 1890 метрополитен")}`);
  check(s, "запрос без результатов — понятное сообщение", none.status === 200 && none.body.includes("ничего не нашлось"), `${none.status}`);
  // закрытые случаи из демо-набора
  const closed = json((await get(`/api/catalog?q=${encodeURIComponent("Списки призванных")}`)).body).rows[0];
  const card = await get(`/ru/catalog/doc/${closed.uid}`);
  check(s, "закрытая копия: описание видно, файла нет", card.status === 200 && card.body.includes("не публикуется") && !closed.has_copy, `карточка ${card.status}`);
  const hidden = json((await get(`/api/catalog?q=${encodeURIComponent("Личные дела работников")}`)).body);
  check(s, "запись «не публиковать» не находится", hidden.rows.every((x: { title: { ru: string } }) => !x.title.ru.includes("Личные дела")), `найдено ${hidden.total}`);
  const draft = json((await get(`/api/catalog?q=${encodeURIComponent("Черновик цех")}`)).body);
  check(s, "черновик не виден", draft.rows.every((x: { title: { ru: string } }) => !x.title.ru.startsWith("Черновик")), `найдено ${draft.total}`);
  const secret = json((await get(`/api/catalog?tab=funds&q=${encodeURIComponent("секретный фонд")}`)).body);
  check(s, "секретные фонды не публикуются", secret.total === 0, `найдено ${secret.total}`);
  const adm = await get(`/admin`);
  check(s, "админка без входа недоступна", adm.status >= 300 && adm.status < 400 && (adm.headers.get("location") ?? "").includes("/admin/login") || adm.body.includes("Вход для сотрудников"), `${adm.status}`);
  const exp = await get(`/admin/export`);
  check(s, "выгрузка без входа — 401", exp.status === 401, `${exp.status}`);
  const nf = await get(`/ru/catalog/doc/00000000-0000-0000-0000-000000000000`);
  check(s, "несуществующая запись — 404", nf.status === 404, `${nf.status}`);
}

// Технические требования
{
  const s = "Технические";
  const robots = await get(`/robots.txt`);
  check(s, "robots.txt", robots.status === 200, robots.body.split("\n").slice(0, 3).join(" | "));
  const sm = await get(`/sitemap.xml`);
  check(s, "sitemap.xml с языковыми версиями", sm.status === 200 && sm.body.includes('hreflang="kk"'), `${(sm.body.match(/<url>/g) ?? []).length} адресов`);
  const home = await get(`/ru`);
  const sec = ["x-content-type-options", "referrer-policy", "x-frame-options"].every((h) => home.headers.get(h));
  check(s, "заголовки безопасности", sec, "nosniff, referrer-policy, x-frame-options");
  check(s, "HTTPS", BASE.startsWith("https://") || BASE.includes("localhost"), BASE);
  for (const l of ["kk", "ru", "en"]) {
    const r = await get(`/${l}`);
    check(s, `главная /${l}`, r.status === 200 && r.body.includes(`lang="${l}"`), `${r.ms} мс`);
  }
}

// Закрытые файлы по прямой ссылке: перебор номеров файлов не должен выдавать ничего, кроме открытых
{
  const s = "9. Негативные сценарии";
  // все файлы, которые сайт законно показывает: превью из выдачи и листы из карточек
  const allowed = new Set<number>();
  const first = json((await get(`/api/catalog?q=`)).body);
  for (let p = 1; p <= first.pages; p++) {
    const page = p === 1 ? first : json((await get(`/api/catalog?q=&page=${p}`)).body);
    for (const r of page.rows) {
      const card = await get(`/ru/catalog/doc/${r.uid}`);
      for (const m of card.body.matchAll(/\/api\/files\/(\d+)/g)) allowed.add(Number(m[1]));
      // листы просмотрщика (в том числе PDF) передаются в данных страницы как {"id":N,"mime":…}
      for (const m of card.body.matchAll(/\\?"id\\?":(\d+),\\?"mime\\?"/g)) allowed.add(Number(m[1]));
    }
  }
  let served = 0;
  let unexpected = 0;
  for (let id = 1; id <= 90; id++) {
    const r = await fetch(`${BASE}/api/files/${id}`);
    await r.arrayBuffer().catch(() => {});
    if (r.status === 200) {
      served++;
      if (!allowed.has(id)) unexpected++;
    }
  }
  check(s, "перебор /api/files/1…90: выдаются только открытые копии", unexpected === 0, `выдано ${served}, все из открытых карточек; лишних ${unexpected}`);
}

const pad = (x: string, n: number) => (x.length > n ? x.slice(0, n - 1) + "…" : x.padEnd(n));
let failed = 0;
let last = "";
for (const r of results) {
  if (r.scenario !== last) {
    console.log(`\n${r.scenario}`);
    last = r.scenario;
  }
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "✓" : "✗"} ${pad(r.check, 62)} ${r.info}`);
}
console.log(`\n${BASE}: проверок ${results.length}, не прошло ${failed}`);
process.exit(failed ? 1 : 0);
