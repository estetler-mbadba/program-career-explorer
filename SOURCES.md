# Data sources

Every figure in the explorer comes from a free, public source. The build script reads the files in `data/raw/` and writes one file the page loads: `docs/data/explorer-data.js`.

| Source | What it supplies | File in `data/raw/` | How to get it |
|---|---|---|---|
| NCES, [Classification of Instructional Programs (CIP) 2020](https://nces.ed.gov/ipeds/cipcode/) | Program codes, titles, definitions, and families | `CIPCode2020.csv` | `scripts/fetch_data.py` |
| NCES and BLS, CIP 2020 to SOC 2018 crosswalk | Which occupations each program connects to | `CIP2020_SOC2018_Crosswalk.xlsx` | `scripts/fetch_data.py` |
| [O*NET 31.0 Database](https://www.onetcenter.org/database.html), USDOL/ETA | Occupation descriptions, core tasks, most important skills, tools, and preparation level (Job Zone) | `onet/*.csv` | `scripts/fetch_data.py` |
| BLS, [Employment Projections](https://www.bls.gov/emp/) | National employment, 10-year projected growth, annual openings, median wage, typical entry education | `bls/occupation.xlsx` | **Download by hand** (below) |

## Adding the BLS projections

BLS blocks scripted downloads, so save this one file from a browser:

1. Open https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx in a browser. The file downloads.
2. Save it as `data/raw/bls/occupation.xlsx`.
3. Run `python3 scripts/build_data.py`.

The build finds the table with occupation codes, employment for both years, percent change, annual openings, median wage, and typical entry education, whichever sheet it is on. If BLS changes the layout, the build stops and says so. Until the file is added, the explorer still works; it shows occupations, O*NET detail, and the brief without growth, openings, wages, or entry education.

## How the data is used

- **Programs to occupations.** Taken as published in the crosswalk. Rows marked "NO MATCH" are dropped, so some programs show no occupations.
- **Postsecondary teaching roles** (SOC 25-1xxx) are hidden by default, because nearly every field maps to its own "Teachers, Postsecondary" occupation, which usually requires a doctorate. A checkbox brings them back.
- **O*NET detail** uses the main O*NET record for each occupation (the `.00` code). Tasks are core tasks ranked by importance; skills combine O*NET's essential and transferable skills, ranked by importance. Tools are O*NET "Hot Technology" examples, ordered so that in-demand tools widely used in the occupation's field come first. Office software that appears for a quarter or more of all occupations (Excel, Word, Outlook, and similar) and a short list of general-purpose tools (video calls, chat, social media, file sharing; see `GENERAL_TOOLS` in `scripts/build_data.py`) move to the end and are left out of the brief's tools question.
- **BLS figures** are matched on the SOC code. When BLS reports an occupation only as part of a broader group, the explorer uses the group and marks it.
- **Group totals** in the summary tiles add up employment and openings across the occupations shown, counting each BLS figure once when several occupations share a broader BLS group. Growth is the combined change in employment, not an average of percentages.
- **Not covered by BLS:** military occupations (SOC 55-xxxx) have no projections, so they show O*NET detail only.

## Attribution

This project includes information from the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. O*NET&reg; is a trademark of USDOL/ETA. The explorer excerpts and ranks O*NET content; USDOL/ETA has not approved, endorsed, or tested these modifications.

NCES and BLS data are works of the U.S. government.

## Updating each year

BLS publishes new projections each September, and O*NET releases new database versions several times a year. To refresh:

1. Update `ONET_VERSION` in `scripts/fetch_data.py` if a new O*NET release is out, and the label in `scripts/build_data.py`.
2. Run `python3 scripts/fetch_data.py`.
3. Download the new BLS workbook by hand (above).
4. Run `python3 scripts/build_data.py`.
