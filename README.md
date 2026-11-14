# Program-to-Career Explorer

Pick an academic program and see the occupations it connects to, how they are projected to grow, what they pay, and what the work involves. Then generate a one-page brief to start a conversation with faculty, deans, a board, or students.

**Live explorer:** https://estetler-mbadba.github.io/program-career-explorer/

Built entirely from free public data: the federal CIP-to-SOC crosswalk, BLS Employment Projections, and the O*NET database. It is a conversation starter, not a feasibility study. It is independent work and is not affiliated with or endorsed by NCES, BLS, or O*NET.

## What it does

- **Find a program** by name or CIP code (2,173 programs in CIP 2020).
- **See the occupations** the federal crosswalk connects it to, with:
  - national employment, 10-year projected growth, annual openings, median wage, and typical entry education (BLS)
  - what the work involves, core tasks, the most important skills, the tools employers ask for, and the preparation level (O*NET)
- **Sort and expand.** Sort by growth, openings, or wage. Select an occupation for details and a link to its full O*NET profile.
- **Generate a conversation brief:** the program, where graduates may go, five to eight questions for the conversation, what the data cannot tell you, and sources. Copy it, download it as Markdown, or print it to PDF. Each brief has a link that opens it directly (for example `#cip=51.3801&brief=1`).

The questions come from rules, not a language model. For example, if most of the occupations typically require a graduate degree, the brief asks whether the institution offers or partners for the next credential.

## What it demonstrates

| Skill | Where to look |
|---|---|
| Joining four federal sources that use two coding systems (CIP for programs, SOC for occupations) | [`scripts/build_data.py`](scripts/build_data.py), [`SOURCES.md`](SOURCES.md) |
| Reading a workbook whose layout changes from year to year, and stopping when it cannot | `load_bls` in [`scripts/build_data.py`](scripts/build_data.py) |
| Accuracy checks that read each source a second time | [`scripts/checks.py`](scripts/checks.py), 13 checks |
| AI-assisted development with the work verified, including the error the checks caught | [`AI_WORKFLOW.md`](AI_WORKFLOW.md) |
| Standard definitions | [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) |
| A tool with shareable views and a take-away document | the explorer and its brief |
| Following a data license | The O*NET credit on the page and in [`SOURCES.md`](SOURCES.md); a check fails the build if it is missing |

## Run it

No server, build tools, or accounts needed. Open `docs/index.html` in a browser.

To serve it locally instead:

```
make serve
```

Then open http://localhost:8765.

## Rebuild the data and check it

```
make fetch    # NCES and O*NET downloads
# download the BLS workbook by hand (see SOURCES.md)
make build    # writes docs/data/explorer-data.js
make check    # 13 accuracy checks; exits with an error if any fail
```

The build needs Python 3.9 or later and `openpyxl` (`pip install openpyxl`).

## How the data is checked

The build script was drafted with an AI coding agent, so the checks do not trust it. Each one reads a federal source file again in its own way and compares it with the data the page loads.

- Every program on the page is a current CIP 2020 program, with the NCES title, and none is missing.
- Every program-to-occupation link is in the federal crosswalk, and none is missing.
- Every employment, growth, openings, wage, and entry-education figure matches the BLS workbook (5,088 figures).
- BLS growth agrees with BLS employment in the two years, within rounding.
- Every occupation description matches the O*NET file.
- Rebuilding from the source files gives the same data.

The checks caught a real error on the day they were written: 145 current programs were missing from the page and 145 retired codes were listed in their place. The account is in [`AI_WORKFLOW.md`](AI_WORKFLOW.md).

What is not checked by script: the arithmetic the page does in the browser (the summary boxes) and the wording of the brief.

## Project layout

```
docs/                  the explorer (static HTML, CSS, JavaScript)
  data/explorer-data.js  built data (about 1.9 MB)
scripts/
  fetch_data.py        downloads the public source files
  build_data.py        turns them into docs/data/explorer-data.js
  checks.py            accuracy checks
data/raw/              source files (not committed; large)
SOURCES.md             sources, attribution, and how the data is used
DATA_DICTIONARY.md     what each figure means
AI_WORKFLOW.md         how AI was used and how its work was checked
```

## Limits

- The crosswalk shows occupations a program can prepare people for, not where graduates go.
- Projections and wages are national. Regional demand and pay can differ a great deal.
- Median wages describe everyone in an occupation, not new graduates.
- None of this is job-posting data. Employer skill demands and credential requirements need a separate scan.
- 225 programs have no occupation in the federal crosswalk and show none.
- 19 occupations, all military, have no BLS projections. 93 have no O*NET detail: residual "All Other" categories and military occupations.

## License

Code: MIT License. See [`LICENSE`](LICENSE). O*NET content stays under CC BY 4.0 with the attribution in [`SOURCES.md`](SOURCES.md) and on the page. NCES and BLS data are works of the U.S. government.
