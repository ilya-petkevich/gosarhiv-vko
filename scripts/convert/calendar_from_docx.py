"""Хронология летописи из «Календарей юбилейных и памятных дат ВКО» 2022–2026 (материалы заказчика).

Запуск:  python3 scripts/convert/calendar_from_docx.py "<папка «Календарь памятных дат»>"
Результат: db/seed/data/chronicle-events.json

Из строки «130 лет (1896-1971) со дня рождения Ефима Николаевича Пермитина, писателя…» берётся год события (1896)
и текст «рождение Ефима Николаевича Пермитина, писателя…». Юбилейная часть («130 лет») отбрасывается.
Одно событие встречается в календарях разных лет — повторы склеиваются. Строки, где год не удаётся
определить однозначно, пропускаются (в отчёте). Казахские строки календаря не используются.
"""
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "db/seed/data/chronicle-events.json"

NOUNS = {
    "рождения": "рождение", "образования": "образование", "основания": "основание", "преобразования": "преобразование",
    "переименования": "переименование", "открытия": "открытие", "сооружения": "сооружение", "закрытия": "закрытие",
    "выборов": "выборы", "сдачи": "сдача", "обретения": "обретение", "создания": "создание", "начала": "начало",
    "окончания": "окончание", "присвоения": "присвоение", "строительства": "строительство", "пуска": "пуск",
    "проведения": "проведение", "введения": "введение", "организации": "организация", "освобождения": "освобождение",
    "принятия": "принятие", "подписания": "подписание", "образования,": "образование,", "ввода": "ввод", "выхода": "выход",
    "учреждения": "учреждение", "вступления": "вступление", "получения": "получение", "избрания": "избрание",
}
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()
MONTHS_NOM = "январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь".split()

THEMES = [  # порядок важен: первая подходящая тема
    ("people", "Люди", r"^(рождение|смерть|трагическая гибель|гибель)"),
    ("press", "Печать", r"газет|журнал|типограф"),
    ("industry", "Промышленность и стройки", r"гэс|завод|комбинат|рудник|станци|железн|плотин|фабрик|шахт|электр|телефон|мост"),
    ("culture", "Культура и образование", r"училищ|школ|библиотек|музе|театр|институт|университет|колледж|клуб|кинотеатр|архив"),
    ("power", "Власть и общество", r"совет|съезд|конференц|выбор|независимост|полигон|комитет|союз|ассамбле"),
    ("places", "Города и сёла", r"\bг\.|город|посёл|посел|район|уезд|област|основание|переименование|преобразование|села\b|аул"),
]


def paragraphs(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    for p in root.iter(f"{W}p"):
        t = "".join(x.text or "" for x in p.iter(f"{W}t"))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            yield t


def first_noun(w):
    if w in NOUNS:
        return NOUNS[w]
    if re.search(r"(ения|ания|тия|вия)$", w):  # «объединения» → «объединение»
        return w[:-1] + "е"
    return {"смерти": "смерть", "гибели": "гибель", "трагической": "трагическая"}.get(w, w)


def parse(text, cal_year):
    text = re.sub(r"^(\d+)(лет)", r"\1 \2", text)
    m = re.match(r"^\d+\s*(?:лет|год[а]?)?\s*\((\d{4})(?:\s*[-–]\s*\d{4})?\)\s*(?:лет|год[а]?)?\s*со дня\s+(.+)$", text)
    if not m:
        # «85 лет со дня …» без года в скобках: год события = год календаря − юбилей
        m2 = re.match(r"^(\d+)\s*(?:лет|год[а]?)\s*со дня\s+(.+)$", text)
        if not m2:
            return None
        year, rest = int(cal_year) - int(m2.group(1)), m2.group(2)
    else:
        year, rest = int(m.group(1)), m.group(2)
    words = rest.split(" ", 2)
    words[0] = first_noun(words[0])
    if words[0] == "трагическая" and len(words) > 1:
        words[1] = first_noun(words[1])
    body = " ".join(words)
    return year, body.strip().rstrip(".")


def theme(body):
    low = body.lower()
    for key, _, rx in THEMES:
        if re.search(rx, low):
            return key
    return "events"


def main(folder):
    events, skipped = {}, []
    for f in sorted(Path(folder).glob("календарь * год*.docx")):
        cal_year = re.search(r"(\d{4})", f.name).group(1)
        day = None
        for t in paragraphs(f):
            low = t.lower()
            dm = re.match(r"^(\d{1,2})\s+(" + "|".join(MONTHS) + r")$", low)
            if dm:
                day = (int(dm.group(1)), MONTHS.index(dm.group(2)) + 1)
                continue
            if low in MONTHS_NOM:
                day = (None, MONTHS_NOM.index(low) + 1)
                continue
            if re.match(r"^\d{4}\s*г\.?$", low):
                day = (None, None)
                continue
            if "со дня" not in low:
                continue
            r = parse(t, cal_year)
            if not r:
                skipped.append(f"{cal_year}: {t[:90]}")
                continue
            year, body = r
            key = (year, re.sub(r"[^а-яё0-9]", "", body.lower())[:80])
            if key in events:
                events[key]["sources"].add(cal_year)
                continue
            d, mth = day or (None, None)
            date_text = (f"{d} {MONTHS[mth - 1]} " if d else (f"{MONTHS_NOM[mth - 1]} " if mth else "")) + f"{year}"
            events[key] = {"year": year, "month": mth, "day": d, "date_text": date_text.strip(), "text": body[0].upper() + body[1:],
                           "theme": theme(body), "sources": {cal_year}}
    out = sorted(events.values(), key=lambda e: (e["year"], e["month"] or 13, e["day"] or 32))
    for e in out:
        e["sources"] = sorted(e["sources"])
    data = {"themes": [{"key": k, "label": l} for k, l, _ in THEMES] + [{"key": "events", "label": "События"}],
            "source": "Календари юбилейных и памятных дат Восточно-Казахстанской области на 2022–2026 годы (материалы архива)",
            "events": out}
    DST.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"событий: {len(out)}, пропущено строк: {len(skipped)} → {DST}")
    for s in skipped[:15]:
        print("  пропуск:", s)


if __name__ == "__main__":
    main(sys.argv[1])
