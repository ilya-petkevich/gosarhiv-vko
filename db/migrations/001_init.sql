-- Госархив ВКО: исходная схема.
-- Сущности по ТЗ, раздел 11, и дополнениям 3.1–3.6.
-- Многоязычные поля хранятся в jsonb: {"ru": "...", "kk": "...", "en": "..."}.
-- Статус перевода хранится в i18n_status: {"kk": "verified|machine|none", "en": "..."}.

create extension if not exists pg_trgm;

-- ---------- Роли, права, пользователи ----------

create table roles (
  code        text primary key,
  name        jsonb not null,
  description jsonb,
  sort        int not null default 0
);

create table permissions (
  code        text primary key,
  description text not null
);

create table role_permissions (
  role_code text not null references roles(code) on delete cascade,
  perm_code text not null references permissions(code) on delete cascade,
  primary key (role_code, perm_code)
);

create table branches (
  id             serial primary key,
  slug           text not null unique,
  name           jsonb not null,
  short_name     jsonb,
  address        jsonb not null,
  phone          text,
  email          text,
  hours          jsonb,
  lat            double precision,
  lng            double precision,
  -- координаты и адрес подтверждает архив (доп. ТЗ 3.3); до подтверждения показываем пометку
  coords_verified boolean not null default false,
  is_main        boolean not null default false,
  is_visible     boolean not null default true,
  description    jsonb,
  photo_file_id  bigint,
  data_source    text,
  sort           int not null default 0,
  updated_at     timestamptz not null default now()
);

create table users (
  id               uuid primary key default gen_random_uuid(),
  login            text not null unique,
  full_name        text not null,
  password_hash    text not null,
  is_active        boolean not null default true,
  -- администратор филиала работает только со своим филиалом (доп. ТЗ 3.5)
  branch_id        int references branches(id),
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz
);

create table user_roles (
  user_id   uuid not null references users(id) on delete cascade,
  role_code text not null references roles(code) on delete cascade,
  primary key (user_id, role_code)
);

-- в базе хранится только хэш токена сессии
create table sessions (
  id           text primary key,
  user_id      uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           text,
  user_agent   text
);
create index sessions_user_idx on sessions(user_id);

-- ---------- Справочники ----------

create table categories (
  id        serial primary key,
  kind      text not null,            -- catalog | memory | exhibition | news
  slug      text not null,
  name      jsonb not null,
  parent_id int references categories(id),
  sort      int not null default 0,
  unique (kind, slug)
);

create table tags (
  id   serial primary key,
  slug text not null unique,
  name jsonb not null
);

-- ---------- Файлы ----------
-- мастер-копия и облегчённая копия для просмотра связаны через master_id (доп. ТЗ 3.6)

create table digital_files (
  id            bigserial primary key,
  master_id     bigint references digital_files(id) on delete cascade,
  kind          text not null default 'master' check (kind in ('master', 'preview', 'thumb')),
  storage_key   text not null unique,
  original_name text,
  mime          text not null,
  size_bytes    bigint not null,
  sha256        text not null,
  width         int,
  height        int,
  -- если право на публикацию не определено, файл закрыт (доп. ТЗ 3.1)
  access        text not null default 'needs_check'
                check (access in ('public', 'no_publish', 'needs_check')),
  provenance    text,
  rights_note   text,
  is_demo       boolean not null default false,
  uploaded_by   uuid references users(id),
  uploaded_at   timestamptz not null default now()
);

-- ---------- Общие поля для материалов, проходящих согласование ----------
-- status: draft → review → rework / approved → published → archived (ТЗ 6.7)

-- ---------- Электронный каталог: фонд → опись → дело → документ ----------

create table funds (
  id             bigserial primary key,
  branch_id      int references branches(id),
  fund_number    text not null,
  kind           text not null default 'organization' check (kind in ('organization', 'personal')),
  title          jsonb not null,
  annotation     jsonb,
  year_from      int,
  year_to        int,
  cases_count    int,
  publish_status text not null default 'needs_check' check (publish_status in ('public', 'no_publish', 'needs_check')),
  status         text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo        boolean not null default false,
  created_by     uuid references users(id),
  updated_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        int not null default 1,
  unique (branch_id, fund_number)
);

