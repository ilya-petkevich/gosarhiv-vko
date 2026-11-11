// Демонстрационные записи каталога (доп. ТЗ 4: 20–50 тестовых документов).
// Все записи и шифры условные, лежат в отдельных демо-фондах «ДЕМО-…» и помечены is_demo.
// Цифровые копии — сгенерированные изображения с надписью «ДЕМО», а не сканы реальных документов.
// Набор нарочно содержит закрытые случаи для проверки (доп. ТЗ 6): копия не публикуется,
// запись «не публиковать», черновик.

type L = { ru: string; kk?: string; en?: string };
type Access = "public" | "no_publish" | "needs_check";

export type DemoDoc = {
  key: string;
  fund: string;
  inv: string;
  case: string;
  case_title: string;
  title: L;
  description: L;
  doc_type: "document" | "photo" | "map" | "newspaper" | "audio" | "video" | "metric_book";
  date_text: string;
  year_from: number;
  year_to: number;
  date_uncertain?: boolean;
  place?: string;
  author?: string;
  branch?: string;
  publish?: Access;
  status?: "draft" | "published";
  pages?: number;
  file_access?: Access;
};

export const DEMO_FUNDS = [
  { number: "ДЕМО-1", title: { ru: "Фотодокументы по истории городов области (демонстрационный фонд)", kk: "Облыс қалаларының тарихы бойынша фотоқұжаттар (демо-қор)", en: "Photographs on the history of the region's towns (demo fonds)" }, year_from: 1955, year_to: 1979, inv: "Фотодокументы, позитивы" },
  { number: "ДЕМО-2", title: { ru: "Документы по истории промышленности и городского хозяйства (демонстрационный фонд)", kk: "Өнеркәсіп және қала шаруашылығы тарихы бойынша құжаттар (демо-қор)", en: "Records on the history of industry and municipal services (demo fonds)" }, year_from: 1912, year_to: 1985, inv: "Документы постоянного хранения" },
  { number: "ДЕМО-3", title: { ru: "Метрические книги церквей уезда (демонстрационный фонд)", kk: "Уезд шіркеулерінің метрикалық кітаптары (демо-қор)", en: "Parish registers of the district churches (demo fonds)" }, year_from: 1900, year_to: 1917, inv: "Метрические книги" },
];

const UK = "Усть-Каменогорск";
const DEMO_NOTE = "Демонстрационная запись: название, описание и шифр условные.";

