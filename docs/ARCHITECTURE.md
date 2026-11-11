# Архитектура

## Схема

```
 Посетитель (браузер, телефон)            Сотрудник архива
        │  HTTPS                                │  HTTPS, вход по паролю
        ▼                                       ▼
 ┌──────────────────────────────────────────────────────────┐
 │  Next.js 15 (React, TypeScript) — сайт /kk /ru /en        │
 │  ├─ страницы: каталог, карточки, выставки, летопись, …     │
 │  ├─ /api/catalog — поиск   ├─ /api/files/<id> — копии     │
 │  ├─ /api/assistant — Ахмет ├─ /admin — серверные действия │
 │  └─ все правила доступа — на сервере (src/lib/catalog.ts,  │
 │     src/lib/workflow.ts, src/lib/auth.ts)                  │
 └──────┬──────────────────┬───────────────────┬─────────────┘
        │ SQL               │ HTTPS             │ HTTPS
        ▼                   ▼                   ▼
   PostgreSQL 16+     Хранилище файлов     Языковая модель
   (полнотекстовый    (диск или            (OpenRouter → DeepSeek
    поиск, pg_trgm)    Supabase Storage)     или Anthropic)
```

Демо-стенд: Vercel (регион Дублин) + Supabase (Ирландия). Локально: PGlite (тот же PostgreSQL в WebAssembly) и папка `.data/`.
Боевая версия: `docker compose` на сервере в РК — код тот же, меняются переменные окружения ([DEPLOY.md](DEPLOY.md)).

## Модули

| Модуль | Где в коде | Что делает |
|---|---|---|
| Общий каркас | `src/app/[lang]/layout.tsx`, `src/components/Chrome.tsx`, `src/i18n/` | три языка, темы, шапка и подвал, доступность |
| Каталог | `src/lib/catalog.ts`, `src/app/[lang]/catalog/` | поиск (морфология, варианты написания, период и вид из запроса, похожее написание), фильтры, карточки фонда и документа |
| Файлы | `src/lib/files.ts`, `src/lib/storage.ts`, `src/app/api/files/` | проверка формата по содержимому, мастер-копия + облегчённая WebP, выдача только открытых |
| Помощник «Ахмет» | `src/lib/akhmet.ts`, `src/app/api/assistant/` | модель ищет по каталогу через инструмент, источники только из найденного, закрытые вопросы — без модели, запасной режим |
| Карта и филиалы | `src/components/BranchesMap.tsx` | OpenStreetMap, ближайший филиал в браузере, маршрут во внешних сервисах |
| Выставки и летопись | `src/lib/showcase.ts` | выставки, подборки, хронология |
| Новости, страницы, календарь | `src/lib/content.ts`, `src/components/Md.tsx` | безопасная разметка без HTML |
| Админка | `src/app/admin/`, `src/lib/auth.ts`, `src/lib/workflow.ts` | вход, роли и права, согласование, версии, журнал |
| Импорт и выгрузка | `src/lib/importer.ts`, `src/app/admin/import/`, `src/app/admin/export/` | CSV/XLSX с сопоставлением, проверкой и откатом; выгрузка разрешённого |
| Миграции и данные | `db/migrations/`, `db/seed/`, `scripts/` | схема, начальные данные, конвертеры из материалов архива |

## Структура данных

Таблицы (`db/migrations/001–005`): `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions` —
сотрудники и права; `branches` — архив и филиалы; `funds` → `inventories` → `cases` → `documents` — иерархия каталога
(у документа устойчивый `uid`, шифр отдельно); `digital_files` (мастер и облегчённая копия, SHA-256, доступ) + `document_files`;
`collections` + `collection_items`, `persons`, `historical_events` — «Большой архив памяти»; `exhibitions` + `exhibits`;
`news`, `pages`, `categories`, `tags`; `content_versions`, `workflow_transitions`, `notifications`, `audit_log`, `import_jobs`;
`page_events` — аналитика без персональных данных; `site_settings`.

Многоязычные поля — `jsonb` вида `{"ru": …, "kk": …, "en": …}`, статус перевода — `i18n_status`.
Доступ к описанию (`publish_status`) и к файлу (`digital_files.access`) задаются отдельно; статус согласования — `status`.
Полнотекстовый индекс (`search_vector`) строится только для опубликованных открытых записей — закрытое в поиск не попадает физически.

## Безопасность (ТЗ 7.3)

- HTTPS; заголовки `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Пароли — bcrypt; в базе только SHA-256 токена сессии; cookie httpOnly, SameSite=Lax, Secure.
- Блокировка на 15 минут после 5 ошибок входа; выход через 30 минут бездействия, не позже 8 часов.
- Права проверяются на сервере в каждом действии и для объекта; серверные действия Next.js принимают запросы только со своего сайта.
- Только параметризованные SQL-запросы; тексты выводятся без HTML (React экранирует), разметка страниц — свой безопасный разборщик.
- Файлы: тип по сигнатуре, лимит размера, закрыты по умолчанию; SVG отдаются с CSP sandbox.
- Журнал действий без паролей и секретов; ночной зашифрованный бэкап базы (GitHub Actions).
- Помощник: вырезание ИИН, телефонов, почты; вопросы не сохраняются; лимиты по IP (хэш в памяти) и в сутки.

## Библиотеки и лицензии

| Библиотека | Версия | Лицензия | Где |
|---|---|---|---|
| @anthropic-ai/sdk | 1.8.0 | Apache-2.0 | сайт |
| @electric-sql/pglite | 0.5.16 | Apache-2.0 | сайт |
| bcryptjs | 3.0.3 | BSD-3-Clause | сайт |
| leaflet | 1.9.4 | BSD-2-Clause | сайт |
| next | 15.5.29 | MIT | сайт |
| papaparse | 5.7.0 | MIT | сайт |
| postgres | 4.1.0 | Unlicense | сайт |
| react | 19.1.0 | MIT | сайт |
| react-dom | 19.1.0 | MIT | сайт |
| read-excel-file | 9.3.14 | MIT | сайт |
| sharp | 0.35.5 | Apache-2.0 | сайт |
| @eslint/eslintrc | 3.3.7 | MIT | разработка |
| @types/bcryptjs | 2.4.6 | MIT | разработка |
| @types/leaflet | 1.9.22 | MIT | разработка |
| @types/node | 20.19.43 | MIT | разработка |
| @types/papaparse | 5.5.2 | MIT | разработка |
| @types/react | 19.3.0 | MIT | разработка |
| @types/react-dom | 19.3.0 | MIT | разработка |
| eslint | 9.39.5 | MIT | разработка |
| eslint-config-next | 15.5.29 | MIT | разработка |
| tsx | 4.23.15 | MIT | разработка |
| typescript | 5.9.3 | Apache-2.0 | разработка |
| write-excel-file | 4.1.1 | MIT | разработка |

Во всей цепочке зависимостей (production): MIT, Apache-2.0, ISC, BSD, 0BSD, Unlicense, CC-BY-4.0 (данные caniuse-lite)
и LGPL-3.0-or-later — библиотека обработки изображений libvips внутри `sharp`, подключается динамически.
Шрифты Onest и Literata — SIL Open Font License (Google Fonts). Карта — данные © участники OpenStreetMap (ODbL), подпись на карте есть.
