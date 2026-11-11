// Справочные разделы об услугах (доп. ТЗ 9). Только сведения и явные ссылки на официальные ресурсы:
// заявлений, заказов и оплаты на сайте нет.
// Источники: Правила (приказ МКС РК № 159 от 29.05.2020, редакция с прежнего сайта архива),
// памятка архива, постановление акимата ВКО № 289 от 15.12.2023 (цены сверены со сканом, стр. 10–14).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang } from "@/i18n/dict";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

const EGOV = "https://egov.kz/cms/ru/services/apostil/e_059";

const PRICES: [string, string, string, string][] = [
  ["6.1", "Научное консультирование по интересующей теме (история вопроса, эпоха, персоналии, генеалогические изыскания)", "1 час", "3 331,0"],
  ["6.2.1", "Исполнение запросов тематического и генеалогического характера: просмотр дел", "дело", "2 030,4"],
  ["6.3.1", "Выявление информации по научно-справочному аппарату: машинописные описи", "заголовок", "167,0"],
  ["6.3.2", "— рукописные описи", "заголовок", "278,0"],
  ["6.3.3", "— каталоги, картотеки", "карточка", "167,0"],
  ["6.3.4", "— автоматизированная информационная поисковая система", "запись", "222,0"],
  ["6.4.1", "Выявление информации по опубликованным источникам", "печатный лист", "67,7"],
  ["6.4.2", "— по журналам", "печатный лист", "282,0"],
  ["6.4.3", "— по газетам", "печатный лист", "169,2"],
  ["6.5.1", "Выявление информации по документам XIX–XXI вв., рукописный разборчивый текст", "лист", "278,0"],
  ["6.5.2", "— машинописный текст", "лист", "167,0"],
  ["6.5.3", "— трудночитаемый, угасающий текст", "лист", "555,0"],
  ["6.6", "Дополнительный экземпляр архивной справки по просьбе заявителя", "экземпляр", "833,0"],
  ["6.7", "Дубликат или переоформление архивной справки", "экземпляр", "833,0"],
  ["8.1.1.1.1", "Ксерокопия документа до 1900 г., А4", "лист", "455,0"],
  ["8.1.1.1.2", "— документа 1901–1917 гг.", "лист", "379,0"],
  ["8.1.1.1.3", "— документа 1918–1945 гг.", "лист", "316,0"],
  ["8.1.1.1.4", "— документа 1946–1990 гг.", "лист", "263,0"],
  ["8.1.1.1.5", "— документа с 1991 г.", "лист", "219,0"],
  ["8.3.1", "Цифровая копия документа XIX в. – 1930 г., А4, 300 dpi", "образ", "507,0"],
  ["8.3.2", "— документа 1931 г. – XXI в.", "образ", "452,0"],
  ["8.5.2", "Съёмка документа своим телефоном/фотоаппаратом в присутствии работника архива: XIX в. – 1945 г.", "кадр", "265,0"],
  ["8.5.3", "— 1946 г. – XXI в.", "кадр", "221,0"],
];

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang) || !["gov", "paid"].includes(slug)) return {};
  const d = dict(lang);
  return { title: slug === "gov" ? d.tiles.gov : d.tiles.paid };
}

