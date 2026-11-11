-- Календарь памятных дат: месяц, день и годы календарей, где событие упомянуто.
alter table historical_events
  add column month int,
  add column day int,
  add column calendar_years int[] not null default '{}';

-- Новости: рубрика по слагу категорий kind = 'news'; связь с филиалом уже есть (branch_id).
create index news_published_idx on news (published_at desc) where status = 'published';
