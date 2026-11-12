// Архив и филиалы. Источник: материалы заказчика — «Контакты.docx» и «Адреса и контакты филиалов.xls».
// Директора — из того же .xls (столбец «Директор»), директор архива — из «Структура.docx».
// Координаты не заданы: точные координаты подтверждает архив (доп. ТЗ 3.3).
// В исходном .xls у двух адресов почты, похоже, опечатки в домене (alimvko, qov) — оставлены пустыми до уточнения.

type L = { ru: string; kk?: string; en?: string };
export type BranchSeed = {
  slug: string;
  name: L;
  short_name: L;
  address: L;
  phone: string | null;
  email?: string | null;
  hours?: L | null;
  lat?: number;
  lng?: number;
  is_main?: boolean;
  source: string;
};

const XLS = "Адреса и контакты филиалов.xls (материалы заказчика)";

export const BRANCHES: BranchSeed[] = [
  {
    slug: "main",
    name: { ru: "Государственный архив Восточно-Казахстанской области", kk: "Шығыс Қазақстан облысының мемлекеттік архиві", en: "State Archive of East Kazakhstan Region" },
    short_name: { ru: "Главное здание", kk: "Бас ғимарат", en: "Main building" },
    address: { ru: "070000, г. Усть-Каменогорск, ул. Бейбітшілік, 26/1 (Головкова, 26/1)" },
    phone: "8 (7232) 25-59-76",
    email: "arhiv-ukg@yandex.kz",
    hours: { ru: "Пн–Пт 8:00–17:00, читальный зал 9:00–16:00", kk: "Дс–Жм 8:00–17:00, оқу залы 9:00–16:00", en: "Mon–Fri 8:00–17:00, reading room 9:00–16:00" },
    is_main: true,
    source: "Контакты.docx (материалы заказчика)",
  },
  { slug: "ust-kamenogorsk-personnel", name: { ru: "Усть-Каменогорский городской филиал по личному составу" }, short_name: { ru: "Усть-Каменогорск, по личному составу" }, address: { ru: "г. Усть-Каменогорск, ул. Потанина, 12/2" }, phone: "8 (7232) 76-65-60", email: "g.bisenova@akimvko.gov.kz", source: XLS },
  { slug: "ridder", name: { ru: "Риддерский городской филиал" }, short_name: { ru: "Риддер" }, address: { ru: "г. Риддер, ул. Ч. Уалиханова, 44" }, phone: "8 (72336) 4-22-64", email: "sh.sarsembinova@akimvko.gov.kz", source: XLS },
  { slug: "altai", name: { ru: "Филиал района Алтай" }, short_name: { ru: "Алтай" }, address: { ru: "район Алтай, ул. М. Горького, 33" }, phone: "8 (72335) 4-16-30", email: "sa.seilkhanov@akimvko.gov.kz", source: XLS },
  { slug: "glubokoe", name: { ru: "Глубоковский районный филиал" }, short_name: { ru: "Глубокое" }, address: { ru: "Глубоковский район, п. Глубокое, ул. Пирогова, 6" }, phone: "8 (72331) 2-28-78", email: null, source: XLS },
  { slug: "zaisan", name: { ru: "Зайсанский районный филиал" }, short_name: { ru: "Зайсан" }, address: { ru: "Зайсанский район, г. Зайсан, ул. Д. А. Конаева, 52" }, phone: "8 (72340) 2-14-76", email: null, source: XLS },
  { slug: "katon-karagai", name: { ru: "Катон-Карагайский районный филиал" }, short_name: { ru: "Катон-Карагай" }, address: { ru: "Катон-Карагайский район, с. Катон-Карагай, ул. Жампеисова, 19/1" }, phone: "8 (72342) 2-90-07", email: "a.ziasheva1@akimvko.gov.kz", source: XLS },
  { slug: "kurchum", name: { ru: "Курчумский районный филиал" }, short_name: { ru: "Курчум" }, address: { ru: "Курчумский район, с. Курчум, ул. Барак Батыра, 25" }, phone: "8 (72339) 3-31-04", email: "kabdualieva.s@akimvko.gov.kz", source: XLS },
  { slug: "markakol", name: { ru: "Филиал района Марқакөл" }, short_name: { ru: "Марқакөл" }, address: { ru: "район Марқакөл, с. Маркаколь, ул. Крахмаля, 67" }, phone: null, email: "s.smagulov1@akimvko.gov.kz", source: XLS },
  { slug: "samar", name: { ru: "Филиал района Самар" }, short_name: { ru: "Самар" }, address: { ru: "район Самар, с. Самар, ул. Горохова, 58" }, phone: "8 (72333) 3-10-32", email: "a.babataev@akimvko.gov.kz", source: XLS },
  { slug: "tarbagatai", name: { ru: "Тарбагатайский районный филиал" }, short_name: { ru: "Тарбагатай" }, address: { ru: "Тарбагатайский район, с. Акжар, ул. Даулетбая, 45" }, phone: "8 (72344) 2-14-68", email: "b.zhurekbaev@akimvko.gov.kz", source: XLS },
  { slug: "ulan", name: { ru: "Уланский районный филиал" }, short_name: { ru: "Улан" }, address: { ru: "Уланский район, пос. Касыма Кайсенова, ул. З. Ахметова, 5" }, phone: "8 (72338) 2-71-20", email: "a.abdrasulin@akimvko.gov.kz", source: XLS },
  { slug: "ulken-naryn", name: { ru: "Филиал района Үлкен Нарын" }, short_name: { ru: "Үлкен Нарын" }, address: { ru: "район Үлкен Нарын, с. Улкен Нарын, ул. Огнева, 40" }, phone: "8 (72341) 2-15-99", email: "ba.ozhenov@akimvko.gov.kz", source: XLS },
  { slug: "shemonaikha", name: { ru: "Шемонаихинский районный филиал" }, short_name: { ru: "Шемонаиха" }, address: { ru: "Шемонаихинский район, г. Шемонаиха, ул. Жукова, здание 2" }, phone: "8 (72332) 6-23-58", email: "n.kusataev@akimvko.gov.kz", source: XLS },
];

