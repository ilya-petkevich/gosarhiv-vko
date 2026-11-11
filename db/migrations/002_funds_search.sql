-- Сведения о фондах из перечня архива и поиск по фондам.

alter table funds
  add column names          jsonb not null default '[]',  -- история названий: [{dates, name}]
  add column names_text     text,
  add column units_text     text,                         -- объём как в учётной таблице, например «3618/34с»
  add column first_received date,
  add column ownership      text,
  add column fund_category  text,
  add column note           text,
  add column source         text;

-- только опубликованные открытые фонды (доп. ТЗ 3.1)
alter table funds add column search_vector tsvector generated always as (
  case when publish_status = 'public' and status = 'published' then
    setweight(to_tsvector('simple',  coalesce(fund_number, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(title->>'ru', '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(title->>'kk', '') || ' ' || coalesce(title->>'en', '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(names_text, '') || ' ' || coalesce(annotation->>'ru', '')), 'B')
  end
) stored;

create index funds_search_idx on funds using gin (search_vector);
create index funds_title_trgm_idx on funds using gin ((title->>'ru') gin_trgm_ops);
create index funds_number_idx on funds (fund_number);
create index documents_fund_idx on documents (fund_id);
