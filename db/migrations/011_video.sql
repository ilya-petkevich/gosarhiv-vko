-- Видео в новостях (ТЗ 5.11): ссылка на ролик на видеохостинге
alter table news add column if not exists video_url text;
