#!/usr/bin/env python3
"""Build docs/data/explorer-data.js from the public source files in data/raw/.

Sources (see SOURCES.md):
  data/raw/CIPCode2020.csv                 NCES CIP 2020 codes, titles, definitions
  data/raw/CIP2020_SOC2018_Crosswalk.xlsx  NCES/BLS CIP 2020 to SOC 2018 crosswalk
  data/raw/onet/*.csv                      O*NET 31.0 database (CC BY 4.0)
  data/raw/bls/occupation.xlsx             BLS Employment Projections (optional; download by hand)

Run:  python3 scripts/build_data.py
"""
import csv
import datetime
import json
import re
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
ONET = RAW / "onet"
BLS_FILE = RAW / "bls" / "occupation.xlsx"
OUT = ROOT / "docs" / "data" / "explorer-data.js"

TASKS_PER_OCC = 4
SKILLS_PER_OCC = 6
TECH_PER_OCC = 6
COMMON_TECH_SHARE = 0.25
# General-purpose tools that say nothing about a field even where O*NET lists them as in demand.
GENERAL_TOOLS = {
    "Zoom", "Microsoft Teams", "Slack", "Facebook", "LinkedIn", "Instagram", "YouTube", "X", "Twitter",
    "Google Docs", "Google Sheets", "Google Drive", "Google Workspace software", "Gmail", "Dropbox",
    "Microsoft OneDrive", "Microsoft OneNote", "Microsoft SharePoint", "Microsoft Windows", "Apple macOS",
    "Linux", "Adobe Acrobat", "Web browser software", "Email software",
}


def clean_title(t):
    return (t or "").strip().rstrip(".")