create table inventories (
  id             bigserial primary key,
  fund_id        bigint not null references funds(id) on delete restrict,
  number         text not null,
  title          jsonb not null,
  year_from      int,
  year_to        int,
  publish_status text not null default 'needs_check' check (publish_status in ('public', 'no_publish', 'needs_check')),
  status         text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (fund_id, number)
);

create table cases (
  id             bigserial primary key,
  inventory_id   bigint not null references inventories(id) on delete restrict,
  number         text not null,
  title          jsonb not null,
  date_text      text,
  year_from      int,
  year_to        int,
  sheets         int,
  publish_status text not null default 'needs_check' check (publish_status in ('public', 'no_publish', 'needs_check')),
  status         text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (inventory_id, number)
);

create table documents (
  id             bigserial primary key,
  -- устойчивый идентификатор не зависит от названия, шифр хранится отдельно (доп. ТЗ 3.1)
  uid            uuid not null unique default gen_random_uuid(),
  fund_id        bigint not null references funds(id) on delete restrict,
  case_id        bigint references cases(id) on delete restrict,
  branch_id      int references branches(id),
  cipher         text,
  title          jsonb not null,
  description    jsonb,
  doc_type       text not null default 'document'
                 check (doc_type in ('document', 'photo', 'map', 'newspaper', 'audio', 'video', 'metric_book', 'other')),
  category_id    int references categories(id),
  date_text      text,
  year_from      int,
  year_to        int,
  date_uncertain boolean not null default false,
  author         text,
  place          text,
  provenance     text,
  i18n_status    jsonb not null default '{}',
  -- статус публикации описания отделён от доступа к файлу (доп. ТЗ 3.1)
  publish_status text not null default 'needs_check' check (publish_status in ('public', 'no_publish', 'needs_check')),
  status         text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo        boolean not null default false,
  created_by     uuid references users(id),
  updated_by     uuid references users(id),
  approved_by    uuid references users(id),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        int not null default 1,
  -- полнотекстовый индекс только для опубликованных открытых записей (доп. ТЗ 3.1)
  search_vector  tsvector generated always as (
    case when publish_status = 'public' and status = 'published' then
      setweight(to_tsvector('russian', coalesce(title->>'ru', '')), 'A') ||
      setweight(to_tsvector('simple',  coalesce(title->>'kk', '') || ' ' || coalesce(title->>'en', '')), 'A') ||
      setweight(to_tsvector('simple',  coalesce(cipher, '')), 'A') ||
      setweight(to_tsvector('russian', coalesce(description->>'ru', '') || ' ' || coalesce(place, '') || ' ' || coalesce(author, '')), 'B') ||
      setweight(to_tsvector('simple',  coalesce(description->>'kk', '') || ' ' || coalesce(description->>'en', '')), 'B')
    end
  ) stored
);
create index documents_search_idx on documents using gin (search_vector);
create index documents_title_trgm_idx on documents using gin ((title->>'ru') gin_trgm_ops);
create index documents_years_idx on documents (year_from, year_to);

create table document_files (
  document_id bigint not null references documents(id) on delete cascade,
  file_id     bigint not null references digital_files(id) on delete restrict,
  sort        int not null default 0,
  primary key (document_id, file_id)
);

