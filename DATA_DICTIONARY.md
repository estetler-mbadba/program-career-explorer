# Data dictionary

What each figure on the explorer means, where it comes from, and what one record in the data file holds. Sources and license terms are in [`SOURCES.md`](SOURCES.md).

## Terms

| Term | Meaning | Source |
|---|---|---|
| **Program** | A six-digit code in the Classification of Instructional Programs, 2020 edition (for example 51.3801, Registered Nursing). Retired codes are left out. | NCES |
| **Program family** | The first two digits of the code (51, Health Professions). | NCES |
| **Occupation** | A detailed occupation in the Standard Occupational Classification, 2018 edition (for example 29-1141, Registered Nurses). | BLS |
| **Link** | A program and occupation pair in the federal crosswalk. It means the program can prepare people for the occupation. It does not mean graduates go there. | NCES and BLS |
| **Employment** | National jobs in the occupation, in thousands, in the base year and the projected year. | BLS Employment Projections |
| **Growth** | Projected percent change in employment over the ten years. | BLS |
| **Openings** | Projected average openings per year, in thousands, from growth and from people leaving the occupation. | BLS |
| **Median wage** | Median annual wage for everyone in the occupation, in dollars. Not a starting wage. A figure at the top of the BLS scale is shown with a plus sign. | BLS |
| **Typical entry education** | The education most workers need to enter the occupation. | BLS |
| **Preparation** | O*NET Job Zone, 1 (little preparation) to 5 (extensive preparation). | O*NET |
| **Tasks, skills, tools** | The top core tasks by importance, the most important skills, and in-demand technology examples for the occupation. | O*NET |
| **Broader group** | When BLS has no line for an occupation, the explorer shows the BLS group that contains it and marks the figures as a group's. | BLS |

## Summary boxes

The page adds these up in the browser for the occupations shown.

| Box | How it is computed |
|---|---|
| **Employment and openings** | Summed across the occupations shown. When several occupations share one broader BLS group, the group is counted once. |
| **Growth** | The combined change in employment across the occupations shown: total projected employment against total base employment. It is not an average of percentages. |
| **Median wages** | The lowest and highest median wage among the occupations shown. |

Postsecondary teaching occupations (SOC 25-1xxx) are left out unless the reader ticks the box, because nearly every field links to its own "Teachers, Postsecondary" occupation.

## The data file

`docs/data/explorer-data.js` sets one object with five parts.

| Part | One entry is | Fields |
|---|---|---|
| `meta` | The build | `built` date, counts, the O*NET version, the BLS table and years, the Job Zone names, and the list of tools common to a quarter or more of occupations |
| `families` | A program family | two-digit code and title |
| `cips` | A program | `c` code, `t` title, `d` definition, `f` family |
| `xwalk` | A program's links | program code and its list of occupation codes |
| `occ` | An occupation | `t` title; `o` the O*NET detail (`code`, `d` description, `jz` Job Zone, `tasks`, `skills`, `tech`); `b` the BLS figures (`e0`, `e1` employment in thousands, `chg` percent growth, `open` openings in thousands, `wage`, `wage_top`, `edu`, the BLS `code` used, and `broad` when it is a broader group) |

## Coverage

| | Count |
|---|---|
| Programs | 2,173 |
| Programs with at least one linked occupation | 1,948 |
| Program and occupation links | 5,903 |
| Occupations | 867 |
| Occupations with BLS projections | 848 (29 through a broader group) |
| Occupations with O*NET tasks, skills, and a preparation level | 774 |
