"""Перенос перечня фондов со старого сайта в JSON для начальных данных.

Источник — таблицы, опубликованные на e-arhiv.vko.gov.kz (ссылки даны в материалах заказчика «Фонды.docx»):
  «Фонды госархива ВКО на 2018 г.» и «Парт фонды госархива ВКО на 2018 г.» (.xlsb).

Запуск:  pip install pyxlsb && python3 scripts/convert/funds_from_xlsb.py <фонды.xlsb> <партфонды.xlsb>
Результат: db/seed/data/funds-2018.json

Правила (доп. ТЗ 3.1, 3.6):
- строки с названием «секретный фонд» помечаются secret=true и на сайте не публикуются;
- одна строка таблицы — одно название фонда в своих крайних датах; строки с одним номером собираются в один фонд;
- текущее название — последнее по порядку; вся история названий сохраняется.
"""
import datetime
import json
import re
import sys
from pathlib import Path

from pyxlsb import open_workbook

PERSON = re.compile(
    r"^\s*[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+\s*[-–—]"
)


def rows(path):
    with open_workbook(path) as wb:
        with wb.get_sheet(wb.sheets[0]) as s:
            return [[c.v for c in r] for r in s.rows()]


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def excel_date(v):
    if isinstance(v, (int, float)) and 1000 < v < 80000:
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))).isoformat()
    return None


def year(v):
    s = clean(v)
    return int(s) if s and re.fullmatch(r"1[6-9]\d\d|20\d\d", s) else None


def collect(table, col, source):
    """col — номера колонок: num, first, cat, own, dates, name, units, y1, y2, note."""
    funds = {}
    for r in table:
        r = r + [None] * 20
        num = clean(r[col["num"]])
        name = clean(r[col["name"]])
        if not num or not name or num.startswith("№"):
            continue
        f = funds.setdefault(num, {
            "number": num, "names": [], "first_received": None, "category": None, "ownership": None,
            "units_text": None, "year_from": None, "year_to": None, "note": None, "source": source,
        })
        f["names"].append({"dates": clean(r[col["dates"]]), "name": name})
        f["first_received"] = f["first_received"] or excel_date(r[col["first"]])
        f["category"] = f["category"] or clean(r[col["cat"]])
        own = clean(r[col["own"]])
        if own and own.lower() in ("государственная", "частная"):
            f["ownership"] = f["ownership"] or own.lower()
        f["units_text"] = f["units_text"] or clean(r[col["units"]])
        f["year_from"] = f["year_from"] or year(r[col["y1"]])
        f["year_to"] = f["year_to"] or year(r[col["y2"]])
        note = clean(r[col["note"]])
        if note and re.search(r"[А-Яа-яЁё]{3}", note):
            f["note"] = note
    out = []
    for f in funds.values():
        latest = f["names"][-1]["name"]
        f["title"] = latest
        f["secret"] = latest.lower().startswith("секретный фонд")
        f["kind"] = "personal" if PERSON.match(latest) else "organization"
        m = re.match(r"\d+", f["units_text"] or "")
        f["cases_count"] = int(m.group()) if m else None
        out.append(f)
    return out


def main(state_path, party_path):
    state = collect(rows(state_path)[1:],
                    dict(num=2, first=1, cat=3, own=4, dates=5, name=6, note=7, units=8, y1=10, y2=11),
                    "Перечень фондов на 2018 г., e-arhiv.vko.gov.kz")
    party = collect(rows(party_path)[2:],
                    dict(num=4, first=1, cat=5, own=6, dates=7, name=8, note=9, units=10, y1=13, y2=14),
                    "Перечень партийных фондов на 2018 г., e-arhiv.vko.gov.kz")
    data = state + party
    dst = Path(__file__).resolve().parents[2] / "db" / "seed" / "data" / "funds-2018.json"
    dst.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"фондов: {len(state)} + партийных {len(party)}; личных: {sum(f['kind'] == 'personal' for f in data)}; "
          f"секретных (не публикуются): {sum(f['secret'] for f in data)} → {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