create table document_tags (
  document_id bigint not null references documents(id) on delete cascade,
  tag_id      int not null references tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

-- ---------- «Большой архив памяти»: личности, события, подборки ----------

create table persons (
  id          bigserial primary key,
  slug        text not null unique,
  name        jsonb not null,
  years       text,
  biography   jsonb,
  sources     text,
  status      text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table historical_events (
  id            bigserial primary key,
  slug          text not null unique,
  title         jsonb not null,
  description   jsonb,
  date_text     text,
  year          int,
  date_uncertain boolean not null default false,
  place         text,
  lat           double precision,
  lng           double precision,
  category_id   int references categories(id),
  sources       text,
  status        text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table collections (
  id           bigserial primary key,
  slug         text not null unique,
  title        jsonb not null,
  summary      jsonb,
  -- редакционные пояснения отделены от фактов с источником (доп. ТЗ 3.2)
  editorial_note jsonb,
  cover_file_id bigint references digital_files(id),
  category_id  int references categories(id),
  status       text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo      boolean not null default false,
  created_by   uuid references users(id),
  approved_by  uuid references users(id),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      int not null default 1
);

create table collection_items (
  id            bigserial primary key,
  collection_id bigint not null references collections(id) on delete cascade,
  item_type     text not null check (item_type in ('document', 'person', 'event', 'text')),
  item_id       bigint,
  body          jsonb,
  source        text,
  sort          int not null default 0
);

-- ---------- Онлайн-выставки ----------

create table exhibitions (
  id           bigserial primary key,
  slug         text not null unique,
  title        jsonb not null,
  description  jsonb,
  cover_file_id bigint references digital_files(id),
  category_id  int references categories(id),
  status       text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo      boolean not null default false,
  created_by   uuid references users(id),
  approved_by  uuid references users(id),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      int not null default 1
);

create table exhibits (
  id            bigserial primary key,
  exhibition_id bigint not null references exhibitions(id) on delete cascade,
  title         jsonb not null,
  caption       jsonb,
  -- источник указывается прямо в карточке экспоната (доп. ТЗ 3.2)
  source        text not null,
  document_id   bigint references documents(id),
  file_id       bigint references digital_files(id),
  rights_checked boolean not null default false,
  sort          int not null default 0
);

-- ---------- Новости, страницы, календарь ----------

create table news (
  id           bigserial primary key,
  slug         text not null unique,
  title        jsonb not null,
  summary      jsonb,
  body         jsonb,
  category_id  int references categories(id),
  branch_id    int references branches(id),
  cover_file_id bigint references digital_files(id),
  status       text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  is_demo      boolean not null default false,
  created_by   uuid references users(id),
  approved_by  uuid references users(id),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      int not null default 1
);

create table pages (
  id          bigserial primary key,
  slug        text not null unique,
  section     text not null,
  title       jsonb not null,
  body        jsonb,
  seo         jsonb,
  source      text,
  i18n_status jsonb not null default '{}',
  status      text not null default 'draft' check (status in ('draft', 'review', 'rework', 'approved', 'published', 'archived')),
  sort        int not null default 0,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now(),
  version     int not null default 1
);

create table memorable_dates (
  id        bigserial primary key,
  year      int not null,
  day_text  jsonb not null,
  month     int,
  day       int,
  text      jsonb not null,
  source    text
);

-- ---------- Согласование, версии, журнал ----------

create table content_versions (
  id          bigserial primary key,
  entity_type text not null,
  entity_id   bigint not null,
  version     int not null,
  data        jsonb not null,
  author_id   uuid references users(id),
  created_at  timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);

create table workflow_transitions (
  id          bigserial primary key,
  entity_type text not null,
  entity_id   bigint not null,
  from_status text,
  to_status   text not null,
  actor_id    uuid references users(id),
  comment     text,
  at          timestamptz not null default now()
);
create index workflow_entity_idx on workflow_transitions(entity_type, entity_id);

create table notifications (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  text       text not null,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- в журнал не пишутся пароли и секреты (доп. ТЗ 3.5)
create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid references users(id) on delete set null,
  user_login  text,
  action      text not null,
  object_type text,
  object_id   text,
  result      text not null check (result in ('ok', 'denied', 'error')),
  details     jsonb,
  ip          text
);
create index audit_log_at_idx on audit_log(at desc);

create table import_jobs (
  id          bigserial primary key,
  kind        text not null,
  filename    text not null,
  status      text not null default 'preview' check (status in ('preview', 'running', 'done', 'failed', 'rolled_back')),
  mapping     jsonb,
  total_rows  int not null default 0,
  ok_rows     int not null default 0,
  failed_rows int not null default 0,
  errors      jsonb not null default '[]',
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- ---------- Аналитика без персональных данных (ТЗ 5.8 Д) ----------

create table page_events (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  path       text not null,
  lang       text,
  event      text not null,
  value      text
);

create table site_settings (
  key   text primary key,
  value jsonb not null
);
