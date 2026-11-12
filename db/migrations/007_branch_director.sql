-- Директор архива и каждого филиала (замечание заказчика 12.11: «люди пишут запросы с сайта»).
-- Источник: «Структура.docx» и столбец «Директор» в «Адреса и контакты филиалов.xls». Правка в админке не перезаписывается.
alter table branches add column if not exists director text;
update branches set director = 'Жапаров Аскар Кенжебаевич' where slug = 'main' and director is null;
update branches set director = 'Бисенова Гулсим Алдабергеновна' where slug = 'ust-kamenogorsk-personnel' and director is null;
update branches set director = 'Сарсембинова Шынар Жасулановна' where slug = 'ridder' and director is null;
update branches set director = 'Сейлханов Сабырбек Какенович' where slug = 'altai' and director is null;
update branches set director = 'Төлеу Бақдәулет Ибрахымұлы' where slug = 'glubokoe' and director is null;
update branches set director = 'Козлов Виктор Николаевич' where slug = 'zaisan' and director is null;
update branches set director = 'Зияшева Асель Тлеухановна' where slug = 'katon-karagai' and director is null;
update branches set director = 'Кабдуалиева Сандугаш Алтаевна' where slug = 'kurchum' and director is null;
update branches set director = 'Смагулов Самат Нурлыбекович' where slug = 'markakol' and director is null;
update branches set director = 'Бабатаев Айдар Шамилевич' where slug = 'samar' and director is null;
update branches set director = 'Журекбаев Бауыржан Сеитказинович' where slug = 'tarbagatai' and director is null;
update branches set director = 'Абдрасулин Аслан Оралович' where slug = 'ulan' and director is null;
update branches set director = 'Оженов Бауржан Файзоллинович' where slug = 'ulken-naryn' and director is null;
update branches set director = 'Кусатаев Нуржан Тельманович' where slug = 'shemonaikha' and director is null;