export const DEMO_DOCS: DemoDoc[] = [
  { key: "lenin-ave-1963", fund: "ДЕМО-1", inv: "1", case: "12", case_title: "Виды города, 1960–1964", title: { ru: "Проспект Ленина, общий вид", kk: "Ленин даңғылы, жалпы көрініс", en: "Lenin Avenue, general view" }, description: { ru: `Городская улица с жилыми домами и деревьями вдоль проезжей части. ${DEMO_NOTE}`, kk: `Көше бойында тұрғын үйлер мен ағаштар. Демо-жазба: атауы, сипаттамасы және шифры шартты.`, en: `A city street lined with houses and trees. Demo record: title, description and reference code are illustrative.` }, doc_type: "photo", date_text: "1963", year_from: 1963, year_to: 1963, place: UK, pages: 2 },
  { key: "housing-1966", fund: "ДЕМО-1", inv: "1", case: "14", case_title: "Строительство в городе, 1965–1969", title: { ru: "Строительство жилого квартала" }, description: { ru: `Возведение многоэтажных домов, на переднем плане строительная техника. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1966", year_from: 1966, year_to: 1966, place: UK, pages: 1 },
  { key: "bridge-1961", fund: "ДЕМО-1", inv: "1", case: "12", case_title: "Виды города, 1960–1964", title: { ru: "Мост через Иртыш", kk: "Ертіс арқылы өтетін көпір", en: "Bridge over the Irtysh" }, description: { ru: `Вид на мост с берега реки. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1961", year_from: 1961, year_to: 1961, place: UK, pages: 1 },
  { key: "may-1965", fund: "ДЕМО-1", inv: "1", case: "13", case_title: "Праздники и события, 1960–1969", title: { ru: "Первомайская демонстрация на центральной площади" }, description: { ru: `Колонны горожан с флагами и транспарантами. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1 мая 1965", year_from: 1965, year_to: 1965, place: UK, pages: 3 },
  { key: "embankment-1968", fund: "ДЕМО-1", inv: "1", case: "14", case_title: "Строительство в городе, 1965–1969", title: { ru: "Набережная Иртыша" }, description: { ru: `Прогулочная набережная, вдали — жилые дома. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1968", year_from: 1968, year_to: 1968, place: UK, pages: 1 },
  { key: "theatre-1960s", fund: "ДЕМО-1", inv: "1", case: "13", case_title: "Праздники и события, 1960–1969", title: { ru: "Здание драматического театра" }, description: { ru: `Фасад театра с колоннами. Дата съёмки установлена приблизительно. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1960-е", year_from: 1960, year_to: 1969, date_uncertain: true, place: UK, pages: 1 },
  { key: "tram-1959", fund: "ДЕМО-1", inv: "1", case: "11", case_title: "Виды города, 1955–1959", title: { ru: "Трамвайная линия на городской улице" }, description: { ru: `Трамвай на остановке, рядом пешеходы. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1959", year_from: 1959, year_to: 1959, place: UK, pages: 1 },
  { key: "panorama-1970s", fund: "ДЕМО-1", inv: "1", case: "15", case_title: "Виды города, 1970–1979", title: { ru: "Вид на город с горы", kk: "Таудан қалаға көрініс", en: "View of the city from the hill" }, description: { ru: `Панорама города и реки. Год съёмки не установлен точно. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1970-е", year_from: 1970, year_to: 1979, date_uncertain: true, place: UK, pages: 1 },
  { key: "album-1968", fund: "ДЕМО-1", inv: "1", case: "16", case_title: "Фотоальбомы", title: { ru: "Фотоальбом о городе металлургов" }, description: { ru: `Альбом из 48 снимков предприятий и улиц. Оцифровка не проводилась — доступно только описание. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1968", year_from: 1968, year_to: 1968, place: UK, pages: 0 },
  { key: "ridder-1958", fund: "ДЕМО-1", inv: "1", case: "11", case_title: "Виды города, 1955–1959", title: { ru: "Улица в Риддере (Лениногорске)", kk: "Риддердегі көше", en: "A street in Ridder (Leninogorsk)" }, description: { ru: `Центральная улица города, в те годы — Лениногорск. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1958", year_from: 1958, year_to: 1958, place: "Риддер", branch: "ridder", pages: 1 },

  { key: "order-1952", fund: "ДЕМО-2", inv: "1", case: "4", case_title: "Приказы по основной деятельности, 1952", title: { ru: "Приказ о вводе в эксплуатацию нового цеха" }, description: { ru: `Машинописный документ на одном листе с подписями и печатью. ${DEMO_NOTE}` }, doc_type: "document", date_text: "1952", year_from: 1952, year_to: 1952, place: UK, pages: 1 },
  { key: "hydro-1958", fund: "ДЕМО-2", inv: "1", case: "9", case_title: "Отчёты о строительстве, 1955–1960", title: { ru: "Отчёт о ходе строительства гидроэлектростанции на Иртыше" }, description: { ru: `Годовой отчёт строительного управления: объёмы работ, численность работников. ${DEMO_NOTE}` }, doc_type: "document", date_text: "1958", year_from: 1958, year_to: 1958, place: "Восточно-Казахстанская область", pages: 4 },
  { key: "protocol-1947", fund: "ДЕМО-2", inv: "1", case: "2", case_title: "Протоколы заседаний, 1947", title: { ru: "Протокол заседания городского исполнительного комитета" }, description: { ru: `Вопросы благоустройства улиц и ремонта школ. ${DEMO_NOTE}` }, doc_type: "document", date_text: "март 1947", year_from: 1947, year_to: 1947, place: UK, pages: 3 },
  { key: "map-1912", fund: "ДЕМО-2", inv: "1", case: "1", case_title: "Планы и карты", title: { ru: "Карта-схема города и окрестностей", kk: "Қала мен оның маңының сызба-картасы", en: "Sketch map of the town and surroundings" }, description: { ru: `Рукописная карта-схема с обозначением улиц и реки. ${DEMO_NOTE}` }, doc_type: "map", date_text: "1912", year_from: 1912, year_to: 1912, place: UK, pages: 1 },
  { key: "newspaper-1955", fund: "ДЕМО-2", inv: "1", case: "7", case_title: "Печатные издания", title: { ru: "Подшивка городской газеты за январь" }, description: { ru: `Номера городской газеты за месяц. Полный перечень газет архива — в разделе «Фонды». ${DEMO_NOTE}` }, doc_type: "newspaper", date_text: "январь 1955", year_from: 1955, year_to: 1955, place: UK, pages: 4 },
  { key: "conscripts-1943", fund: "ДЕМО-2", inv: "1", case: "5", case_title: "Документы военных лет", title: { ru: "Списки призванных в армию по району" }, description: { ru: `Документ содержит персональные данные. Цифровая копия на сайте не публикуется; сведения можно запросить в установленном порядке. ${DEMO_NOTE}` }, doc_type: "document", date_text: "1943", year_from: 1943, year_to: 1943, place: "Восточно-Казахстанская область", pages: 2, file_access: "needs_check" },
  { key: "staff-orders-1971", fund: "ДЕМО-2", inv: "2", case: "21", case_title: "Приказы по личному составу, 1971", title: { ru: "Книга приказов по личному составу завода" }, description: { ru: `Сведения о приёме, переводе и увольнении работников — используются для справок о стаже. Копия не публикуется: содержит персональные данные. ${DEMO_NOTE}` }, doc_type: "document", date_text: "1971", year_from: 1971, year_to: 1971, place: UK, pages: 2, file_access: "no_publish" },
  { key: "personnel-files-1960", fund: "ДЕМО-2", inv: "2", case: "30", case_title: "Личные дела", title: { ru: "Личные дела работников (не публикуется)" }, description: { ru: `Запись для проверки: описание закрыто, на сайте и в поиске не показывается. ${DEMO_NOTE}` }, doc_type: "document", date_text: "1960", year_from: 1960, year_to: 1960, place: UK, pages: 1, publish: "no_publish", file_access: "no_publish" },
  { key: "newsreel-1961", fund: "ДЕМО-2", inv: "3", case: "1", case_title: "Кинодокументы", title: { ru: "Кинохроника открытия моста" }, description: { ru: `Кинодокумент на плёнке, оцифровка не проводилась — доступно только описание. ${DEMO_NOTE}` }, doc_type: "video", date_text: "1961", year_from: 1961, year_to: 1961, place: UK, pages: 0 },
  { key: "memoir-1985", fund: "ДЕМО-2", inv: "3", case: "4", case_title: "Звукозаписи", title: { ru: "Воспоминания ветерана труда (звукозапись)" }, description: { ru: `Запись беседы о строительстве предприятия. Право на публикацию уточняется. ${DEMO_NOTE}` }, doc_type: "audio", date_text: "1985", year_from: 1985, year_to: 1985, place: UK, pages: 0 },
  { key: "draft-1975", fund: "ДЕМО-2", inv: "1", case: "12", case_title: "Фотографии предприятий", title: { ru: "Черновик: цех металлургического завода" }, description: { ru: `Запись в статусе черновика — на сайте не видна до согласования. ${DEMO_NOTE}` }, doc_type: "photo", date_text: "1975", year_from: 1975, year_to: 1975, place: UK, pages: 1, status: "draft" },

  { key: "metric-1905", fund: "ДЕМО-3", inv: "1", case: "3", case_title: "Метрические книги, 1905", title: { ru: "Метрическая книга сельской церкви за 1905 год", kk: "Ауыл шіркеуінің 1905 жылғы метрикалық кітабы", en: "Parish register of a village church, 1905" }, description: { ru: `Записи о рождении, браке и смерти. ${DEMO_NOTE}` }, doc_type: "metric_book", date_text: "1905", year_from: 1905, year_to: 1905, place: "Усть-Каменогорский уезд", pages: 3 },
  { key: "metric-1910", fund: "ДЕМО-3", inv: "1", case: "8", case_title: "Метрические книги, 1910", title: { ru: "Метрическая книга городской церкви за 1910 год" }, description: { ru: `Записи о рождении, браке и смерти. ${DEMO_NOTE}` }, doc_type: "metric_book", date_text: "1910", year_from: 1910, year_to: 1910, place: UK, pages: 3 },
  { key: "metric-1914", fund: "ДЕМО-3", inv: "1", case: "12", case_title: "Метрические книги, 1914", title: { ru: "Метрическая книга сельской церкви за 1914 год" }, description: { ru: `Записи о рождении, браке и смерти. ${DEMO_NOTE}` }, doc_type: "metric_book", date_text: "1914", year_from: 1914, year_to: 1914, place: "Усть-Каменогорский уезд", pages: 2 },
];

// ---------- Демо-изображения ----------

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function rnd(seed: number) {
  let x = seed;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}

export function demoImage(d: DemoDoc, page: number, seedNum: number): string {
  const r = rnd(seedNum * 31 + page * 7);
  const W = 1200;
  const H = d.doc_type === "photo" ? 860 : 1600;
  const label = `ДЕМО · ${esc(d.fund)}, оп. ${esc(d.inv)}, д. ${esc(d.case)} · лист ${page}`;
  let body = "";
  if (d.doc_type === "photo") {
    // условный городской пейзаж в сепии
    let x = 0;
    let houses = "";
    while (x < W) {
      const w = 60 + r() * 140;
      const h = 120 + r() * 320;
      houses += `<rect x="${x.toFixed(0)}" y="${(560 - h).toFixed(0)}" width="${(w - 8).toFixed(0)}" height="${h.toFixed(0)}" fill="#6E5A44" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`;
      for (let wy = 580 - h; wy < 540; wy += 34) for (let wx = x + 10; wx < x + w - 24; wx += 26) houses += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="12" height="18" fill="#D9C3A0" opacity=".55"/>`;
      x += w;
    }
    body = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9DCC4"/><stop offset="1" stop-color="#B79A72"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>${houses}<rect y="560" width="${W}" height="${H - 560}" fill="#8A7458"/>
<path d="M0 700 Q300 660 600 700 T1200 690" stroke="#5E4C38" stroke-width="6" fill="none" opacity=".6"/>`;
  } else {
    // условный лист документа: строки текста
    let lines = "";
    const top = d.doc_type === "map" ? 0 : 260;
    if (d.doc_type === "map") {
      lines = `<path d="M100 1300 C400 1000 500 700 1100 300" stroke="#7FA3B8" stroke-width="28" fill="none" opacity=".7"/>`;
      for (let i = 0; i < 26; i++) lines += `<line x1="${(150 + r() * 900).toFixed(0)}" y1="${(250 + r() * 1100).toFixed(0)}" x2="${(150 + r() * 900).toFixed(0)}" y2="${(250 + r() * 1100).toFixed(0)}" stroke="#6E5A44" stroke-width="5" opacity=".55"/>`;
    } else {
      lines += `<rect x="380" y="140" width="440" height="22" rx="4" fill="#6E5A44" opacity=".6"/>`;
      for (let y = top; y < H - 220; y += 46) {
        const w = 800 - r() * (y % 7 === 0 ? 400 : 120);
        lines += `<rect x="160" y="${y}" width="${w.toFixed(0)}" height="14" rx="4" fill="#6E5A44" opacity="${(0.35 + r() * 0.3).toFixed(2)}"/>`;
      }
    }
    body = `<rect width="${W}" height="${H}" fill="#EFE4CF"/><rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="#F7EEDC" stroke="#D9C3A0" stroke-width="4"/>${lines}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}
<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="sans-serif" font-size="150" font-weight="700" fill="#fff" opacity=".35" transform="rotate(-18 ${W / 2} ${H / 2})">ДЕМО</text>
<rect x="0" y="${H - 64}" width="${W}" height="64" fill="#1F1A16" opacity=".75"/>
<text x="24" y="${H - 22}" font-family="sans-serif" font-size="28" fill="#fff">${label}</text>
</svg>`;
}
