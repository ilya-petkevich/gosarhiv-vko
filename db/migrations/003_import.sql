-- Пакетный импорт (доп. ТЗ 3.5): исходные строки, сопоставление полей, созданные записи — для отката.

alter table import_jobs
  add column fund_id     bigint references funds(id),
  add column columns     jsonb not null default '[]',
  add column rows        jsonb not null default '[]',
  add column created_ids bigint[] not null default '{}',
  add column finished_at timestamptz;

alter table documents add column import_job_id bigint references import_jobs(id) on delete set null;
create index documents_cipher_idx on documents (lower(cipher));