// Примерные координаты — центр населённого пункта (для Усть-Каменогорска — центр города),
// проставлены разработчиком для демонстрации карты. Архив их не подтверждал: на сайте метки
// подписаны «примерно», а маршрут строится по текстовому адресу (доп. ТЗ 3.3).
export const APPROX_COORDS: Record<string, [number, number]> = {
  main: [49.949, 82.628],
  "ust-kamenogorsk-personnel": [49.962, 82.607],
  ridder: [50.344, 83.512],
  altai: [49.727, 84.272],
  glubokoe: [50.136, 82.311],
  zaisan: [47.467, 84.871],
  "katon-karagai": [49.172, 85.614],
  kurchum: [48.566, 83.655],
  markakol: [48.68, 85.6],
  samar: [49.031, 83.35],
  tarbagatai: [47.613, 81.069],
  ulan: [49.857, 82.497],
  "ulken-naryn": [49.209, 84.512],
  shemonaikha: [50.628, 81.909],
};

// Директора архива и филиалов: «Структура.docx» и столбец «Директор» в «Адреса и контакты филиалов.xls» (материалы заказчика)
export const DIRECTORS: Record<string, string> = {
  "main": "Жапаров Аскар Кенжебаевич",
  "ust-kamenogorsk-personnel": "Бисенова Гулсим Алдабергеновна",
  "ridder": "Сарсембинова Шынар Жасулановна",
  "altai": "Сейлханов Сабырбек Какенович",
  "glubokoe": "Төлеу Бақдәулет Ибрахымұлы",
  "zaisan": "Козлов Виктор Николаевич",
  "katon-karagai": "Зияшева Асель Тлеухановна",
  "kurchum": "Кабдуалиева Сандугаш Алтаевна",
  "markakol": "Смагулов Самат Нурлыбекович",
  "samar": "Бабатаев Айдар Шамилевич",
  "tarbagatai": "Журекбаев Бауыржан Сеитказинович",
  "ulan": "Абдрасулин Аслан Оралович",
  "ulken-naryn": "Оженов Бауржан Файзоллинович",
  "shemonaikha": "Кусатаев Нуржан Тельманович",
};
