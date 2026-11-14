# Rebuild and check the explorer's data. The page itself needs no build step.
.PHONY: fetch build check serve

fetch:      ## download the NCES and O*NET source files (the BLS workbook is saved by hand; see SOURCES.md)
	python3 scripts/fetch_data.py

build:      ## write docs/data/explorer-data.js from the source files
	python3 scripts/build_data.py

check:      ## 13 accuracy checks; exits non-zero if any fail
	python3 scripts/checks.py

serve:      ## preview the explorer at http://localhost:8765
	python3 -m http.server 8765 --directory docs
