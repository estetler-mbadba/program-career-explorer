#!/usr/bin/env python3
"""Download the public source files into data/raw/.

NCES and O*NET files download directly. BLS blocks scripted downloads, so the Employment
Projections workbook has to be saved by hand from a browser (see SOURCES.md).

Run:  python3 scripts/fetch_data.py
"""
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
ONET_VERSION = "31_0"

FILES = {
    RAW / "CIP2020_SOC2018_Crosswalk.xlsx": "https://nces.ed.gov/ipeds/cipcode/Files/CIP2020_SOC2018_Crosswalk.xlsx",
    RAW / "CIPCode2020.csv": "https://nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv",
}
for name in ("occupation_data", "task_statements", "task_ratings", "job_zones", "job_zone_reference",
             "essential_skills", "transferable_skills", "software_skills"):
    FILES[RAW / "onet" / f"{name}.csv"] = \
        f"https://www.onetcenter.org/dl_files/database/db_{ONET_VERSION}_csv/{name}.csv"


def main():
    for path, url in FILES.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {url}")
        with urllib.request.urlopen(url, timeout=120) as resp, open(path, "wb") as out:
            out.write(resp.read())
    bls = RAW / "bls" / "occupation.xlsx"
    bls.parent.mkdir(parents=True, exist_ok=True)
    if bls.exists():
        print(f"BLS projections found: {bls.relative_to(ROOT)}")
    else:
        print("\nBLS projections not found. In a browser, download\n"
              "  https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx\n"
              f"and save it as {bls.relative_to(ROOT)}. Then run: python3 scripts/build_data.py")


if __name__ == "__main__":
    main()