# ---------------------------------------------------------------- CIP codes
def load_cip():
    families, cips = {}, []
    with open(RAW / "CIPCode2020.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row["CIPCode"].strip('="')
            # NCES marks a code's new home "Moved to" (a current program with a full definition) and
            # its old home "Moved from" (retired; the definition is only a pointer to the new code).
            if row["Action"] in ("Deleted", "Moved from"):
                continue
            title = clean_title(row["CIPTitle"])
            if len(code) == 2:
                families[code] = title.title() if title.isupper() else title
            elif len(code) == 7:
                cips.append({"c": code, "t": title, "d": (row["CIPDefinition"] or "").strip(), "f": code[:2]})
    return families, cips


# ---------------------------------------------------------------- crosswalk
def load_crosswalk():
    wb = load_workbook(RAW / "CIP2020_SOC2018_Crosswalk.xlsx", read_only=True)
    xwalk, soc_titles = defaultdict(list), {}
    for i, row in enumerate(wb["CIP-SOC"].iter_rows(values_only=True)):
        if i == 0 or not row[0]:
            continue
        cip, _, soc, soc_title = (str(v).strip() if v is not None else "" for v in row[:4])
        if soc.startswith("99-9999"):
            continue
        if soc not in xwalk[cip]:
            xwalk[cip].append(soc)
        soc_titles[soc] = soc_title
    return dict(xwalk), soc_titles


# ---------------------------------------------------------------- O*NET
def read_csv(name):
    with open(ONET / name, encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def soc6(onet_code):
    return onet_code[:7]


def load_onet():
    # Prefer the ".00" O*NET-SOC record for each 6-digit SOC; fall back to the first one listed.
    chosen = {}
    occ = {}
    for row in read_csv("occupation_data.csv"):
        code, s = row["O*NET-SOC Code"], soc6(row["O*NET-SOC Code"])
        if s not in chosen or code.endswith(".00"):
            chosen[s] = code
        occ[code] = {"title": row["Title"], "desc": row["Description"]}

    zone_names = {}
    for row in read_csv("job_zone_reference.csv"):
        name = re.sub(r"^Job Zone [^:]+:\s*", "", row["Name"]).strip()
        zone_names[row["Job Zone"]] = name
    zones = {row["O*NET-SOC Code"]: row["Job Zone"] for row in read_csv("job_zones.csv")}

    importance = {}
    for row in read_csv("task_ratings.csv"):
        if row["Scale ID"] == "IM":
            importance[(row["O*NET-SOC Code"], row["Task ID"])] = float(row["Data Value"] or 0)
    tasks = defaultdict(list)
    for row in read_csv("task_statements.csv"):
        if row["Task Type"] == "Core":
            code = row["O*NET-SOC Code"]
            tasks[code].append((importance.get((code, row["Task ID"]), 0), row["Task"]))

    skills = defaultdict(list)
    for name in ("essential_skills.csv", "transferable_skills.csv"):
        for row in read_csv(name):
            if row["Scale ID"] == "IM" and row.get("Recommend Suppress") != "Y":
                skills[row["O*NET-SOC Code"]].append((float(row["Data Value"] or 0), row["Element Name"]))

    tech = defaultdict(list)
    for row in read_csv("software_skills.csv"):
        if row["Hot Technology"] == "Y":
            rank = 0 if row.get("In Demand") == "Y" else 1
            tech[row["O*NET-SOC Code"]].append((rank, row["Workplace Example"]))

    # Tools that appear for a quarter or more of all occupations (Excel, Outlook, ...) say little about a program.
    tech_lists = {}
    for code in chosen.values():
        seen, names = set(), []
        for rank, name in sorted(tech.get(code, [])):
            if name not in seen:
                seen.add(name)
                names.append((rank, name))
        tech_lists[code] = names
    freq = defaultdict(int)
    for names in tech_lists.values():
        for _, name in names:
            freq[name] += 1
    common = {n for n, k in freq.items() if k >= COMMON_TECH_SHARE * len(tech_lists)} | (GENERAL_TOOLS & set(freq))
    # How widely each tool is used within an occupation's major group (e.g. 29- healthcare), so domain tools
    # such as Epic for nurses outrank tools that appear in only one record.
    group_size, group_freq = defaultdict(int), defaultdict(int)
    for code, names in tech_lists.items():
        group_size[code[:2]] += 1
        for _, name in names:
            group_freq[(code[:2], name)] += 1

    out, zone_ref = {}, {}
    for s, code in chosen.items():
        z = zones.get(code)
        if z:
            zone_ref[z] = zone_names.get(z, "")
        g = code[:2]
        techs = [n for _, n in sorted(tech_lists[code], key=lambda x: (
            x[1] in common, x[0], -group_freq[(g, x[1])] / group_size[g], x[1]))]
        out[s] = {
            "code": code,
            "title": occ[code]["title"],
            "d": occ[code]["desc"],
            "jz": int(z) if z else None,
            "tasks": [t for _, t in sorted(tasks.get(code, []), key=lambda x: -x[0])[:TASKS_PER_OCC]],
            "skills": [n for _, n in sorted(skills.get(code, []), key=lambda x: -x[0])[:SKILLS_PER_OCC]],
            "tech": techs[:TECH_PER_OCC],
        }
    shown = {t for o in out.values() for t in o["tech"]}
    share = {t: round(freq[t] / len(tech_lists), 4) for t in sorted(shown)}
    return out, zone_ref, sorted(common), share


# ---------------------------------------------------------------- BLS Employment Projections (optional)
def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).replace("–", "-").replace("—", "-").strip().lower()


BLS_COLUMNS = {
    "code": lambda h: "matrix code" in h or h.endswith(" code"),
    "emp0": lambda h: h.startswith("employment, 20") and "change" not in h and "distribution" not in h,
    "chg": lambda h: "employment change, percent" in h,
    "open": lambda h: "openings" in h and "annual average" in h,
    "wage": lambda h: "median annual wage" in h,
    "edu": lambda h: "typical education needed for entry" in h,
}


def to_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("$", "").strip()
    m = re.search(r"-?\d+(\.\d+)?", s)
    return float(m.group()) if m else None


def clean_cell(v):
    s = str(v or "").strip()
    return None if s in ("", "\u2014", "-", "\u2013") else s


def load_bls():
    """Read every sheet that looks like a projections table and keep the most complete one.

    occupation.xlsx has several (Table 1.1 covers only major groups; Table 1.2 has every
    detailed occupation with openings and entry education), so the first match is not enough.
    """
    if not BLS_FILE.exists():
        return None
    wb = load_workbook(BLS_FILE, read_only=True, data_only=True)
    candidates = []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        for hi, header in enumerate(rows[:8]):
            h = [norm(c) for c in header]
            cols = {}
            for key, test in BLS_COLUMNS.items():
                for j, name in enumerate(h):
                    if name and test(name) and key not in cols:
                        cols[key] = j
            emp_cols = [j for j, name in enumerate(h) if BLS_COLUMNS["emp0"](name)]
            if {"code", "chg", "wage"} <= cols.keys() and len(emp_cols) >= 2:
                years = re.findall(r"20\d\d", " ".join(h[j] for j in emp_cols[:2]))
                data = {}
                for row in rows[hi + 1:]:
                    code = str(row[cols["code"]] or "").strip()
                    if not re.match(r"^\d\d-\d{4}$", code):
                        continue
                    wage_raw = row[cols["wage"]]
                    data[code] = {
                        "e0": to_num(row[emp_cols[0]]),
                        "e1": to_num(row[emp_cols[1]]),
                        "chg": to_num(row[cols["chg"]]),
                        "open": to_num(row[cols["open"]]) if "open" in cols else None,
                        "wage": to_num(wage_raw),
                        "wage_top": isinstance(wage_raw, str) and ">" in wage_raw,
                        "edu": clean_cell(row[cols["edu"]]) if "edu" in cols else None,
                    }
                if data:
                    candidates.append(({"sheet": ws.title, "years": years[:2], "rows": data},
                                       ("open" in cols) + ("edu" in cols), len(data)))
                break
    if not candidates:
        raise SystemExit(f"Could not find the projections table in {BLS_FILE}. See SOURCES.md.")
    return max(candidates, key=lambda c: (c[1], c[2]))[0]


def bls_for(soc, bls_rows):
    """Exact SOC first; then the broader matrix code BLS sometimes uses (e.g. 15-1250 for 15-1252)."""
    if soc in bls_rows:
        return bls_rows[soc], soc, False
    for broad in (soc[:6] + "0", soc[:5] + "00"):
        if broad in bls_rows:
            return bls_rows[broad], broad, True
    return None, None, False


# ---------------------------------------------------------------- assemble
def main(out=OUT, quiet=False):
    families, cips = load_cip()
    xwalk, soc_titles = load_crosswalk()
    onet, zone_ref, common_tech, tech_share = load_onet()
    bls = load_bls()

    occ = {}
    for soc, title in soc_titles.items():
        rec = {"t": title}
        if soc in onet:
            o = onet[soc]
            rec["o"] = {k: o[k] for k in ("code", "d", "jz", "tasks", "skills", "tech")}
        if bls:
            b, code, broad = bls_for(soc, bls["rows"])
            if b:
                rec["b"] = dict(b, code=code, broad=broad)
        occ[soc] = rec

    meta = {
        "built": datetime.date.today().isoformat(),
        "cipCount": len(cips),
        "occCount": len(occ),
        "onetVersion": "31.0",
        "zones": zone_ref,
        "commonTech": common_tech,
        "techShare": tech_share,
        "bls": None,
    }
    if bls:
        total = bls["rows"].get("00-0000", {})
        meta["bls"] = {"years": bls["years"], "sheet": bls["sheet"],
                       "allChg": total.get("chg"), "allWage": total.get("wage")}

    payload = {"meta": meta, "families": families, "cips": cips, "xwalk": xwalk, "occ": occ}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("window.EXPLORER_DATA = " + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n",
                   encoding="utf-8")
    if quiet:
        return
    with_onet = sum(1 for r in occ.values() if "o" in r)
    with_bls = sum(1 for r in occ.values() if "b" in r)
    print(f"Wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")
    print(f"  {len(cips)} programs, {len(xwalk)} with occupation matches, {len(occ)} occupations")
    print(f"  O*NET detail for {with_onet}; BLS projections for {with_bls}" +
          ("" if bls else " (no BLS file yet; see SOURCES.md)"))


if __name__ == "__main__":
    main()
