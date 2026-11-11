# Выкладка демо-стенда: GitHub + Vercel + Supabase

Демо-стенд: **https://gosarhiv-vko.vercel.app** (закрыт от поисковиков, `SITE_NOINDEX=1`). Админка — `/admin`.

Код — в GitHub, сайт — на Vercel, база и файлы — в Supabase, помощник «Ахмет» — через OpenRouter.
Все сервисы на бесплатных тарифах; платно только обращения к модели (около $0,001 за вопрос, лимит — `AI_DAILY_LIMIT`).

## 1. Supabase

1. Создайте проект (регион поближе — например, Central EU / Frankfurt). Пароль базы сохраните.
2. **Project Settings → Database → Connection string**:
   - *Transaction pooler* (порт 6543) — это `DATABASE_URL` для Vercel;
   - *Session pooler* (порт 5432) — для первичной загрузки данных и бэкапов.
3. **Project Settings → API**: `Project URL` — это `SUPABASE_URL`, ключ `service_role` — `SUPABASE_SERVICE_KEY`.
   Ключ `service_role` даёт полный доступ: хранится только в переменных окружения, в код и в браузер не попадает.

Бакет для файлов (`archive-files`, закрытый) создаётся автоматически.

## 2. Первичная загрузка данных (с компьютера разработчика)

Создайте файл `.env.supabase` (он не попадает в git) и выполните:

```bash
set -a; . ./.env.supabase; set +a; npx tsx scripts/setup.ts
```

Содержимое `.env.supabase`:

```
DATABASE_URL=<Session pooler, порт 5432>
SUPABASE_URL=https://<проект>.supabase.co
SUPABASE_SERVICE_KEY=<service_role>
DEMO_PASSWORD=<длинный случайный пароль тестовых сотрудников>
```

Если сеть компьютера не пропускает протокол PostgreSQL (соединение устанавливается, но ответа нет), загрузите данные с серверов GitHub: задайте секреты `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEMO_PASSWORD` и запустите вручную workflow **«Загрузка данных в базу»** (`setup-db.yml`). Так был загружен текущий стенд.

Скрипт создаёт таблицы, загружает 1705 фондов, демо-каталог с изображениями (в Supabase Storage), хронологию, выставки,
страницы и тестовых сотрудников. Повторный запуск безопасен.

> На публичном стенде пароль тестовых сотрудников **не** `demo-gavko-2026` из `.env.example`: тот виден всем в репозитории.
> Логины и пароль передаются комиссии отдельно.

## 3. Vercel

1. **Add New → Project → Import** репозитория из GitHub. Фреймворк определится сам (Next.js).
2. **Environment Variables**:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | Transaction pooler Supabase (порт 6543) |
| `SUPABASE_URL` | URL проекта |
| `SUPABASE_SERVICE_KEY` | ключ `service_role` |
| `OPENROUTER_API_KEY` | ключ OpenRouter (без него помощник отвечает по шаблону с пометкой «демо») |
| `AI_DAILY_LIMIT` | например, `200` |
| `SITE_URL` | адрес стенда, например `https://gosarhiv-vko.vercel.app` |
| `SITE_NOINDEX` | `1` — демо-стенд закрыт от поисковиков |

3. **Deploy**. Каждая отправка в ветку `main` выкладывается автоматически, если автор коммита привязан к аккаунту Vercel; иначе Vercel пишет «Deployment was blocked», и выкладка — командой `npx vercel deploy --prod`.
4. Регион функций — Дублин (`vercel.json`), рядом с базой Supabase в Ирландии: иначе каждый запрос к базе пересекает океан.

Ограничение Vercel: тело запроса до 4,5 МБ, поэтому на стенде загрузка файла в админке — до 4 МБ.
Для настоящих сканов (TIFF десятки мегабайт) в боевой версии файл загружается напрямую в хранилище по подписанной ссылке.

## 4. GitHub

**Settings → Secrets and variables → Actions**:

| Секрет | Зачем |
|---|---|
| `SITE_URL` | ежедневный запрос к стенду, чтобы бесплатная база Supabase не засыпала (`keepalive.yml`) |
| `DATABASE_URL` | Session pooler — для ночного бэкапа (`backup.yml`) |
| `BACKUP_PASSPHRASE` | пароль шифрования бэкапа; дамп хранится в артефактах 14 дней только в зашифрованном виде |

Проверка кода (`ci.yml`) — типы, линтер, тест разбора импорта и сборка — запускается при каждой отправке.

## Переход к промышленной эксплуатации

Код не привязан к облакам: тот же сайт запускается `docker compose up` с PostgreSQL на сервере в Республике Казахстан.
Меняются только переменные окружения: `DATABASE_URL` — своя база, хранилище — диск сервера (`FILES_DIR`) или S3-совместимое,
модель помощника — `AKHMET_PROVIDER` / `AKHMET_MODEL` (например, модель на инфраструктуре в РК).
