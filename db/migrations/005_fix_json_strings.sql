-- Исправление: при загрузке через драйвер PostgreSQL история названий фондов сохранилась
-- как JSON-строка вместо массива. Превращаем такие значения обратно в массив. Повторный запуск ничего не меняет.
update funds set names = (names #>> '{}')::jsonb where jsonb_typeof(names) = 'string';
update import_jobs set columns = (columns #>> '{}')::jsonb where jsonb_typeof(columns) = 'string';
update import_jobs set rows = (rows #>> '{}')::jsonb where jsonb_typeof(rows) = 'string';
update import_jobs set errors = (errors #>> '{}')::jsonb where jsonb_typeof(errors) = 'string';
