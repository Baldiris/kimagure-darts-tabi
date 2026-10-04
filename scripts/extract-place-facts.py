"""Extract small, cited municipality facts from official statistical workbooks.

Usage: python scripts/extract-place-facts.py <e-Stat B xls> <MAFF 2024 xlsx>
The workbooks are downloaded from the URLs recorded in build-place-facts.mjs.
Only derived facts are kept in the repository; the original workbooks are not.
"""

import json
import sys
from pathlib import Path

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parent.parent
CATALOG = json.loads((ROOT / "public/competition/data/destinations.json").read_text())
IDS = {place["id"] for place in CATALOG["municipalities"]}
OUT = ROOT / "data/feature-sources"
OUT.mkdir(parents=True, exist_ok=True)

area_sheet = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
areas = {}
for row in range(10, area_sheet.nrows):
    code = str(area_sheet.cell_value(row, 12)).strip()
    if code in IDS:
        total, habitable = area_sheet.cell_value(row, 10), area_sheet.cell_value(row, 11)
        if not isinstance(total, (int, float)) or not isinstance(habitable, (int, float)):
            raise ValueError(f"Invalid area for {code}")
        areas[code] = [round(total, 2), round(habitable, 2)]
if len(areas) != len(IDS):
    raise ValueError(f"Area coverage: {len(areas)}/{len(IDS)}")

agriculture = {}
sheet = openpyxl.load_workbook(sys.argv[2], read_only=True, data_only=True).active
for row in list(sheet.values)[1:]:
    year, pref, city_code, _, _, _, _, _, product, amount, rank, _ = row
    if year != 2024 or not isinstance(city_code, int):
        continue
    code = f"{pref}{city_code:03d}"
    if code not in IDS or not isinstance(amount, (int, float)) or amount < 5:
        continue
    if product in {"農業産出額", "耕種計", "畜産計"} or product.endswith("計") or product.startswith("その他"):
        continue
    if not isinstance(rank, int):
        continue
    agriculture.setdefault(code, []).append([product, amount, rank])


def preference(item):
    product, amount, rank = item
    # Prefer an unusually strong named product; otherwise use the largest
    # published estimate. Never infer a value hidden as "x" in the source.
    if rank <= 30 and amount >= 10:
        return (0, rank, -amount, product)
    return (1, -amount, rank, product)


agriculture = {code: chosen for code, items in agriculture.items()
               if (chosen := sorted(items, key=preference)[0])[1] >= 10 or chosen[2] <= 30}
for filename, rows in (("area-2024.json", areas), ("agriculture-2024.json", agriculture)):
    (OUT / filename).write_text(json.dumps(dict(sorted(rows.items())), ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Municipality facts: area {len(areas)}, agriculture {len(agriculture)}")
