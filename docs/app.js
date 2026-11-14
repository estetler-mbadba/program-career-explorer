/* Program-to-Career Explorer: search, occupation table, and conversation brief.
   All data comes from data/explorer-data.js (built by scripts/build_data.py). No network calls. */
(function () {
  "use strict";

  const D = window.EXPLORER_DATA;
  const BLS = D.meta.bls;                       // null until the BLS projections file is added
  const byCode = new Map(D.cips.map((c) => [c.c, c]));
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const state = { cip: null, sortKey: BLS ? "open" : "title", sortDir: BLS ? -1 : 1, open: new Set() };

  // Readers who ask their device for less motion get instant jumps instead of smooth scrolling.
  const reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const scrollBehavior = () => (reduceMotion.matches ? "auto" : "smooth");
  // Decorative arrow on the brief button (the brief opens further down the page).
  const ARROW = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  const defaultDir = (key) => (["title", "edu", "jz"].includes(key) ? 1 : -1);

  // The standing limits of this data. Shown under the occupation table and repeated in every brief.
  const LIMITS = [
    "The crosswalk shows occupations a program can prepare people for. It does not show where graduates actually go.",
    "Projections and wages are national. Regional demand and pay can differ a great deal.",
    "Median wages describe everyone in the occupation, not new graduates.",
    "None of this is job-posting data. Employer skill demands and credential requirements need a separate scan.",
  ];

  // ---------------------------------------------------------------- formatting
  const fmtInt = (n) => (n == null ? "" : Math.round(n).toLocaleString("en-US"));
  const fmtMoney = (b) => (b && b.wage != null ? "$" + fmtInt(b.wage) + (b.wage_top ? "+" : "") : "");
  const fmtPct = (n) => (n == null ? "" : (n > 0 ? "+" : "") + n.toFixed(1) + "%");
  const thousands = (n) => (n == null ? null : n * 1000);  // BLS reports employment and openings in thousands
  const yearsLabel = () => (BLS && BLS.years.length === 2 ? `${BLS.years[0]}–${BLS.years[1].slice(2)}` : "");
  const zoneName = (z) => (z ? D.meta.zones[String(z)] || `Job Zone ${z}` : "");
  const isTeaching = (soc) => soc.startsWith("25-1");

  // ---------------------------------------------------------------- search
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").replace(/\s+/g, " ").trim();
  const searchIndex = D.cips.map((c) => ({ c, hay: normalize(c.t), words: normalize(c.t).split(" ") }));

  function search(query) {
    const q = normalize(query);
    if (!q) return [];
    if (/^\d{2}(\.\d{0,4})?$/.test(q)) {
      return D.cips.filter((c) => c.c.startsWith(q)).slice(0, 15);
    }
    const terms = q.split(" ");
    const scored = [];
    for (const item of searchIndex) {
      if (!terms.every((t) => item.words.some((w) => w.startsWith(t)) || item.hay.includes(t))) continue;
      let score = 0;
      if (item.hay.startsWith(q)) score += 3;
      if (item.hay.includes(q)) score += 2;
      if (D.xwalk[item.c.c]) score += 1;          // programs with occupation matches first
      if (item.c.c.endsWith("00")) score += 0.5;   // general programs before specializations
      scored.push([score, item.c]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].c.localeCompare(b[1].c));
    return scored.slice(0, 15).map((x) => x[1]);
  }

  const input = $("#q");
  const list = $("#suggestions");
  let active = -1;
  let current = [];

  function showSuggestions(items) {
    current = items;
    active = items.length ? 0 : -1;
    if (!input.value.trim()) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="opt-${i}" data-cip="${c.c}" aria-selected="${i === active}">
          <span class="code">${c.c}</span>
          <span class="title">${esc(c.t)}<span class="fam">${esc(D.families[c.f] || "")}</span></span></li>`).join("")
      : `<li class="none" role="option" aria-disabled="true">No programs match. Try fewer words or a CIP code.</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", items.length ? "opt-0" : "");
  }

  function moveActive(delta) {
    if (!current.length) return;
    active = (active + delta + current.length) % current.length;
    list.querySelectorAll("li[role=option]").forEach((li, i) => li.setAttribute("aria-selected", i === active));
    const li = list.querySelector(`#opt-${active}`);
    if (li) { li.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", li.id); }
  }

  input.addEventListener("input", () => showSuggestions(search(input.value)));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter" && active >= 0 && current[active]) { e.preventDefault(); choose(current[active].c); }
    else if (e.key === "Escape") { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-cip]");
    if (li) { e.preventDefault(); choose(li.dataset.cip); }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".combo")) { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
    const ex = e.target.closest("[data-cip].link");
    if (ex) choose(ex.dataset.cip);
  });

  function choose(code) {
    const c = byCode.get(code);
    if (!c) return;
    state.cip = c;
    state.open.clear();
    input.value = `${c.t} (${c.c})`;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    history.replaceState(null, "", "#cip=" + c.c);
    setBriefOpen(false);
    render();
    $("#progbar-title").textContent = c.t;
    updateBar();
  }

  $("#incl-teach").addEventListener("change", () => { if (state.cip) render(); });

  // ---------------------------------------------------------------- occupations for a program
  function occupationsFor(c, includeTeaching) {
    const socs = D.xwalk[c.c] || [];
    const all = socs.map((soc) => ({ soc, ...D.occ[soc] })).filter((o) => o.t);
    const shown = includeTeaching ? all : all.filter((o) => !isTeaching(o.soc));
    return { shown, hiddenTeaching: all.length - shown.length };
  }

  function summarize(occs) {
    // Several detailed occupations can share one BLS group figure; count each BLS row once.
    const seen = new Set();
    const withB = occs.filter((o) => o.b && !seen.has(o.b.code) && seen.add(o.b.code));
    const s = { n: occs.length, nB: withB.length };
    if (!withB.length) return s;
    const e0 = withB.reduce((a, o) => a + (o.b.e0 || 0), 0);
    const e1 = withB.reduce((a, o) => a + (o.b.e1 || 0), 0);
    s.emp = thousands(e0);
    s.growth = e0 ? ((e1 - e0) / e0) * 100 : null;
    s.openings = thousands(withB.reduce((a, o) => a + (o.b.open || 0), 0));
    const wages = withB.filter((o) => o.b.wage != null).map((o) => o.b.wage).sort((a, b) => a - b);
    s.wageMin = wages[0];
    s.wageMax = wages[wages.length - 1];
    s.wageMid = wages.length ? wages[Math.floor((wages.length - 1) / 2)] : null;
    s.faster = withB.filter((o) => BLS.allChg != null && o.b.chg > BLS.allChg).length;
    return s;
  }

  // ---------------------------------------------------------------- render
  const COLS = [
    { key: "title", label: "Occupation", get: (o) => o.t },
    ...(BLS ? [
      { key: "edu", label: "Typical entry education", get: (o) => (o.b && o.b.edu) || "" },
      { key: "wage", label: "Median wage", num: true, get: (o) => (o.b ? o.b.wage : null) },
      { key: "chg", label: `Growth ${yearsLabel()}`, num: true, get: (o) => (o.b ? o.b.chg : null) },
      { key: "open", label: "Openings / yr", num: true, get: (o) => (o.b ? o.b.open : null) },
    ] : []),
    { key: "jz", label: "Preparation", get: (o) => (o.o ? o.o.jz : null) },
  ];
  // Preparation is a column in the table only. The phone cards leave it out (it is in each occupation's details),
  // so the phone sort menu leaves it out too, unless the list is already sorted by it.
  const phoneSortCols = () => COLS.filter((col) => col.key !== "jz" || state.sortKey === "jz");

  function sortOccs(occs) {
    const col = COLS.find((c) => c.key === state.sortKey) || COLS[0];
    return [...occs].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * state.sortDir;
    });
  }

  function cell(col, o) {
    const b = o.b;
    // data-label repeats the column heading, taken from COLS, for the stacked phone layout.
    const at = `class="c-${col.key}" data-label="${esc(col.label)}"`;
    const atNum = `class="num c-${col.key}" data-label="${esc(col.label)}"`;
    switch (col.key) {
      case "title": {
        const openNow = state.open.has(o.soc);
        return `<td class="c-title"><button class="occ-title" aria-expanded="${openNow}" data-soc="${o.soc}">
          <span class="chev" aria-hidden="true">&#9656;</span>${esc(o.t)}</button>
          <span class="soc">SOC ${o.soc}${b && b.broad ? ` &middot; BLS figures are for group ${b.code}` : ""}</span></td>`;
      }
      case "edu": return `<td ${at}>${b && b.edu ? esc(b.edu) : '<span class="na">Not available</span>'}</td>`;
      case "wage": return `<td ${atNum}>${b && b.wage != null ? fmtMoney(b) : '<span class="na">&ndash;</span>'}</td>`;
      case "chg": {
        if (!b || b.chg == null) return `<td ${atNum}><span class="na">&ndash;</span></td>`;
        const cls = BLS.allChg != null ? (b.chg > BLS.allChg ? "up" : b.chg < 0 ? "down" : "") : "";
        return `<td ${atNum}><span class="${cls}">${fmtPct(b.chg)}</span></td>`;
      }
      case "open": return `<td ${atNum}>${b && b.open != null ? fmtInt(thousands(b.open)) : '<span class="na">&ndash;</span>'}</td>`;
      case "jz": return `<td ${at}>${o.o && o.o.jz ? esc(zoneName(o.o.jz)) : '<span class="na">&ndash;</span>'}</td>`;
      default: return "<td></td>";
    }
  }

  function detailRow(o) {
    const d = o.o;
    if (!d) return `<tr class="detail"><td colspan="${COLS.length}">No O*NET detail for this occupation.</td></tr>`;
    const link = `https://www.onetonline.org/link/summary/${d.code}`;
    return `<tr class="detail"><td colspan="${COLS.length}"><div class="detail-grid">
      <div>
        <h4>What the work involves</h4><p>${esc(d.d)}</p>
        ${d.tasks.length ? `<h4>Core tasks</h4><ul>${d.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      </div>
      <div>
        ${d.skills.length ? `<h4>Most important skills</h4><div class="chips">${d.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>` : ""}
        ${d.tech.length ? `<h4>Tools employers ask for</h4><div class="chips">${d.tech.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>` : ""}
        ${d.jz ? `<h4>Preparation</h4><p>${esc(zoneName(d.jz))} (O*NET Job Zone ${d.jz})</p>` : ""}
        <p><a href="${link}" target="_blank" rel="noopener">Full profile on O*NET OnLine</a></p>
      </div></div></td></tr>`;
  }

  function render() {
    const c = state.cip;
    const incl = $("#incl-teach").checked;
    const { shown, hiddenTeaching } = occupationsFor(c, incl);
    const s = summarize(shown);
    const fam = D.families[c.f] || "";

    let html = `<div class="program">
      <div>
        <div class="meta">CIP ${c.c} &middot; ${esc(fam)}</div>
        <h2>${esc(c.t)}</h2>
        <p class="def">${esc(c.d)}</p>
      </div>
      <button id="make-brief" class="btn btn-primary btn-go">Generate conversation brief${ARROW}</button>
    </div>`;

    if (!shown.length) {
      html += `<div class="no-match"><strong>No occupations to show.</strong> ${hiddenTeaching
        ? `This program maps only to postsecondary teaching roles. Check &ldquo;Include postsecondary teaching roles&rdquo; to see them.`
        : `The federal crosswalk lists no direct occupational match for this program. That is common for general,
           interdisciplinary, and &ldquo;Other&rdquo; programs.`}</div>`;
      $("#results").innerHTML = html;
      bindResults();
      return;
    }

    if (BLS && s.nB) {
      // One figure when the lowest and highest wage round to the same thousand; a dash when no wage is reported.
      const wLo = s.wageMin == null ? null : fmtInt(s.wageMin / 1000);
      const wHi = s.wageMax == null ? null : fmtInt(s.wageMax / 1000);
      const wageValue = wLo == null ? '<span class="na">&ndash;</span>' : `$${wLo}k${wHi !== wLo ? `&ndash;${wHi}k` : ""}`;
      // The heading matches what is under it: one occupation or one figure is a wage, a range is wages.
      const wageLabel = s.n === 1 || (wLo != null && wHi === wLo) ? "Median wage" : "Median wages";
      html += `<p class="group-label"><span class="topic">Summary</span>
        ${s.n === 1 ? "The occupation below, national figures" : "The occupations below taken together, national figures"}</p>
      <div class="tiles">
        <div class="tile"><div class="label">Occupations</div><div class="value">${s.n}</div>
          <div class="sub">${hiddenTeaching ? `${hiddenTeaching} teaching role${hiddenTeaching > 1 ? "s" : ""} hidden` : "in the federal crosswalk"}</div></div>
        <div class="tile"><div class="label">Projected growth</div><div class="value">${fmtPct(s.growth)}</div>
          <div class="sub">${yearsLabel()}; all occupations ${fmtPct(BLS.allChg)}</div></div>
        <div class="tile"><div class="label">Openings per year</div><div class="value">${fmtInt(s.openings)}</div>
          <div class="sub">national, growth plus replacement</div></div>
        <div class="tile"><div class="label">${wageLabel}</div><div class="value">${wageValue}</div>
          <div class="sub">all occupations $${fmtInt(BLS.allWage)}</div></div>
      </div>`;
    }

    const sorted = sortOccs(shown);
    html += `<div class="table-head"><h3>Occupations connected to this program</h3>
      <span class="meta">${shown.length} shown${hiddenTeaching ? ` &middot; ${hiddenTeaching} postsecondary teaching role${hiddenTeaching > 1 ? "s" : ""} hidden` : ""}
      &middot; select a title for details</span></div>
      <div class="sort-phone"><label for="sort-phone">Sort by</label>
        <select id="sort-phone">${phoneSortCols().map((col) => `<option value="${col.key}"${state.sortKey === col.key ? " selected" : ""}>${esc(col.label)}</option>`).join("")}</select></div>
      <div class="table-scroll"><table class="occ"><thead><tr>
      ${COLS.map((col) => {
        const on = state.sortKey === col.key;
        const dir = on ? (state.sortDir > 0 ? "ascending" : "descending") : "none";
        return `<th class="${col.num ? "num " : ""}c-${col.key}" aria-sort="${dir}"><button data-sort="${col.key}">${esc(col.label)}
          <span class="arrow" aria-hidden="true">${on ? (state.sortDir > 0 ? "&#9650;" : "&#9660;") : "&#8597;"}</span></button></th>`;
      }).join("")}
      </tr></thead><tbody>
      ${sorted.map((o) => `<tr class="main${state.open.has(o.soc) ? " is-open" : ""}">${COLS.map((col) => cell(col, o)).join("")}</tr>${state.open.has(o.soc) ? detailRow(o) : ""}`).join("")}
      </tbody></table></div>
      <p class="table-source">${BLS ? `Entry education, wage, growth, and openings: BLS Employment Projections ${yearsLabel()}. ` : ""}Preparation and details: O*NET ${esc(D.meta.onetVersion)}.
        <button class="link" type="button" data-jump="sources">See sources</button></p>
      <section class="limits" aria-labelledby="limits-heading">
        <h3 id="limits-heading">What this data cannot tell you</h3>
        <ul>${LIMITS.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </section>`;

    $("#results").innerHTML = html;
    bindResults();
  }

  function bindResults() {
    const mk = $("#make-brief");
    if (mk) mk.addEventListener("click", showBrief);
    document.querySelectorAll("[data-sort]").forEach((btn) => btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = defaultDir(key); }
      render();
    }));
    const sortMenu = $("#sort-phone");
    if (sortMenu) sortMenu.addEventListener("change", () => {
      state.sortKey = sortMenu.value;
      state.sortDir = defaultDir(state.sortKey);
      render();
      const again = $("#sort-phone");
      if (again) again.focus();
    });
    document.querySelectorAll(".occ-title").forEach((btn) => btn.addEventListener("click", () => {
      const soc = btn.dataset.soc;
      state.open.has(soc) ? state.open.delete(soc) : state.open.add(soc);
      render();
      const again = document.querySelector(`.occ-title[data-soc="${soc}"]`);
      if (again) again.focus();
    }));
  }

  // ---------------------------------------------------------------- conversation brief
  const GRAD = /master|doctoral|professional degree/i;
  const NO_DEGREE = /high school|no formal|some college/i;

  function topCounts(lists, n) {
    const counts = new Map();
    lists.flat().forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map((x) => x[0]);
  }

  // The tools most often listed first across this program's occupations (O*NET order puts in-demand,
  // field-specific tools first and office software last).
  function distinctiveTools(occs) {
    const common = new Set(D.meta.commonTech || []);
    const lists = occs.filter((o) => o.o).map((o) => o.o.tech.filter((t) => !common.has(t)));
    const score = new Map();
    lists.forEach((l) => l.slice(0, 3).forEach((t, i) => score.set(t, (score.get(t) || 0) + (3 - i))));
    return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map((x) => x[0]);
  }

  // The brief's wage sentence. One wage is a wage, not a range, and no wage is no sentence.
  function wageSentence(s, withB) {
    if (s.wageMin == null) return "";
    const more = withB.some((o) => o.b.wage_top) ? " or more" : "";
    if (s.wageMin === s.wageMax) return ` The median annual wage is $${fmtInt(s.wageMin)}${more}.`;
    return ` Median annual wages range from $${fmtInt(s.wageMin)} to $${fmtInt(s.wageMax)}${more}.`;
  }

  function buildBrief() {
    const c = state.cip;
    const incl = $("#incl-teach").checked;
    const { shown, hiddenTeaching } = occupationsFor(c, incl);
    const s = summarize(shown);
    const withB = shown.filter((o) => o.b);
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const sections = [];

    sections.push({ h: "The program", p: [c.d] });

    // Where graduates may go
    const where = { h: "Where graduates may go", p: [], ul: [] };
    if (!shown.length) {
      where.p.push("The federal CIP-to-SOC crosswalk lists no direct occupational match for this program" +
        (hiddenTeaching ? " other than postsecondary teaching roles." : "."));
    } else {
      where.p.push(`The federal CIP-to-SOC crosswalk connects this program to ${s.n} occupation${s.n > 1 ? "s" : ""}` +
        (hiddenTeaching ? ` (${hiddenTeaching} postsecondary teaching role${hiddenTeaching > 1 ? "s" : ""} left out).` : "."));
      if (BLS && s.nB) {
        const dir = s.growth >= 0 ? "grow" : "decline";
        where.p.push(`Together they employ about ${fmtInt(s.emp)} people nationally and are projected to ${dir} ` +
          `${Math.abs(s.growth).toFixed(1)}% from ${BLS.years[0]} to ${BLS.years[1]}, compared with ${fmtPct(BLS.allChg)} ` +
          `for all occupations. They offer about ${fmtInt(s.openings)} openings a year from growth and replacement.` +
          wageSentence(s, withB));
        const top = [...withB].sort((a, b) => (b.b.open || 0) - (a.b.open || 0)).slice(0, 5);
        where.p.push("The largest by annual openings:");
        top.forEach((o) => where.ul.push(`${o.t}: about ${fmtInt(thousands(o.b.open))} openings a year, ` +
          `${fmtPct(o.b.chg)} growth, ${fmtMoney(o.b)} median wage` + (o.b.edu ? `; typically ${o.b.edu.toLowerCase()} to enter` : "")));
      } else {
        sortOccs(shown).slice(0, 8).forEach((o) => where.ul.push(o.o && o.o.jz ? `${o.t} (${zoneName(o.o.jz).toLowerCase()})` : o.t));
        if (shown.length > 8) where.ul.push(`and ${shown.length - 8} more`);
      }
    }
    sections.push(where);

    // Questions
    const q = [];
    if (!shown.length) {
      q.push("With no direct occupational match, how will we describe outcomes to students and families?");
    } else {
      q.push(shown.length === 1
        ? "Do our graduates actually enter this occupation, and how do we know (first-destination surveys, alumni records, employer partners)?"
        : "Which of these occupations do our graduates actually enter, and how do we know (first-destination surveys, alumni records, employer partners)?");
      if (shown.length > 12) q.push(`This program connects to ${shown.length} occupations. Which two or three pathways will we design the curriculum and marketing around?`);
      if (BLS && s.nB && BLS.allChg != null) {
        q.push(s.growth > BLS.allChg
          ? "National demand is projected to grow faster than average. Is that true in our region, and are nearby institutions already responding?"
          : "National growth is at or below the average for all occupations. What makes this program worth offering here: regional demand, mission, or its role as a feeder for other programs?");
        const grad = withB.filter((o) => o.b.edu && GRAD.test(o.b.edu)).length;
        const noDeg = withB.filter((o) => o.b.edu && NO_DEGREE.test(o.b.edu)).length;
        if (grad / s.nB >= 0.4) q.push(`${grad} of these ${s.nB} occupations typically require a graduate degree to enter. Do we offer, or partner for, the next credential?`);
        if (noDeg / s.nB >= 0.4) q.push(`${noDeg} of these ${s.nB} occupations do not typically require a degree to enter. What advantage does our credential give graduates in pay or advancement?`);
        if (BLS.allWage && s.wageMid && s.wageMid < BLS.allWage) q.push("The typical wage in these occupations is below the median for all occupations. How do we help graduates move toward the higher-paying roles on this list?");
      }
      const skills = topCounts(shown.filter((o) => o.o).map((o) => o.o.skills.slice(0, 4)), 3);
      if (skills.length === 3) q.push(`O*NET lists ${skills[0]}, ${skills[1]}, and ${skills[2]} among the most important skills across these roles. Where does the curriculum build and assess them?`);
      const tech = distinctiveTools(shown);
      if (tech.length >= 2) q.push(`Employers in these roles use tools such as ${tech.length === 3
        ? `${tech[0]}, ${tech[1]}, and ${tech[2]}` : `${tech[0]} and ${tech[1]}`}. Do students get hands-on time with them?`);
    }
    q.push("What do regional job postings, employers, and advisory boards tell us that national data cannot?");
    sections.push({ h: "Questions for the conversation", ul: q });

    // Caveats
    const cav = [...LIMITS];
    if (hiddenTeaching && !incl) cav.push("Postsecondary teaching roles were left out. Include them in the explorer if faculty pathways matter for this program.");
    if (!BLS) cav.push("BLS projections were not loaded in this copy of the explorer, so growth, openings, wages, and entry education are not included.");
    sections.push({ h: "What this data cannot tell you", ul: cav });

    const src = ["NCES, CIP 2020 and the CIP 2020 to SOC 2018 crosswalk (nces.ed.gov/ipeds/cipcode)"];
    if (BLS) src.push(`U.S. Bureau of Labor Statistics, Employment Projections ${BLS.years[0]}–${BLS.years[1]} (bls.gov/emp)`);
    src.push(`O*NET ${D.meta.onetVersion} Database, U.S. Department of Labor, Employment and Training Administration, used under CC BY 4.0`);
    sections.push({ h: "Sources", ul: src });

    return {
      title: `${c.t} (CIP ${c.c})`,
      prepared: `Conversation brief prepared ${today} from public data. A starting point for discussion, not a feasibility study.`,
      sections,
    };
  }

  function briefToHTML(b) {
    return `<h1>${esc(b.title)}</h1><p class="prepared">${esc(b.prepared)}</p>` + b.sections.map((s) =>
      `<h2>${esc(s.h)}</h2>${(s.p || []).map((p) => `<p>${esc(p)}</p>`).join("")}` +
      (s.ul && s.ul.length ? `<ul>${s.ul.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "")).join("");
  }

  function briefToMarkdown(b) {
    return `# ${b.title}\n\n_${b.prepared}_\n\n` + b.sections.map((s) =>
      `## ${s.h}\n\n${(s.p || []).map((p) => p + "\n\n").join("")}` +
      (s.ul && s.ul.length ? s.ul.map((x) => `- ${x}`).join("\n") + "\n\n" : "")).join("");
  }

  // Opening the brief hides the page's own limits block, because the brief carries the same limits.
  function setBriefOpen(open) {
    $("#brief-panel").hidden = !open;
    $("#results").classList.toggle("brief-open", open);
  }

  let lastBrief = null;
  function showBrief() {
    lastBrief = buildBrief();
    $("#brief").innerHTML = briefToHTML(lastBrief);
    const panel = $("#brief-panel");
    setBriefOpen(true);
    history.replaceState(null, "", "#cip=" + state.cip.c + "&brief=1");
    panel.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }

  $("#brief-copy").addEventListener("click", async (e) => {
    const text = briefToMarkdown(lastBrief);
    try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied"; }
    catch { e.target.textContent = "Copy failed"; }
    setTimeout(() => (e.target.textContent = "Copy text"), 1800);
  });
  $("#brief-download").addEventListener("click", () => {
    const blob = new Blob([briefToMarkdown(lastBrief)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brief-cip-${state.cip.c}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#brief-print").addEventListener("click", () => window.print());
  $("#brief-close").addEventListener("click", () => {
    setBriefOpen(false);
    history.replaceState(null, "", "#cip=" + state.cip.c);
  });

  // ---------------------------------------------------------------- bar that stays on screen
  // Shown only when a program is chosen and the search panel has scrolled out of view.
  const bar = $("#progbar");
  const searchPanel = $(".search-panel");
  function updateBar() {
    const show = !!state.cip && searchPanel.getBoundingClientRect().bottom < 0;
    if (bar.hidden === show) bar.hidden = !show;
  }
  window.addEventListener("scroll", updateBar, { passive: true });
  window.addEventListener("resize", updateBar);
  $("#progbar-brief").addEventListener("click", showBrief);
  $("#progbar-change").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    input.focus({ preventScroll: true });
    input.select();
  });
  // In-page jumps that leave the address alone, so a shared #cip link keeps working.
  document.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump]");
    const target = jump && document.getElementById(jump.dataset.jump);
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  });

  // ---------------------------------------------------------------- footer and startup
  function renderFooter() {
    const m = D.meta;
    $("#sources").innerHTML = `
      <h2>Sources</h2>
      <ul>
        <li>National Center for Education Statistics, <a href="https://nces.ed.gov/ipeds/cipcode/">Classification of Instructional Programs (CIP) 2020</a> and the CIP 2020 to SOC 2018 crosswalk.</li>
        ${BLS ? `<li>U.S. Bureau of Labor Statistics, <a href="https://www.bls.gov/emp/">Employment Projections</a> ${BLS.years[0]}&ndash;${BLS.years[1]}: employment, growth, openings, median wages, and typical entry education.</li>` : ""}
        <li>This site includes information from the <a href="https://www.onetcenter.org/database.html">O*NET ${m.onetVersion} Database</a>
          by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> license. O*NET&reg; is a trademark of USDOL/ETA.
          Descriptions, tasks, skills, and tools are excerpted and ranked by this site.</li>
      </ul>
      <p>A conversation starter, not a feasibility study. The crosswalk shows occupations a program can prepare people for,
        not where graduates go. Figures are national. Not affiliated with or endorsed by NCES, BLS, or USDOL/ETA.</p>
      <p>Data built ${esc(m.built)}: ${fmtInt(m.cipCount)} programs, ${fmtInt(m.occCount)} occupations.</p>`;
    if (!BLS) {
      const note = $("#bls-note");
      note.hidden = false;
      note.textContent = "Growth, openings, wages, and entry education appear once the BLS Employment Projections file is added and the data is rebuilt (see SOURCES.md).";
    }
  }

  renderFooter();
  const fromHash = (location.hash.match(/cip=([\d.]+)/) || [])[1];
  window.addEventListener("hashchange", () => {
    const code = (location.hash.match(/cip=([\d.]+)/) || [])[1];
    if (code && byCode.has(code) && (!state.cip || state.cip.c !== code)) choose(code);
  });
  const wantBrief = /[#&]brief=1/.test(location.hash);   // read before choose() rewrites the hash
  if (fromHash && byCode.has(fromHash)) {
    choose(fromHash);
    if (wantBrief) showBrief();
  }
})();
