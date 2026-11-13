// Дополнения к демо-каталогу по ТЗ 5.3: тематики (поиск «по тематике»), язык, число листов, историческая справка.
// Загружаются повторно без дублей: тематики — on conflict, остальные поля — только если ещё пустые.

type L = { ru: string; kk: string; en: string };

export const TOPICS: { slug: string; name: L }[] = [
  { slug: "city", name: { ru: "Город и архитектура", kk: "Қала және сәулет", en: "Towns and architecture" } },
  { slug: "transport", name: { ru: "Транспорт и мосты", kk: "Көлік және көпірлер", en: "Transport and bridges" } },
  { slug: "industry", name: { ru: "Промышленность и стройки", kk: "Өнеркәсіп және құрылыс", en: "Industry and construction" } },
  { slug: "war", name: { ru: "Великая Отечественная война", kk: "Ұлы Отан соғысы", en: "Great Patriotic War" } },
  { slug: "genealogy", name: { ru: "Родословная и личный состав", kk: "Шежіре және жеке құрам", en: "Family history and personnel" } },
  { slug: "culture", name: { ru: "Культура и праздники", kk: "Мәдениет және мерекелер", en: "Culture and celebrations" } },
];

// ключ демо-документа (db/seed/catalog.ts) → тематики
export const DOC_TOPICS: Record<string, string[]> = {
  "lenin-ave-1963": ["city"],
  "housing-1966": ["city", "industry"],
  "bridge-1961": ["city", "transport"],
  "may-1965": ["culture"],
  "embankment-1968": ["city"],
  "theatre-1960s": ["city", "culture"],
  "tram-1959": ["city", "transport"],
  "panorama-1970s": ["city"],
  "album-1968": ["city", "industry"],
  "ridder-1958": ["city"],
  "order-1952": ["industry"],
  "hydro-1958": ["industry"],
  "protocol-1947": ["city"],
  "map-1912": ["city"],
  "newspaper-1955": ["culture"],
  "conscripts-1943": ["war"],
  "staff-orders-1971": ["genealogy", "industry"],
  "personnel-files-1960": ["genealogy"],
  "newsreel-1961": ["transport"],
  "memoir-1985": ["industry"],
  "draft-1975": ["industry"],
  "metric-1905": ["genealogy"],
  "metric-1910": ["genealogy"],
  "metric-1914": ["genealogy"],
};

export const METRIC_NOTE: L = {
  ru: "Метрические книги вели приходские церкви: в них записывали рождения и крещения, браки и смерти прихожан. До создания органов записи актов гражданского состояния (ЗАГС) в 1918–1920-х годах это был основной документ о гражданском состоянии человека. Сегодня метрические книги — главный источник для составления родословных.",
  kk: "Метрикалық кітаптарды шіркеу приходтары жүргізген: оларға приход тұрғындарының тууы мен шоқынуы, некесі және қайтыс болуы жазылған. 1918–1920 жылдары азаматтық хал актілерін жазу (АХАЖ) органдары құрылғанға дейін бұл адамның азаматтық жағдайы туралы негізгі құжат болған. Бүгінде метрикалық кітаптар — шежіре құрудың басты дереккөзі.",
  en: "Parish registers were kept by parish churches: they recorded births and baptisms, marriages and deaths. Until civil registry offices were set up in the 1918–1920s they were the main record of a person's civil status. Today they are the main source for family history research.",
};

