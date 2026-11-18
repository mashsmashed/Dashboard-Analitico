import pandas as pd
from flask import Flask, request

from pipeline import ROOT, load_map_ids

DIMENSIONS = {"area": "Area", "item": "Item", "element": "Element", "year": "Year"}
AGGREGATE_AREAS = {
    "World", "China",
    "Africa", "Eastern Africa", "Middle Africa", "Northern Africa",
    "Southern Africa", "Western Africa",
    "Americas", "Northern America", "Central America", "Caribbean", "South America",
    "Asia", "Central Asia", "Eastern Asia", "Southern Asia", "South-eastern Asia",
    "Western Asia", "Europe", "Eastern Europe", "Northern Europe",
    "Southern Europe", "Western Europe", "Oceania", "Australia and New Zealand",
    "Melanesia", "Micronesia", "Polynesia", "European Union (27)",
    "Least Developed Countries (LDCs)", "Land Locked Developing Countries (LLDCs)",
    "Small Island Developing States (SIDS)", "Low Income Food Deficit Countries (LIFDCs)",
    "Net Food Importing Developing Countries (NFIDCs)",
}
AGGREGATIONS = {"sum", "mean", "min", "max"}
REGIONAL_TOTALS = {"Africa", "Americas", "Asia", "China", "Europe", "Oceania"}


def create_app():
    app = Flask(
	__name__,
	static_folder="dist",
	static_url_path=""
    )

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    data = pd.read_csv(
        ROOT / "data" / "food_balance_long.csv",
        dtype={"Area": "category", "Item": "category", "Element": "category"},
    )
    map_ids = load_map_ids()
    area_by_map_id = {map_id: area for area, map_id in map_ids.items()}
    years_by_item = (
        data.dropna(subset=["Value"])
        .groupby("Item", observed=True)["Year"]
        .unique()
        .map(lambda years: sorted(years.tolist()))
        .to_dict()
    )
    options = {
        name: sorted(data[column].dropna().unique().tolist())
        for name, column in   File "<frozen importlib._bootstrap_external>", line 897, in get_code
Menu
05:25:46 PM
  File "<frozen importlib._bootstrap_external>", line 827, in source_to_code
05:25:46 PM
  File "<frozen importlib._bootstrap>", line 491, in _call_with_frames_removed
05:25:46 PM
  File "/opt/render/project/src/app.py", line 32
05:25:46 PM
    	def index():
05:25:46 PM
    ^
05:25:46 PM
TabError: inconsistent use of tabs and spaces in indentationDIMENSIONS.items()
    }

    @app.get("/api/food-balance/options")
    def food_balance_options():
        if "item" in request.args:
            return {**options, "year": years_by_item.get(request.args["item"], [])}
        return options

    @app.get("/api/food-balance/product")
    def food_balance_product():
        item = request.args.get("item")
        if not item:
            return {"error": "item is required"}, 400
        years = years_by_item.get(item)
        if years is None:
            return {"error": "No data for this product"}, 404

        excluded = AGGREGATE_AREAS - REGIONAL_TOTALS - {"World"}
        rows = data.loc[data["Item"].eq(item) & ~data["Area"].isin(excluded)]
        rows = rows.dropna(subset=["Value"]).sort_values("Value", ascending=False, kind="stable")
        by_year = {}
        for year, year_rows in rows.groupby("Year"):
            totals, regions, countries = [], [], []
            for row in year_rows[["Area", "Element", "Year", "Value"]].to_dict(orient="records"):
                area = row["Area"]
                if area == "World":
                    totals.append(row)
                elif area in REGIONAL_TOTALS:
                    regions.append(row)
                else:
                    row["mapId"] = map_ids.get(area)
                    countries.append(row)
            by_year[str(year)] = {"world": totals, "regions": regions, "countries": countries}
        return {"unit": "1000 t", "years": years, "byYear": by_year}

    @app.get("/api/food-balance")
    def food_balance():
        args = request.args
        known_params = set(DIMENSIONS) | {"from", "to", "group_by", "agg", "sort", "limit", "map_id"}
        if unknown := sorted(set(args) - known_params):
            return {"error": f"Unknown parameter(s): {', '.join(unknown)}"}, 400

        group_by = args.get("group_by", "").split(",") if "group_by" in args else []
        if any(name not in DIMENSIONS for name in group_by) or len(group_by) != len(set(group_by)):
            return {"error": "group_by must list distinct fields: area,item,element,year"}, 400
        aggregation = args.get("agg", "sum")
        if aggregation not in AGGREGATIONS or ("agg" in args and not group_by):
            return {"error": "agg requires group_by and must be sum, mean, min, or max"}, 400
        sort = args.get("sort", "desc")
        if sort not in {"asc", "desc"}:
            return {"error": "sort must be asc or desc"}, 400

        try:
            years = [int(year) for year in args.getlist("year")]
            start = int(args["from"]) if "from" in args else None
            end = int(args["to"]) if "to" in args else None
            limit = int(args.get("limit", 1000))
        except ValueError:
            return {"error": "year, from, to, and limit must be integers"}, 400
        if start is not None and end is not None and start > end:
            return {"error": "from must be less than or equal to to"}, 400
        if not 1 <= limit <= 10000:
            return {"error": "limit must be between 1 and 10000"}, 400

        areas = args.getlist("area")
        mask = data["Area"].isin(areas) if areas else ~data["Area"].isin(AGGREGATE_AREAS)
        if ids := args.getlist("map_id"):
            mask &= data["Area"].isin([area_by_map_id.get(map_id) for map_id in ids])
        for name in ("item", "element"):
            if values := args.getlist(name):
                mask &= data[DIMENSIONS[name]].isin(values)
        if years:
            mask &= data["Year"].isin(years)
        if start is not None:
            mask &= data["Year"].ge(start)
        if end is not None:
            mask &= data["Year"].le(end)

        rows = data.loc[mask].dropna(subset=["Value"])
        if group_by:
            columns = [DIMENSIONS[name] for name in group_by]
            for column in ("Item", "Element"):
                if column not in columns and rows[column].nunique() > 1:
                    name = column.lower()
                    return {"error": f"Filter to one {name} or include {name} in group_by"}, 400
            rows = rows.groupby(columns, observed=True)["Value"].agg(aggregation).reset_index()

        total = len(rows)
        rows = rows.sort_values("Value", ascending=sort == "asc", kind="stable").head(limit)
        records = rows.to_dict(orient="records")
        for record in records:
            if "Area" in record:
                record["mapId"] = map_ids.get(record["Area"])
        return {"unit": "1000 t", "total": total, "rows": records}

    return app
