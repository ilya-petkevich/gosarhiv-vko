// Роли из ТЗ 6.1. Права можно перенастроить в админке (уровни доступа настраиваемые).

export const PERMISSIONS = [
  { code: "users.manage", description: "Управление пользователями и ролями" },
  { code: "settings.manage", description: "Системные настройки и интеграции" },
  { code: "structure.manage", description: "Структура сайта и меню" },
  { code: "i18n.manage", description: "Языковые версии" },
  { code: "pages.edit", description: "Информационные страницы" },
  { code: "content.create", description: "Создание материалов (черновик)" },
  { code: "content.edit", description: "Редактирование материалов" },
  { code: "content.review", description: "Проверка и согласование материалов" },
  { code: "content.publish", description: "Публикация и снятие с публикации" },
  { code: "news.edit", description: "Новости и события" },
  { code: "exhibitions.edit", description: "Онлайн-выставки" },
  { code: "memory.edit", description: "«Большой архив памяти»: подборки, личности, события" },
  { code: "catalog.edit", description: "Электронный каталог: фонды, описи, дела, документы" },
  { code: "catalog.delete", description: "Удаление ошибочных записей каталога" },
  { code: "catalog.import", description: "Импорт из Excel / CSV" },
  { code: "catalog.export", description: "Экспорт разрешённых данных" },
  { code: "files.upload", description: "Загрузка цифровых копий" },
  { code: "files.access_closed", description: "Просмотр файлов с ограниченным доступом" },
  { code: "branches.edit_all", description: "Все филиалы" },
  { code: "branches.edit_own", description: "Только свой филиал" },
  { code: "analytics.view", description: "Статистика и отчёты" },
  { code: "audit.view", description: "Журнал действий" },
] as const;

type Perm = (typeof PERMISSIONS)[number]["code"];

export const ROLES = [
  { code: "chief_admin", name: { ru: "Главный администратор", kk: "Бас әкімші", en: "Chief administrator" }, description: { ru: "Полный доступ ко всем модулям и настройкам" } },
  { code: "site_admin", name: { ru: "Администратор сайта", kk: "Сайт әкімшісі", en: "Site administrator" }, description: { ru: "Страницы, пользователи, настройки контента" } },
  { code: "editor", name: { ru: "Редактор", kk: "Редактор", en: "Editor" }, description: { ru: "Создание, редактирование и публикация материалов" } },
  { code: "archivist", name: { ru: "Сотрудник архива", kk: "Архив қызметкері", en: "Archivist" }, description: { ru: "Электронный каталог и архивные материалы" } },
  { code: "branch_admin", name: { ru: "Администратор филиала", kk: "Филиал әкімшісі", en: "Branch administrator" }, description: { ru: "Сведения своего филиала" } },
  { code: "moderator", name: { ru: "Модератор", kk: "Модератор", en: "Moderator" }, description: { ru: "Проверка и согласование перед публикацией" } },
  { code: "analyst", name: { ru: "Аналитик", kk: "Талдаушы", en: "Analyst" }, description: { ru: "Статистика и аналитические отчёты" } },
];

const ALL = PERMISSIONS.map((p) => p.code);

export const ROLE_PERMISSIONS: Record<string, Perm[]> = {
  chief_admin: [...ALL],
  site_admin: ["users.manage", "structure.manage", "i18n.manage", "pages.edit", "content.create", "content.edit", "news.edit", "audit.view"],
  editor: ["pages.edit", "content.create", "content.edit", "content.review", "content.publish", "news.edit", "exhibitions.edit", "memory.edit"],
  archivist: ["catalog.edit", "catalog.import", "catalog.export", "files.upload", "files.access_closed", "content.create", "exhibitions.edit", "memory.edit"],
  branch_admin: ["branches.edit_own", "content.create", "news.edit"],
  moderator: ["content.review", "content.publish"],
  analyst: ["analytics.view"],
};

// Тестовые сотрудники для демонстрации. Пароль общий, из DEMO_PASSWORD.
export const DEMO_USERS: { login: string; full_name: string; role: string; branch?: string }[] = [
  { login: "admin", full_name: "Демо: главный администратор", role: "chief_admin" },
  { login: "siteadmin", full_name: "Демо: администратор сайта", role: "site_admin" },
  { login: "editor", full_name: "Демо: редактор", role: "editor" },
  { login: "archivist", full_name: "Демо: сотрудник архива", role: "archivist" },
  { login: "ridder", full_name: "Демо: администратор Риддерского филиала", role: "branch_admin", branch: "ridder" },
  { login: "moderator", full_name: "Демо: модератор", role: "moderator" },
  { login: "analyst", full_name: "Демо: аналитик", role: "analyst" },
];