// Исторические личности (ТЗ 5.6). Сведения — только из календарей юбилейных и памятных дат архива (годы смерти — общеизвестные).
// match — часть фамилии для поиска связанных событий хронологии и записей каталога.
export const PERSONS: { slug: string; name: L; years: string; bio: L; source: string; match: string }[] = [
  {
    slug: "abai-kunanbaev", match: "Кунанба", years: "1845–1904", source: "Календарь юбилейных и памятных дат ВКО на 2025 год (материалы архива)",
    name: { ru: "Абай Кунанбаев", kk: "Абай Құнанбайұлы", en: "Abai Kunanbayev" },
    bio: { ru: "Поэт-просветитель, основоположник казахской письменной литературы. Родился 10 августа 1845 года.", kk: "Ақын-ағартушы, қазақ жазба әдебиетінің негізін салушы. 1845 жылғы 10 тамызда туған.", en: "Poet and educator, founder of Kazakh written literature. Born on 10 August 1845." },
  },
  {
    slug: "shakarim", match: "Шакарим", years: "1858–1931", source: "Календарь юбилейных и памятных дат ВКО на 2023 год (материалы архива)",
    name: { ru: "Шакарим Кудайбердыев", kk: "Шәкәрім Құдайбердіұлы", en: "Shakarim Kudaiberdiev" },
    bio: { ru: "Поэт, философ, мыслитель. Родился 23 июля 1858 года.", kk: "Ақын, философ, ойшыл. 1858 жылғы 23 шілдеде туған.", en: "Poet, philosopher and thinker. Born on 23 July 1858." },
  },
  {
    slug: "mukhtar-auezov", match: "Ауэзов", years: "1897–1961", source: "Календарь юбилейных и памятных дат ВКО на 2022 год (материалы архива)",
    name: { ru: "Мухтар Омарханович Ауэзов", kk: "Мұхтар Омарханұлы Әуезов", en: "Mukhtar Auezov" },
    bio: { ru: "Писатель, автор романа «Путь Абая». Родился 28 сентября 1897 года.", kk: "Жазушы, «Абай жолы» романының авторы. 1897 жылғы 28 қыркүйекте туған.", en: "Writer, author of the novel “The Path of Abai”. Born on 28 September 1897." },
  },
  {
    slug: "kanysh-satpaev", match: "Сатпаев", years: "1899–1964", source: "Календарь юбилейных и памятных дат ВКО на 2024 год (материалы архива)",
    name: { ru: "Каныш Имантаевич Сатпаев", kk: "Қаныш Имантайұлы Сәтбаев", en: "Kanysh Satpayev" },
    bio: { ru: "Академик, геолог. Родился 12 апреля 1899 года.", kk: "Академик, геолог. 1899 жылғы 12 сәуірде туған.", en: "Academician and geologist. Born on 12 April 1899." },
  },
  {
    slug: "evgeny-michaelis", match: "Михаэлис", years: "1841–1913", source: "Календарь юбилейных и памятных дат ВКО на 2026 год (материалы архива)",
    name: { ru: "Евгений Петрович Михаэлис", kk: "Евгений Петрович Михаэлис", en: "Evgeny Michaelis" },
    bio: { ru: "Политический ссыльный, учёный, краевед, друг Абая. Родился 26 сентября 1841 года.", kk: "Саяси жер аударылған, ғалым, өлкетанушы, Абайдың досы. 1841 жылғы 26 қыркүйекте туған.", en: "Political exile, scholar, local historian and friend of Abai. Born on 26 September 1841." },
  },
  {
    slug: "orest-kostyurin", match: "Костюрин", years: "1859–1924", source: "Календарь юбилейных и памятных дат ВКО на 2024 год (материалы архива)",
    name: { ru: "Орест Фёдорович Костюрин", kk: "Орест Федорович Костюрин", en: "Orest Kostyurin" },
    bio: { ru: "Политический ссыльный, Усть-Каменогорский городской глава. Родился 23 декабря 1859 года.", kk: "Саяси жер аударылған, Өскемен қаласының басшысы. 1859 жылғы 23 желтоқсанда туған.", en: "Political exile and mayor of Ust-Kamenogorsk. Born on 23 December 1859." },
  },
  {
    slug: "vasily-sapozhnikov", match: "Сапожников", years: "1861–1924", source: "Календарь юбилейных и памятных дат ВКО на 2026 год (материалы архива)",
    name: { ru: "Василий Васильевич Сапожников", kk: "Василий Васильевич Сапожников", en: "Vasily Sapozhnikov" },
    bio: { ru: "Исследователь Алтая. Родился 9 декабря 1861 года.", kk: "Алтайды зерттеуші. 1861 жылғы 9 желтоқсанда туған.", en: "Explorer of the Altai. Born on 9 December 1861." },
  },
  {
    slug: "vladimir-obruchev", match: "Обручев", years: "1863–1956", source: "Календари юбилейных и памятных дат ВКО на 2023 и 2026 годы (материалы архива)",
    name: { ru: "Владимир Афанасьевич Обручев", kk: "Владимир Афанасьевич Обручев", en: "Vladimir Obruchev" },
    bio: { ru: "Исследователь Алтая. Родился 10 октября 1863 года. В 1911 году провёл научную экспедицию в Восточный Казахстан.", kk: "Алтайды зерттеуші. 1863 жылғы 10 қазанда туған. 1911 жылы Шығыс Қазақстанға ғылыми экспедиция жүргізді.", en: "Explorer of the Altai. Born on 10 October 1863. In 1911 he led a scientific expedition to East Kazakhstan." },
  },
];

// Тематики выставок (ТЗ 5.7, 6.5)
export const EXHIBITION_TOPICS: { slug: string; name: L; exhibitions: string[] }[] = [
  { slug: "city", name: { ru: "Города и люди", kk: "Қалалар мен адамдар", en: "Towns and people" }, exhibitions: ["gorod-na-irtyshe"] },
  { slug: "genealogy", name: { ru: "Родословная", kk: "Шежіре", en: "Family history" }, exhibitions: ["metricheskie-knigi"] },
];
