-- Страницы исторических личностей (ТЗ 5.6): строка для поиска связанных событий хронологии и записей каталога
alter table persons add column if not exists match text;
alter table persons add column if not exists sort int not null default 0;
