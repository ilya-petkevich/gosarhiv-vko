// Помощник «Ахмет» (ТЗ 5.8, доп. ТЗ 3.4).
//
// Правила:
// - отвечает только по открытым опубликованным записям каталога и справочным сведениям сайта;
// - источники — только реально найденные записи; шифры, которых нет среди найденного, вычёркиваются;
// - честно говорит «нет данных»;
// - вопросы о закрытых и персональных сведениях получают готовый ответ без обращения к модели;
// - ИИН, телефоны и почта вырезаются из вопроса до любой обработки; вопрос нигде не сохраняется;
// - без ключа, при отказе модели или исчерпании лимита — ответ по шаблону с пометкой.

import Anthropic from "@anthropic-ai/sdk";
import { q } from "./db";
import { searchDocuments, searchFunds, type DocHit, type FundHit } from "./catalog";
import { pick, type Lang } from "@/i18n/dict";

export type Source =
  | { kind: "doc"; uid: string; title: string; cipher: string | null; date: string | null; has_copy: boolean; preview_id: number | null; is_demo: boolean }
  | { kind: "fund"; id: number; title: string; fund_number: string; years: string; is_demo: boolean };

export type Link = { label: string; href: string; external?: boolean };

export type Answer = {
  mode: "model" | "template" | "restricted" | "empty";
  mood: "found" | "sad" | "think" | "hello";
  paragraphs: string[];
  sources: Source[];
  links: Link[];
  suggestions: string[];
  notice?: "limit" | "no_key" | "model_error" | "masked";
};

// ---------- Личные данные ----------

