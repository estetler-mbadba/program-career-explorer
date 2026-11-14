# How AI was used, and how its work was checked

This project was built by directing an AI coding agent (Claude, from Anthropic). This page says what the agent did, what checked its work, what those checks caught, and what a person still has to confirm.

## Who did what

| Step | Who |
|---|---|
| Chose the question, the sources, and what the page must not claim | The author |
| Wrote the build script and the page | An AI agent, under direction (November 6, 2026) |
| Reviewed the page's design on a test copy, with a written before-and-after record | A second AI agent (November 14, 2026) |
| Wrote the accuracy checks | An AI agent (November 14, 2026) |
| Approved the redesign and the wording changes | The author |

The author directs the agent and reads the result. The author does not claim to have written this code by hand.

## What the checks caught

**145 current programs were missing, and 145 retired codes were listed in their place.**

When NCES moved a program to a new code in the 2020 edition, its file marks the new code "Moved to" and the old code "Moved from". The build script read those labels the other way round. It dropped the new codes and kept the old ones. So Veterinary Medicine (01.8001) could not be found, and its retired code (51.2401) appeared in search with the text "Moved from 51.2401 to 01.8001" where a description belongs and no occupations.

**How it was found.** The first check written for the program list passed, because it repeated the build script's reading of the same column. A different check failed: every program in the federal crosswalk should be on the program list, and 144 were not. That pointed straight at the cause.

**The fix.** One line in `scripts/build_data.py`. The program-list check was then rewritten to decide from the definition text, not the action label, so the check and the build can no longer share a misreading of that column.

**The lesson.** A check that copies the logic it is checking proves nothing. The check that worked compared two sources that should agree.

## What the design review caught

The review ran on a copy of the page and wrote down every change before anything was adopted.

- On a phone, wage, growth, and openings sat off the right edge of the screen. Each occupation is now a card with every figure labelled.
- The wage box read "$98k–98k" when a program's lowest and highest wage were the same. It now shows one figure.
- The wage box read "$NaNk–NaNk" for programs with no wage reported. It now shows a dash.
- The limits ("What this data cannot tell you") appeared only inside the brief. They are now on the results page too.

Two faults in the brief's wording were fixed at the same time, with the author's approval: a one-occupation program no longer says its wages "range from" a figure to the same figure, and a program with no wage reported no longer prints an empty range.

Three smaller choices the review had held back were made later the same day, with the author's approval:

- On a phone, an occupation's card leaves out its preparation level. It is still in the occupation's details, and the table on wider screens still shows it.
- The page's own limits block steps aside while the brief is open, because the brief repeats the same limits.
- The wage box is headed "Median wage" when it shows a single figure, and "Median wages" when it shows a range.

## A check that was itself wrong

One new check failed on its first run and the data was right. It required every occupation to have an O*NET preparation level. 93 do not: O*NET collects no detail for residual "All Other" occupations or for military occupations. The check now allows a missing level only for those two kinds.

## What is not checked by script

- The arithmetic the page does in the browser: the four summary boxes.
- The wording of the brief, beyond the cases named above.
- Browsers other than Chrome, a screen reader, and a real phone.

## Human review log

These are checks only a person can make. Each is unsigned until the author has done it.

| # | Check | Done by | Date |
|---|---|---|---|
| 1 | I ran `make check` myself and saw 13 of 13 checks pass | | |
| 2 | I looked up three programs I know well and the occupations and figures made sense | | |
| 3 | I compared one occupation's figures with the BLS Occupational Outlook Handbook | | |
| 4 | I generated a brief, read it start to finish, and would hand it to a dean | | |
| 5 | I opened the page on my own phone | | |