export default async function Service({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLang(lang) || !["gov", "paid"].includes(slug)) notFound();
  const d = dict(lang);
  const crumbs = [{ href: `/${lang}`, label: d.cat.home }, { label: slug === "gov" ? d.tiles.gov : d.tiles.paid }];
  const ext = (href: string, label: string, primary = false) => (
    <a className={primary ? "btn" : "btn sec"} href={href} target="_blank" rel="noopener"><Icon name="globe" size={20} /> {label}<span className="sr"> ({d.externalSite})</span></a>
  );

  return (
    <div className="wrap svc" lang="ru">
      <Crumbs items={crumbs} />
      {lang !== "ru" ? <p className="notice" style={{ marginBottom: 16 }}><Icon name="globe" size={20} /> {d.notVerifiedTranslation}</p> : null}
      <p className="notice" style={{ marginBottom: 24 }}><Icon name="help" size={20} /> Сайт информационный: заявления, запросы и оплата здесь не принимаются. Подать запрос можно только на официальных ресурсах.</p>

      {slug === "gov" ? (
        <>
          <h1>Государственная услуга</h1>
          <h2 className="h3" style={{ marginTop: 16 }}>«Выдача архивных справок, копий архивных документов или архивных выписок»</h2>
          <p className="muted" style={{ marginTop: 8 }}>Справки о стаже, заработной плате, подтверждение других сведений социально-правового характера.</p>
          <div className="acts-row" style={{ margin: "24px 0" }}>{ext(EGOV, "Подать запрос на eGov.kz", true)}{ext("https://eotinish.kz", "e-Otinish")}</div>
          <dl className="card meta" style={{ maxWidth: 1000 }}>
            <div><dt>Срок</dt><dd>11 рабочих дней</dd></div>
            <div><dt>Стоимость</dt><dd>Бесплатно</dd></div>
            <div><dt>Где подать</dt><dd>Портал eGov.kz (с ЭЦП), ЦОН (Государственная корпорация «Правительство для граждан») или канцелярия архива</dd></div>
            <div><dt>Документы</dt><dd>На портале — запрос, подписанный ЭЦП. В ЦОН — удостоверение личности (представителю — доверенность). В канцелярии архива — заявление по форме и удостоверение личности</dd></div>
            <div><dt>Результат</dt><dd>Архивная справка, копия архивного документа или выписка либо мотивированный отказ. При подаче через портал — в личный кабинет</dd></div>
            <div><dt>Если документов нет</dt><dd>Архив сообщает, куда обратиться</dd></div>
          </dl>
          <h2 className="h3" style={{ margin: "32px 0 12px" }}>Как подать через портал</h2>
          <ol className="card steps">
            <li>Войдите на eGov.kz с ЭЦП.</li>
            <li>Откройте раздел «Культура, архивы и документация» и выберите услугу «Выдача архивных справок…».</li>
            <li>Нажмите «Заказать услугу онлайн», заполните сведения и выберите архив.</li>
            <li>Приложите сканы документов, проверьте данные, подпишите ЭЦП и отправьте.</li>
          </ol>
          <h2 className="h3" style={{ margin: "32px 0 12px" }}>Нормативные документы</h2>
          <ul className="card names" style={{ padding: "4px 24px", maxWidth: 1000 }}>
            <li><span>Закон РК «О государственных услугах» от 15.04.2013</span></li>
            <li><span>Правила оказания государственных услуг в области архивного дела — приказ Министра культуры и спорта РК от 29.05.2020 № 159</span></li>
            <li><span>Закон РК «О Национальном архивном фонде и архивах» от 22.12.1998 № 326-I</span></li>
          </ul>
          <p className="small muted" style={{ marginTop: 12 }}>Сроки и порядок — по Правилам в редакции, опубликованной на прежнем сайте архива. Действующую редакцию проверяйте в ИПС «Әділет».</p>
          <div className="acts-row" style={{ marginTop: 16 }}>{ext("https://adilet.zan.kz", "ИПС «Әділет»")}<a className="btn sec" href="tel:+77232255976"><Icon name="phone" size={20} /> 8 (7232) 25-59-76</a></div>
        </>
      ) : (
        <>
          <h1>Платные услуги</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>Цены утверждены постановлением Восточно-Казахстанского областного акимата № 289 от 15 декабря 2023 года «Об утверждении прейскуранта цен на товары (работы, услуги), реализуемые государственными архивами управления цифровизации и архивов Восточно-Казахстанской области». Ниже — услуги, которые чаще нужны посетителям. Полный прейскурант — в постановлении.</p>
          <div className="acts-row" style={{ margin: "24px 0" }}>
            <a className="btn" href="/docs/postanovlenie-289-2023-prejskurant-ru.pdf" target="_blank" rel="noopener"><Icon name="doc" size={20} /> Постановление и прейскурант (рус, PDF)</a>
            <a className="btn sec" href="/docs/postanovlenie-289-2023-prejskurant-kk.pdf" target="_blank" rel="noopener"><Icon name="doc" size={20} /> Қаулы (қаз, PDF)</a>
          </div>
          <div className="card price-wrap">
            <table className="price">
              <caption className="sr">Цены, тенге</caption>
              <thead><tr><th>№</th><th>Услуга</th><th>Единица</th><th>Цена, тенге</th></tr></thead>
              <tbody>{PRICES.map(([i, n, u, p]) => <tr key={i}><td>{i}</td><td>{n}</td><td>{u}</td><td className="num">{p}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Цены копий указаны для формата А4; для А3 — в 2 раза больше, для А2 — в 3 раза. Таблица набрана по скану постановления; при расхождении действует оригинал.</p>
          <p className="notice" style={{ marginTop: 16 }}><Icon name="help" size={20} /> Заказать платную услугу на сайте нельзя. Обратитесь в архив: 8 (7232) 25-59-76, arhiv-ukg@yandex.kz.</p>
        </>
      )}
      <p style={{ marginTop: 32 }}><Link href={`/${lang}/services/${slug === "gov" ? "paid" : "gov"}`}>{slug === "gov" ? d.tiles.paid : d.tiles.gov} →</Link></p>
    </div>
  );
}
