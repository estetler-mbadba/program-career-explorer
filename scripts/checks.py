#!/usr/bin/env python3
"""Accuracy checks for the explorer's data. Exits with an error if any check fails.

    python3 scripts/checks.py

The build script was drafted with an AI coding agent. These checks do not trust it. Each one
reads a federal source file again, in its own way, and compares what it finds with the data file
the page loads (docs/data/explorer-data.js). The last check rebuilds that file from scratch and
requires the result to be identical.

What is not checked here: the arithmetic the page does in the browser (the summary boxes and
the wording of the brief). Those were checked by hand and in the browser; see AI_WORKFLOW.md.

Needs the source files in data/raw/ (python3 scripts/fetch_data.py, plus the BLS workbook; see
SOURCES.md) and openpyxl.
"""
import csv
import json
import re
import sys
import tempfile
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PAGE_DATA = ROOT / "docs" / "data" / "explorer-data.js"
RESULTS = []


def check(name, passed, detail):
    RESULTS.append(bool(passed))
    print("%s  %s  (%s)" % ("ok  " if passed else "FAIL", name, detail))


def load_page_data(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def number(v):
    if v is None or isinstance(v, (int, float)):
        return None if v is None else float(v)
    m = re.search(r"-?\d+(\.\d+)?", str(v).replace(",", ""))
    return float(m.group()) if m else None


def main():
    data = load_page_data(PAGE_DATA)
    cips, xwalk, occ, meta = data["cips"], data["xwalk"], data["occ"], data["meta"]

    # ---- Programs: the NCES list of CIP 2020 codes --------------------------------------------
    # A current program has a real definition. A retired code's "definition" is only a pointer:
    # "Moved from 51.2401 to 01.8001" or "Deleted, Report under 61". This reads the definition, not
    # the Action column the build script uses, so the two cannot share a misreading of that column.
    nces = {}
    with open(RAW / "CIPCode2020.csv", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            code = row["CIPCode"].replace("=", "").replace('"', "")
            pointer = re.match(r"(Moved from|Deleted)", row["CIPDefinition"].strip())
            if re.fullmatch(r"\d\d\.\d{4}", code) and not pointer:
                nces[code] = row["CIPTitle"].strip().rstrip(".")
    on_page = {c["c"]: c["t"] for c in cips}
    check("Every program on the page is a current CIP 2020 program, and none is missing",
          set(on_page) == set(nces), "%d programs on the page, %d in the NCES file" % (len(on_page), len(nces)))
    wrong = [c for c in on_page if on_page[c] != nces.get(c)]
    check("Program titles match NCES", not wrong, "%d titles compared; %d differ" % (len(on_page), len(wrong)))

    # ---- Links: the NCES and BLS crosswalk -----------------------------------------------------
    pairs = set()
    sheet = load_workbook(RAW / "CIP2020_SOC2018_Crosswalk.xlsx", read_only=True)["CIP-SOC"]
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        if i and row[0] and row[2] and not str(row[2]).startswith("99-9999"):
            pairs.add((str(row[0]).strip(), str(row[2]).strip()))
    page_pairs = {(cip, soc) for cip, socs in xwalk.items() for soc in socs}
    check("Every program-to-occupation link is in the federal crosswalk, and none is missing",
          page_pairs == pairs, "%d links on the page, %d in the crosswalk" % (len(page_pairs), len(pairs)))
    linked = {soc for _, soc in page_pairs}
    check("Every linked occupation has a record, and no record goes unused", linked == set(occ),
          "%d occupations linked, %d records" % (len(linked), len(occ)))
    unknown = sorted(c for c in xwalk if c not in on_page)
    check("Every program in the crosswalk is on the program list", len(unknown) <= 1,
          "%d of %d crosswalk programs are not in the NCES program file%s" % (
              len(unknown), len(xwalk), ": " + ", ".join(unknown) if unknown else ""))

    # ---- BLS Employment Projections --------------------------------------------------------------
    wb = load_workbook(RAW / "bls" / "occupation.xlsx", read_only=True, data_only=True)
    rows = list(wb[meta["bls"]["sheet"]].iter_rows(values_only=True))
    head_at = next(i for i, r in enumerate(rows[:10]) if any("matrix code" in str(c).lower() for c in r))
    head = [str(c or "").lower() for c in rows[head_at]]
    col = {
        "code": next(j for j, h in enumerate(head) if "matrix code" in h),
        "e0": next(j for j, h in enumerate(head) if h.startswith("employment, " + meta["bls"]["years"][0])),
        "e1": next(j for j, h in enumerate(head) if h.startswith("employment, " + meta["bls"]["years"][1])),
        "chg": next(j for j, h in enumerate(head) if h.startswith("employment change, percent")),
        "open": next(j for j, h in enumerate(head) if h.startswith("occupational openings")),
        "wage": next(j for j, h in enumerate(head) if h.startswith("median annual wage")),
        "edu": next(j for j, h in enumerate(head) if h.startswith("typical education needed")),
    }
    bls = {str(r[col["code"]]).strip(): r for r in rows[head_at + 1:] if r[col["code"]]}
    compared = differ = 0
    for soc, rec in occ.items():
        b = rec.get("b")
        if not b:
            continue
        src = bls.get(b["code"])
        for key in ("e0", "e1", "chg", "open", "wage"):
            compared += 1
            differ += src is None or number(src[col[key]]) != b[key]
        compared += 1
        edu = str(src[col["edu"]] or "").strip() if src is not None else None
        differ += (None if edu in ("", "—", "-", "–") else edu) != b["edu"]
    check("Employment, growth, openings, wage, and entry education match the BLS workbook", differ == 0,
          "%d figures compared for %d occupations; %d differ" % (compared, sum(1 for r in occ.values() if "b" in r), differ))
    bad = [soc for soc, r in occ.items() if "b" in r and
           ((r["b"]["broad"] and (r["b"]["code"] == soc or soc in bls)) or (not r["b"]["broad"] and r["b"]["code"] != soc))]
    broad = sum(1 for r in occ.values() if r.get("b", {}).get("broad"))
    check("A broader BLS group is used only when BLS has no line for the occupation, and is marked", not bad,
          "%d occupations use a broader group; %d are marked wrongly" % (broad, len(bad)))
    off = []
    for soc, r in occ.items():
        b = r.get("b")
        if b and b["e0"] and b["e1"] is not None and b["chg"] is not None:
            implied = 100.0 * (b["e1"] - b["e0"]) / b["e0"]
            # BLS rounds employment to the nearest hundred jobs and growth to a tenth of a point.
            if abs(implied - b["chg"]) > 100.0 * 0.1 / b["e0"] + 0.06:
                off.append(soc)
    check("BLS growth agrees with BLS employment in the two years", not off,
          "growth recomputed from employment for every occupation; %d outside rounding" % len(off))

    # ---- O*NET -----------------------------------------------------------------------------------
    described = {}
    with open(RAW / "onet" / "occupation_data.csv", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            described[row["O*NET-SOC Code"]] = row["Description"].strip()
    with_onet = {soc: r["o"] for soc, r in occ.items() if "o" in r}
    wrong = [soc for soc, o in with_onet.items() if o["code"] != soc + ".00" or o["d"] != described.get(o["code"])]
    check("Occupation descriptions match the O*NET file, from the main record for each occupation", not wrong,
          "%d descriptions compared; %d differ" % (len(with_onet), len(wrong)))
    long = [soc for soc, o in with_onet.items()
            if len(o["tasks"]) > build_data.TASKS_PER_OCC or len(o["skills"]) > build_data.SKILLS_PER_OCC
            or len(o["tech"]) > build_data.TECH_PER_OCC or o["jz"] not in (1, 2, 3, 4, 5, None)]
    bare = [soc for soc, o in with_onet.items() if o["jz"] is None]
    # O*NET collects no detail for residual "All Other" occupations or for military occupations.
    odd = [soc for soc in bare if with_onet[soc]["tasks"]
           or not ("All Other" in occ[soc]["t"] or soc.startswith("55-"))]
    check("Task, skill, and tool lists are within their limits, and preparation levels are 1 to 5", not long and not odd,
          "%d occupations checked; %d have no O*NET detail, all of them residual \"All Other\" or military occupations" % (
              len(with_onet), len(bare)))

    # ---- The page ----------------------------------------------------------------------------------
    check("The counts the page states match the data", meta["cipCount"] == len(cips) and meta["occCount"] == len(occ),
          "%d programs, %d occupations" % (len(cips), len(occ)))
    page = (ROOT / "docs" / "index.html").read_text(encoding="utf-8") + (ROOT / "docs" / "app.js").read_text(encoding="utf-8")
    credit = all(s in page for s in ("O*NET", "creativecommons.org/licenses/by/4.0", "USDOL/ETA"))
    check("The O*NET credit and license are on the page", credit, "required by the O*NET license (CC BY 4.0)")

    # ---- Rebuild -------------------------------------------------------------------------------------
    with tempfile.TemporaryDirectory() as folder:
        fresh = Path(folder) / "explorer-data.js"
        build_data.main(fresh, quiet=True)
        rebuilt = load_page_data(fresh)
    rebuilt["meta"]["built"] = meta["built"]
    check("Rebuilding from the source files gives the same data", rebuilt == data,
          "every program, link, and occupation record compared; only the build date may differ")

    print("\n%d of %d checks passed" % (sum(RESULTS), len(RESULTS)))
    sys.exit(0 if all(RESULTS) else 1)


if __name__ == "__main__":
    main()
