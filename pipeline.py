import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ITEM = "Cereals - Excluding Beer"
YEAR = "2023"

# Map IDs whose country names differ from the CSV's Area column.
CSV_AREA_BY_MAP_ID = {
    "BHS": "Bahamas",
    "BOL": "Bolivia (Plurinational State of)",
    "CHN": "China, mainland",
    "CIV": "Côte d'Ivoire",
    "COG": "Congo",
    "CZE": "Czechia",
    "GBR": "United Kingdom of Great Britain and Northern Ireland",
    "GMB": "Gambia",
    "IRN": "Iran (Islamic Republic of)",
    "KOR": "Republic of Korea",
    "LAO": "Lao People's Democratic Republic",
    "MDA": "Republic of Moldova",
    "NLD": "Netherlands (Kingdom of the)",
    "PRK": "Democratic People's Republic of Korea",
    "RUS": "Russian Federation",
    "SYR": "Syrian Arab Republic",
    "TLS": "Timor-Leste",
    "TUR": "Türkiye",
    "TWN": "China, Taiwan Province of",
    "TZA": "United Republic of Tanzania",
    "VEN": "Venezuela (Bolivarian Republic of)",
    "VNM": "Viet Nam",
}


def load_map_ids():
    path = ROOT / "src" / "assets" / "countries.json"
    countries = json.loads(path.read_text(encoding="utf-8"))
    return {
        CSV_AREA_BY_MAP_ID.get(country["id"], country["name"]): country["id"]
        for country in countries
    }


def main():
    assets = ROOT / "src" / "assets"
    map_id_by_area = load_map_ids()
    by_country = {}
    world = {}

    with (ROOT / "data" / "food_balance_long.csv").open(
        encoding="utf-8-sig", newline=""
    ) as source:
        for row in csv.DictReader(source):
            if row["Item"] != ITEM or row["Year"] != YEAR:
                continue
            if not row["Value"].strip():
                continue

            area = row["Area"]
            if area == "World":
                measures = world
            else:
                country_id = map_id_by_area.get(area)
                if country_id is None:
                    continue
                measures = by_country.setdefault(country_id, {})
            element = row["Element"]
            if element in measures:
                raise ValueError(f"Duplicate {element} for {row['Area']}, {ITEM}, {YEAR}")
            measures[element] = float(row["Value"])

    output = assets / "food-balance.json"
    dashboard_data = {
        "item": ITEM,
        "year": int(YEAR),
        "byCountry": by_country,
        "world": world,
    }
    output.write_text(
        json.dumps(dashboard_data, indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"Exported {len(by_country)} countries to {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
