// Проверка разбора XLSX и автосопоставления колонок (без базы): npx tsx scripts/tests/import-parse.test.mts
import writeXlsxFile from "write-excel-file/node";
import { parseFile, guessMapping } from "../../src/lib/importer";
const H = (v: string) => ({ value: v, fontWeight: "bold" as const });
const data = [
  [H("Архивный шифр"), H("Заголовок дела"), H("Крайние даты"), H("Год начала"), H("Вид документа")],
  [{ value: "ДЕМО-2, оп. 5, д. 1" }, { value: "Отчёт о работе типографии" }, { value: "1958–1959" }, { value: 1958 }, { value: "Документ" }],
  [{ value: "ДЕМО-2, оп. 5, д. 2" }, { value: "Фотоальбом выпускников" }, { value: "1965" }, { value: 1965 }, { value: "фото" }],
];
const buf = await writeXlsxFile(data as never).toBuffer();
const p = await parseFile("test.xlsx", Buffer.from(buf));
if ("error" in p) { console.log("ERR", p.error); process.exit(1); }
console.log(p.columns, p.rows, guessMapping(p.columns));
console.log(await parseFile("fake.xlsx", Buffer.from("not a zip at all, plain text")));
process.exit(0);