export function maskPersonal(text: string): { text: string; masked: boolean } {
  let masked = false;
  const rep = (re: RegExp) => {
    text = text.replace(re, () => {
      masked = true;
      return "[скрыто]";
    });
  };
  rep(/[\w.+-]+@[\w-]+\.[\w.-]+/g); // почта
  rep(/\b\d{12}\b/g); // ИИН / БИН
  rep(/(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{2,3}[\s-]*\d{2}[\s-]*\d{2,3}\b/g); // телефоны
  rep(/\b\d{10,11}\b/g);
  return { text, masked };
}

// ---------- Закрытые и персональные сведения ----------

const RESTRICTED = [
  /личн\p{L}*\s+дел/iu, /персональн\p{L}*/iu, /\bиин\b/iu, /паспорт/iu, /медицинск\p{L}*/iu, /диагноз/iu,
  /судим\p{L}*/iu, /уголовн\p{L}*\s+дел/iu, /секретн\p{L}*/iu, /закрыт\p{L}*\s+(документ|фонд|дел)/iu,
  /адрес\p{L}*\s+(моего|моей|соседа|человека|гражданина)/iu, /(соседа|соседки|бывш\p{L}+)\s/iu,
  /жеке\s+іс/iu, /personal\s+(file|data|record)/iu, /criminal\s+record/iu, /medical\s+record/iu,
];
const PENSION = [/стаж/iu, /зарплат\p{L}*/iu, /заработн\p{L}*/iu, /справк\p{L}*\s+(о|об|для)/iu, /еңбек\s+өтіл/iu, /pension|employment\s+record|salary/iu];

export function classify(text: string): "restricted" | "pension" | null {
  if (RESTRICTED.some((r) => r.test(text))) return "restricted";
  if (PENSION.some((r) => r.test(text))) return "pension";
  return null;
}

// ---------- Справочные сведения сайта (для ответов о посещении и услугах) ----------

const SITE_INFO = `Сведения о Государственном архиве ВКО (из материалов архива):
- Адрес: г. Усть-Каменогорск, ул. Бейбітшілік, 26/1 (Головкова, 26/1). Приёмная: 8 (7232) 25-59-76, arhiv-ukg@yandex.kz.
- Режим: пн–пт 8:00–17:00; читальный зал пн–пт 9:00–16:00.
- 13 филиалов по области; их адреса, телефоны и режим — в списке филиалов ниже и в разделе «Филиалы» (/branches).
- Сайт информационный: заявления, архивные запросы и оплата на сайте не принимаются. Архивную справку (о стаже, заработной плате, подтверждение фактов) запрашивают на eGov.kz или через e-Otinish; порядок — раздел «Государственная услуга» (/services/gov). Платные услуги и прейскурант — /services/paid.
- Электронный каталог (/catalog): фонды архива (перечень) и демонстрационные записи документов.`;

// Адреса филиалов — из базы (раздел «Филиалы»), чтобы Ахмет отвечал «где архив в Риддере» тем же, что опубликовано на сайте.
type BranchRow = { name: { ru: string }; address: { ru: string }; phone: string | null; email: string | null; hours: { ru: string } | null; is_main: boolean };
let branchCache: { at: number; text: string } | null = null;
async function branchInfo(): Promise<string> {
  if (branchCache && Date.now() - branchCache.at < 10 * 60_000) return branchCache.text;
  const rows = await q<BranchRow>(`select name, address, phone, email, hours, is_main from branches where is_visible order by is_main desc, id`).catch(() => []);
  if (!rows.length) return "";
  const lines = rows.map((b) =>
    `- ${b.name.ru}: ${b.address.ru}` + (b.phone ? `; тел. ${b.phone}` : "") + (b.email ? `; ${b.email}` : "") + (b.hours?.ru ? `; ${b.hours.ru}` : ""),
  );
  const text = `Головной архив и филиалы (адреса опубликованы в разделе «Филиалы», /branches):\n${lines.join("\n")}`;
  branchCache = { at: Date.now(), text };
  return text;
}

// ---------- Поиск по каталогу ----------

const STOP = new Set(
  ("хочу хотел хотела хотим найти найдите найди покажи покажите показать посмотреть есть ли какие какой какая где мне нам нужно нужны нужен " +
    "документы документ материалы материал информацию информация о об про по в во на за годах годы году года гг и или с со для меня " +
    "пожалуйста можно ли архив архиве архива у вас имеются имеется что-нибудь что нибудь все всё " +
    "маған табу керек туралы қандай бар ма құжаттар құжат архивте " +
    "i want to find show me about of the in any documents document please are there is there what do you have from")
    .split(/\s+/),
);

export function keywords(text: string) {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[«»"“”.,!?;:()]/g, ""))
    .filter((w) => w && !STOP.has(w.toLowerCase()))
    .join(" ");
}

type Found = { docs: DocHit[]; funds: FundHit[]; docsTotal: number; fundsTotal: number; fuzzy: boolean; partial: boolean };

async function find(query: string, opts: { docType?: string; from?: number; to?: number } = {}): Promise<Found> {
  const kw = keywords(query);
  const base = { docType: opts.docType, from: opts.from, to: opts.to };
  const d = await searchDocuments({ q: kw, ...base });
  const f = await searchFunds({ q: kw, from: opts.from, to: opts.to });
  // «похожие по написанию» помощнику не годятся: он не должен выдавать случайные записи за ответ
  let docs = d.fuzzy ? [] : d.rows;
  let total = d.fuzzy ? 0 : d.total;
  let partial = false;
  // по всем словам почти ничего — добавляем записи, где совпала часть слов (с пометкой для модели)
  if (total < 3 && kw.split(/\s+/).length > 1) {
    const any = await searchDocuments({ q: kw, ...base, anyWord: true });
    const seen = new Set(docs.map((x) => x.uid));
    const extra = any.fuzzy ? [] : any.rows.filter((x) => !seen.has(x.uid));
    if (extra.length) {
      docs = [...docs, ...extra];
      total += extra.length;
      partial = true;
    }
  }
  return { docs: docs.slice(0, 8), funds: f.rows.slice(0, 5), docsTotal: total, fundsTotal: f.total, fuzzy: false, partial };
}

function docSource(d: DocHit, lang: Lang): Source {
  return { kind: "doc", uid: d.uid, title: pick(d.title, lang).text, cipher: d.cipher, date: d.date_text, has_copy: d.has_copy, preview_id: d.preview_id, is_demo: d.is_demo };
}
function fundSource(f: FundHit, lang: Lang): Source {
  return { kind: "fund", id: f.id, title: pick(f.title, lang).text, fund_number: f.fund_number, years: f.year_from ? `${f.year_from}–${f.year_to ?? ""}` : "", is_demo: f.is_demo };
}

// ---------- Готовые ответы ----------

const T = {
  ru: {
    restricted: [
      "Личные дела, документы о конкретных людях и другие сведения с ограниченным доступом на сайте не публикуются, и я не показываю их содержание.",
      "Получить такие сведения можно только через официальный запрос в архив — на портале eGov.kz или через e-Otinish. Сведения о других людях выдаются только при наличии законного основания.",
    ],
    pension: [
      "Справки о стаже и заработной плате выдаются по официальному запросу — на сайте их заказать нельзя.",
      "Подать запрос можно на портале eGov.kz или через e-Otinish. Порядок, сроки и нужные документы — в разделе «Государственная услуга». Если организация, где вы работали, ликвидирована, её документы по личному составу могли быть переданы в Усть-Каменогорский филиал по личному составу.",
    ],
    found: (d: number, f: number) => `Нашёл в открытых материалах ${d ? `записей документов: ${d}` : ""}${d && f ? " и " : ""}${f ? `фондов: ${f}` : ""}. Самые подходящие — ниже.`,
    fuzzy: "Точных совпадений не было, поэтому показываю записи, похожие по написанию.",
    none: [
      "В открытых материалах архива нет записей по этому запросу. Я не буду придумывать шифры и ссылки.",
      "Попробуйте спросить шире или другими словами, посмотрите каталог фондов или позвоните в архив.",
    ],
    template: "Ответ составлен по шаблону: языковая модель на этом стенде сейчас не используется.",
    linkGov: "Как подать запрос",
    linkEgov: "eGov.kz",
    linkEotinish: "e-Otinish",
    linkCatalog: "Открыть каталог",
    linkCall: "Позвонить: 8 (7232) 25-59-76",
    sugg: ["Фото Усть-Каменогорска 1960-х", "Метрические книги", "Фонды предприятий Риддера", "Как получить справку о стаже"],
  },
  kk: {
    restricted: [
      "Жеке істер, нақты адамдар туралы құжаттар және қолжетімділігі шектеулі басқа мәліметтер сайтта жарияланбайды, мен олардың мазмұнын көрсетпеймін.",
      "Мұндай мәліметтерді тек архивке ресми сұрау арқылы алуға болады — eGov.kz порталында немесе e-Otinish арқылы. Басқа адамдар туралы мәліметтер тек заңды негіз болғанда беріледі.",
    ],
    pension: [
      "Еңбек өтілі мен жалақы туралы анықтамалар ресми сұрау бойынша беріледі — оларды сайтта тапсырыс беру мүмкін емес.",
      "Сұрауды eGov.kz порталында немесе e-Otinish арқылы беруге болады. Тәртібі, мерзімі және қажетті құжаттар — «Мемлекеттік қызмет» бөлімінде.",
    ],
    found: (d: number, f: number) => `Ашық материалдардан ${d ? `құжат жазбалары: ${d}` : ""}${d && f ? ", " : ""}${f ? `қорлар: ${f}` : ""} табылды. Ең қолайлылары — төменде.`,
    fuzzy: "Дәл сәйкестік болмады, сондықтан жазылуы ұқсас жазбаларды көрсетемін.",
    none: [
      "Архивтің ашық материалдарында бұл сұрау бойынша жазба жоқ. Мен шифрлар мен сілтемелерді ойдан шығармаймын.",
      "Кеңірек немесе басқа сөздермен сұраңыз, қорлар каталогын қараңыз немесе архивке қоңырау шалыңыз.",
    ],
    template: "Жауап үлгі бойынша құрастырылды: бұл стендте тілдік модель қазір қолданылмайды.",
    linkGov: "Сұрауды қалай беруге болады",
    linkEgov: "eGov.kz",
    linkEotinish: "e-Otinish",
    linkCatalog: "Каталогты ашу",
    linkCall: "Қоңырау шалу: 8 (7232) 25-59-76",
    sugg: ["1960-жылдардағы Өскемен суреттері", "Метрикалық кітаптар", "Риддер кәсіпорындарының қорлары", "Еңбек өтілі туралы анықтама"],
  },
  en: {
    restricted: [
      "Personal files, records about specific people and other restricted information are not published on the site, and I don't show their contents.",
      "Such information can only be obtained through an official request to the archive — on eGov.kz or via e-Otinish. Information about other people is released only on a legal basis.",
    ],
    pension: [
      "Certificates of employment record and salary are issued on an official request — they cannot be ordered on this site.",
      "Submit the request on eGov.kz or via e-Otinish. Procedure, timing and documents are in the “Public service” section.",
    ],
    found: (d: number, f: number) => `Found in the open materials: ${d ? `${d} item records` : ""}${d && f ? " and " : ""}${f ? `${f} fonds` : ""}. The closest matches are below.`,
    fuzzy: "There were no exact matches, so I'm showing records with similar spelling.",
    none: [
      "There are no records for this request in the archive's open materials. I won't make up reference codes or links.",
      "Try a broader question or different words, browse the list of fonds, or call the archive.",
    ],
    template: "This answer was built from a template: the language model is not used on this stand right now.",
    linkGov: "How to make a request",
    linkEgov: "eGov.kz",
    linkEotinish: "e-Otinish",
    linkCatalog: "Open the catalogue",
    linkCall: "Call: 8 (7232) 25-59-76",
    sugg: ["Photos of Ust-Kamenogorsk 1960s", "Parish registers", "Fonds of Ridder enterprises", "Employment record certificate"],
  },
};

function officialLinks(lang: Lang): Link[] {
  const t = T[lang];
  return [
    { label: t.linkGov, href: `/${lang}/services/gov` },
    { label: t.linkEgov, href: "https://egov.kz", external: true },
    { label: t.linkEotinish, href: "https://eotinish.kz", external: true },
    { label: t.linkCall, href: "tel:+77232255976" },
  ];
}

function restrictedAnswer(kind: "restricted" | "pension", lang: Lang): Answer {
  return { mode: "restricted", mood: "think", paragraphs: T[lang][kind], sources: [], links: officialLinks(lang), suggestions: T[lang].sugg.slice(0, 3) };
}

async function templateAnswer(question: string, lang: Lang, notice: Answer["notice"]): Promise<Answer> {
  const t = T[lang];
  const r = await find(question);
  const sources = [...r.docs.slice(0, 5).map((d) => docSource(d, lang)), ...r.funds.slice(0, 3).map((f) => fundSource(f, lang))];
  if (!sources.length) {
    return { mode: "empty", mood: "sad", paragraphs: [...t.none, t.template], sources: [], links: [{ label: t.linkCatalog, href: `/${lang}/catalog?tab=funds` }, { label: t.linkCall, href: "tel:+77232255976" }], suggestions: t.sugg, notice };
  }
  return {
    mode: "template",
    mood: "found",
    paragraphs: [t.found(r.docsTotal, r.fundsTotal), ...(r.fuzzy ? [t.fuzzy] : []), t.template],
    sources,
    links: [{ label: t.linkCatalog, href: `/${lang}/catalog?q=${encodeURIComponent(keywords(question))}` }],
    suggestions: t.sugg.filter((s) => s.toLowerCase() !== question.toLowerCase()).slice(0, 3),
    notice,
  };
}

// ---------- Лимиты (в памяти процесса; IP не сохраняется) ----------

const perIp = new Map<string, number[]>();
let day = new Date().toDateString();
let dayCount = 0;
const DAILY = Number(process.env.AI_DAILY_LIMIT || 200);
const PER_IP = Number(process.env.AI_PER_IP_PER_10MIN || 12);

export function allow(ipKey: string): "ok" | "ip" | "day" {
  const now = Date.now();
  const list = (perIp.get(ipKey) ?? []).filter((x) => now - x < 10 * 60_000);
  if (list.length >= PER_IP) return "ip";
  if (new Date().toDateString() !== day) {
    day = new Date().toDateString();
    dayCount = 0;
  }
  if (dayCount >= DAILY) return "day";
  list.push(now);
  perIp.set(ipKey, list);
  dayCount++;
  if (perIp.size > 5000) perIp.clear();
  return "ok";
}

// ---------- Ответ модели ----------

// Поставщик модели — одной настройкой (доп. ТЗ 3.6: для боевой версии меняется на модель в РК).
// OpenRouter (по умолчанию DeepSeek) — если задан OPENROUTER_API_KEY; Anthropic — если ANTHROPIC_API_KEY.
const PROVIDER: "openrouter" | "anthropic" | null =
  (process.env.AKHMET_PROVIDER as "openrouter" | "anthropic" | undefined) ??
  (process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.ANTHROPIC_API_KEY ? "anthropic" : null);
const MODEL = process.env.AKHMET_MODEL || (PROVIDER === "anthropic" ? "claude-opus-5-5" : "deepseek/deepseek-v4.1-flash");
// серверный запасной вариант при отказе модели — для моделей Anthropic, которые его поддерживают
const WITH_FALLBACK = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(MODEL);
export const AI_INFO = { provider: PROVIDER, model: PROVIDER ? MODEL : null };

const SYSTEM = `Ты — Ахмет, помощник на сайте Государственного архива Восточно-Казахстанской области.
Ты помогаешь посетителям найти открытые архивные материалы и разобраться, куда обратиться.

Правила, которые нельзя нарушать:
1. Отвечай только по результатам инструмента search_catalog и по справочным сведениям ниже (в них есть адреса и телефоны головного архива и всех филиалов — на вопрос «где архив в …» называй адрес оттуда, поиск по каталогу для этого не нужен). Ничего не добавляй от себя о составе фондов, датах и содержании документов.
2. Ссылайся на найденные записи только метками из результатов поиска: [D1], [F2] и т. п. Не придумывай шифры, номера фондов, описей, дел, адреса и ссылки. Если в результатах нет подходящего — прямо скажи, что в открытых материалах этого нет.
3. Ты не принимаешь заявления, запросы и заказы и не оформляешь справки. Для справок и запросов направляй на eGov.kz или e-Otinish (раздел сайта «Государственная услуга»).
4. Не обсуждай людей по именам, личные дела и закрытые сведения: скажи, что они не публикуются, и укажи порядок официального запроса.
5. Записи с пометкой demo — демонстрационные; если опираешься на них, упомяни это.
6. Отвечай на языке вопроса (казахский, русский или английский). Запросы к search_catalog формулируй по-русски: каталог описан на русском.
7. Пиши коротко и просто, для людей старшего возраста: 2–4 коротких абзаца, без списков из звёздочек, без заголовков, без Markdown.

${SITE_INFO}`;

const TOOL: Anthropic.Beta.BetaTool = {
  name: "search_catalog",
  description:
    "Поиск по открытым опубликованным записям электронного каталога архива: документам (фото, документы, карты, газеты, метрические книги, кино- и звукозаписи) и фондам. Возвращает только то, что разрешено к публикации. Вызывай 1–3 раза с разными формулировками, если первый поиск ничего не дал.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "1–3 ключевых слова по-русски: тема, место, организация или номер фонда. Без служебных слов и без слов «фото», «документы», «годы», «город»: вид материала передавай в doc_type, период — в year_from/year_to." },
      doc_type: { type: "string", enum: ["photo", "document", "map", "newspaper", "metric_book", "audio", "video"], description: "Вид материала, если он важен" },
      year_from: { type: "integer" },
      year_to: { type: "integer" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const client = PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 45_000, maxRetries: 1 }) : null;
const hasModel = PROVIDER === "openrouter" ? Boolean(process.env.OPENROUTER_API_KEY) : Boolean(client);

export async function ask(rawQuestion: string, lang: Lang, ipKey: string): Promise<Answer> {
  const { text: question, masked } = maskPersonal(rawQuestion.trim().slice(0, 500));
  const kind = classify(question);
  let answer: Answer;

  if (kind) {
    answer = restrictedAnswer(kind, lang);
  } else if (!hasModel) {
    answer = await templateAnswer(question, lang, "no_key");
  } else {
    const gate = allow(ipKey);
    answer = gate !== "ok" ? await templateAnswer(question, lang, "limit") : await modelAnswer(question, lang).catch(async (e) => {
      console.error("akhmet: model error", e instanceof Anthropic.APIError ? `${e.status} ${e.name}` : String(e).slice(0, 200));
      return templateAnswer(question, lang, "model_error");
    });
  }
  if (masked) answer.notice = answer.notice ?? "masked";

  // аналитика без персональных данных: только вид ответа и число источников (ТЗ 5.8 Д)
  await q(`insert into page_events(path, lang, event, value) values ('/assistant', $1, 'ai_answer', $2)`, [lang, `${answer.mode}:${answer.sources.length}`]).catch(() => {});
  return answer;
}

async function modelAnswer(question: string, lang: Lang): Promise<Answer> {
  const refs = new Map<string, Source>();
  const known = new Set<string>(); // шифры и номера фондов из найденного
  let dCount = 0;
  let fCount = 0;

  const runSearch = async (input: { query: string; doc_type?: string; year_from?: number; year_to?: number }) => {
    const r = await find(input.query, { docType: input.doc_type, from: input.year_from, to: input.year_to });
    const items = [
      ...r.docs.map((d) => {
        const ref = `D${++dCount}`;
        refs.set(ref, docSource(d, lang));
        if (d.cipher) known.add(d.cipher);
        known.add(d.fund_number);
        return { ref, type: d.doc_type, title: pick(d.title, "ru").text, date: d.date_text, approx_date: d.date_uncertain, place: d.place, cipher: d.cipher, digital_copy: d.has_copy, demo: d.is_demo };
      }),
      ...r.funds.map((f) => {
        const ref = `F${++fCount}`;
        refs.set(ref, fundSource(f, lang));
        known.add(f.fund_number);
        return { ref, fund_number: f.fund_number, title: pick(f.title, "ru").text, years: f.year_from ? `${f.year_from}–${f.year_to ?? ""}` : null, units: f.units_text, personal: f.kind === "personal", demo: f.is_demo };
      }),
    ];
    return {
      documents_total: r.docsTotal,
      funds_total: r.fundsTotal,
      ...(r.partial ? { note: "По всем словам запроса записей мало; добавлены записи, где совпала только часть слов. Проверь, подходят ли они к вопросу, и не выдавай неподходящие за ответ." } : {}),
      results: items,
    };
  };

  type SearchInput = { query: string; doc_type?: string; year_from?: number; year_to?: number };
  const parseInput = (input: unknown): SearchInput | null => {
    const i = input as { query?: unknown; doc_type?: unknown; year_from?: unknown; year_to?: unknown };
    if (typeof i?.query !== "string" || !i.query.trim()) return null;
    return {
      query: i.query.slice(0, 200),
      doc_type: typeof i.doc_type === "string" ? i.doc_type : undefined,
      year_from: typeof i.year_from === "number" ? i.year_from : undefined,
      year_to: typeof i.year_to === "number" ? i.year_to : undefined,
    };
  };

  const branches = await branchInfo();
  const system = branches ? `${SYSTEM}\n\n${branches}` : SYSTEM;
  const text = PROVIDER === "openrouter"
    ? await openrouterLoop(system, question, parseInput, runSearch)
    : await anthropicLoop(system, question, parseInput, runSearch);
  return finish(text, refs, known, lang);
}

// ---------- OpenRouter (DeepSeek и др.), формат OpenAI ----------

type ORMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function openrouterLoop(
  system: string,
  question: string,
  parseInput: (i: unknown) => { query: string } | null,
  runSearch: (i: never) => Promise<unknown>,
): Promise<string> {
  const tool = { type: "function", function: { name: TOOL.name, description: TOOL.description, parameters: TOOL.input_schema } };
  const messages: ORMessage[] = [{ role: "system", content: system }, { role: "user", content: question }];
  const usage = { input: 0, output: 0, cost: 0 };
  for (let turn = 0; turn < 4; turn++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetch(`${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Archive assistant demo",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: [tool],
        tool_choice: turn === 3 ? "none" : "auto",
        max_tokens: 1500,
        temperature: 0.2,
        usage: { include: true },
        // не отдавать запросы поставщикам, которые хранят данные для обучения
        provider: { data_collection: "deny" },
      }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`openrouter ${res.status}`);
    const data = (await res.json()) as {
      choices?: { finish_reason: string; message: { content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens: number; completion_tokens: number; cost?: number };
    };
    usage.input += data.usage?.prompt_tokens ?? 0;
    usage.output += data.usage?.completion_tokens ?? 0;
    usage.cost += data.usage?.cost ?? 0;
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("openrouter: empty response");
    if (!msg.tool_calls?.length) {
      console.log(`akhmet: ${MODEL} tokens in=${usage.input} out=${usage.output} cost=$${usage.cost.toFixed(5)}`);
      return (msg.content ?? "").trim();
    }
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      let args: unknown = null;
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* неверный JSON — сообщаем модели ошибкой */
      }
      const input = call.function.name === TOOL.name ? parseInput(args) : null;
      const content = input ? JSON.stringify(await runSearch(input as never)) : JSON.stringify({ error: "invalid arguments: query is required" });
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  throw new Error("openrouter: no final answer");
}

// ---------- Anthropic ----------

async function anthropicLoop(
  system: string,
  question: string,
  parseInput: (i: unknown) => { query: string } | null,
  runSearch: (i: never) => Promise<unknown>,
): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: question }];
  let final: Anthropic.Beta.BetaMessage | null = null;
  const usage = { input: 0, output: 0 };

  for (let turn = 0; turn < 4; turn++) {
    const res = await client!.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: turn === 3 ? { type: "none" } : { type: "auto" },
      messages,
      output_config: { effort: "low" },
      ...(WITH_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    usage.input += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0);
    usage.output += res.usage.output_tokens;
    if (res.stop_reason === "refusal") throw new Error("refusal");
    if (res.stop_reason !== "tool_use") {
      final = res;
      break;
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const input = parseInput(block.input);
      if (!input) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: "query is required", is_error: true });
        continue;
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(await runSearch(input as never)) });
    }
    messages.push({ role: "user", content: results });
  }
  console.log(`akhmet: ${MODEL} tokens in=${usage.input} out=${usage.output}`);
  if (!final) throw new Error("no final answer");
  return final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
}

// ---------- Проверка ответа: только найденные источники, без выдуманных шифров ----------

function finish(raw: string, refs: Map<string, Source>, known: Set<string>, lang: Lang): Answer {
  let text = raw;
  // источники — только реально найденные, в порядке упоминания; метки → номера [1], [2]
  const order: string[] = [];
  text = text.replace(/\[([DF]\d+)\]/g, (_, ref: string) => {
    if (!refs.has(ref)) return "";
    if (!order.includes(ref)) order.push(ref);
    return `[${order.indexOf(ref) + 1}]`;
  });
  // шифры и номера фондов, которых нет среди найденного, не показываем (доп. ТЗ 3.4)
  text = text.replace(/(?:ДЕМО-\d+|Р-\d+\w*|\b\d+П\b)(?:,\s*оп\.\s*\d+)?(?:,\s*д\.\s*\d+)?/g, (m) =>
    [...known].some((k) => m.startsWith(k) || k.startsWith(m)) ? m : "[шифр не подтверждён]",
  );
  text = text.replace(/\*\*|__|^#+\s*/gm, "");
  const paragraphs = text.split(/\n{2,}|\n(?=\S)/).map((p) => p.trim()).filter(Boolean).slice(0, 6);
  const NOT_FOUND = /ничего не|не нашл|не нашлось|не обнаружен|нет (документ|запис|материал|сведен)|там ничего|no (records|documents|materials)|nothing|жоқ|табылмады/i;
  const sources = order.map((r) => refs.get(r)!);

  return {
    mode: "model",
    // «не нашёл, но вот похожее» — грустное лицо, даже если есть ссылки на близкие записи
    mood: sources.length && !NOT_FOUND.test(paragraphs[0] ?? "") ? "found" : "sad",
    paragraphs,
    sources,
    links: sources.length ? [] : [{ label: T[lang].linkCatalog, href: `/${lang}/catalog?tab=funds` }, { label: T[lang].linkCall, href: "tel:+77232255976" }],
    suggestions: [],
  };
}

// ---------- Рекомендации по сайту (ТЗ 5.8 Д) ----------
// В модель уходят только обезличенные сводные цифры: число просмотров разделов, запросы без результатов
// (с вырезанными цифрами и адресами почты), доли ответов помощника. Персональных данных и закрытых документов нет.
export async function adviseSite(stats: string): Promise<string | null> {
  if (!hasModel) return null;
  const system =
    "Ты — аналитик сайта государственного архива. По сводной статистике дай 4–6 конкретных рекомендаций, как улучшить сайт: какие разделы дополнить, какие материалы оцифровать или опубликовать в первую очередь, какие запросы остаются без ответа и что с ними сделать. Пиши по-русски, коротко, каждый пункт с новой строки, начинай с «— ». Опирайся только на цифры из сводки, ничего не придумывай.";
  try {
    if (PROVIDER === "openrouter") {
      const res = await fetch(`${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Archive site analytics demo" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: system }, { role: "user", content: stats }],
          max_tokens: 700,
          temperature: 0.2,
          provider: { data_collection: "deny" },
        }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return j.choices?.[0]?.message?.content?.trim() || null;
    }
    if (client) {
      const r = await client.messages.create({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: stats }] });
      return r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}
