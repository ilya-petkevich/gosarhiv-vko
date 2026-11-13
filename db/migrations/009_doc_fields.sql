-- Карточка документа по ТЗ 5.3: язык документа, количество листов, историческая справка
alter table documents add column if not exists language text;
alter table documents add column if not exists sheets int;
alter table documents add column if not exists history_note jsonb;
