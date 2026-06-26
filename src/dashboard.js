// Pure data functions shared between the browser dashboard and the test suite.
// Uses a UMD wrapper so it works as a plain <script> tag (exposes to window) and
// as a CommonJS require() in Jest (exposes via module.exports) without a bundler.
(function (root) {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────

  const COLUMN_MAP = {
    employee: "board_relation_mkyfavcb",
    manager: "lookup_mkyf5c2t", office: "lookup_mkyfjte3",
    date: "date_mkyfk9e2", serviceType: "dropdown_mkyf4abk",
    arrivedOnTime: "color_mkyftz1a", professionalGreeting: "color_mkyfpwv8",
    professionalGreetingRating: "rating_mkyfvenm", properExplanation: "color_mkyfhex6",
    properExplanationRating: "rating_mkyfbgn2", addressedConcerns: "color_mkyfjys8",
    extDeWebbed: "color_mkyf9dc1", extGranular: "color_mkyfdrqk", extPerimeterSpray: "color_mkyfqthm",
    extDust: "color_mm0nh27h", intLivingAreas: "color_mkyfvj0t", intBasement: "color_mkyfs4k5",
    garage: "color_mkyfhyds", uniform: "color_mkyf4rjk", ppe: "color_mkyf8z73",
    vehicleCleanlinessRating: "rating_mkyfw2es", strengthsObserved: "long_text_mkyffrkt",
    areasToImprove: "long_text_mkyfjhdk", correctiveActionsGiven: "long_text_mkyfqbp0",
    additionalTrainingNeeded: "long_text_mkyfwc13", equipmentWorking: "color_mkyg7e4w",
    chemicalsOrganized: "color_mkygkhj2",
    insectsCovered: "dropdown_mkyfj2sj", productsCovered: "dropdown_mkyf654s", equipmentUsed: "dropdown_mkyfw0qs",
  };

  const CALLOUT_COLUMN_MAP = {
    employee: "board_relation_mkw07eht", manager: "lookup_mkw0seqz", office: "lookup_mkw0jrc2",
    requestType: "color_mkx0z6pj", fullDayRange: "timerange_mkx65krk",
    partialStart: "date_mkx6nxyk", partialEnd: "date_mkx6wamm",
    reason: "color_mkxfev8f", notes: "text_mkxxjqfj", status: "status",
  };

  const TIMEOFF_COLUMN_MAP = {
    employee: "board_relation_mkw07eht", manager: "lookup_mkw0seqz", office: "lookup_mkw0jrc2",
    requestType: "color_mkx0z6pj", fullDayRange: "timerange_mkxx5r7k",
    partialStart: "date_mkxxrrqt", partialEnd: "date_mkxxery4", status: "status",
  };

  const CHECKLIST = [
    { key: "arrivedOnTime", label: "Arrived On-Time", pass: ["YES"], fail: ["NO"] },
    { key: "professionalGreeting", label: "Professional Greeting", pass: ["YES"], fail: ["NO"] },
    { key: "properExplanation", label: "Explained Service", pass: ["YES"], fail: ["NO"] },
    { key: "addressedConcerns", label: "Addressed Concerns", pass: ["YES"], fail: ["NO"] },
    { key: "extDeWebbed", label: "Exterior De-Webbed", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "extGranular", label: "Exterior Granular", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "extPerimeterSpray", label: "Exterior Perimeter Spray", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "extDust", label: "Exterior Dust", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "intLivingAreas", label: "Interior Living Areas", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "intBasement", label: "Interior Basement", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "garage", label: "Garage", pass: ["Complete"], fail: ["Not Performed to FL Standards"], warn: ["Missed a few spots"] },
    { key: "uniform", label: "Proper Uniform", pass: ["Yes"], fail: ["Not In FL Uniform"], warn: ["Missing parts"] },
    { key: "ppe", label: "PPE Worn Correctly", pass: ["Yes"], fail: ["No"] },
    { key: "equipmentWorking", label: "Equipment In Working Order", pass: ["YES"], fail: ["NO"] },
    { key: "chemicalsOrganized", label: "Chemicals Clean & Organized", pass: ["YES"], fail: ["NO"] },
  ];

  const RATINGS = [
    { key: "professionalGreetingRating", label: "Professional Greeting" },
    { key: "properExplanationRating", label: "Explanation Quality" },
    { key: "vehicleCleanlinessRating", label: "Vehicle Cleanliness" },
  ];

  const INSECT_OPTIONS = ["Ant", "Spiders", "Stinging Insects", "Cockroaches", "Silverfish", "Mosquitoes", "Rats", "Mice", "Fleas", "Ticks", "Termites", "Occasional Invaders", "Gnats", "Beetles", "Flies", "yellow jackets"];
  const PRODUCT_OPTIONS = ["Demand CS", "Tandem", "Advion Ant", "Advion Roach", "Delta Dust", "Precore2625", "Sentricon in ground", "Sentricon AG", "Glue Boards", "Contrac Blox", "Optiguard Roach", "Optiguard Ant", "Other", "tempo dust", "Crosscheck", "Advance 375"];
  const EQUIPMENT_OPTIONS = ["Backpack Sprayer", "Mosquito Mister", "B&G", "Storm Sprayer", "Spreader", "Electric Duster", "De-Webbing Pole", "RTU / Evo Express", "Excluder", "Gas Auger", "bulb duster"];

  // Service-area checks are the subset of CHECKLIST that have a 3-way warn scale.
  const SERVICE_AREAS = CHECKLIST.filter(c => c.warn);

  // ── Date utilities ────────────────────────────────────────────────────────────

  function normalizeDate(d) {
    if (!d || typeof d !== "string") return null;
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return m[0];
  }

  function monthKey(d) {
    const nd = normalizeDate(d);
    return nd ? nd.slice(0, 7) : null;
  }

  // ── String utilities ──────────────────────────────────────────────────────────

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  // ── Classification & compliance ───────────────────────────────────────────────

  function classify(item, check) {
    const v = item[check.key];
    if (v == null || v === "") return null;
    if (check.pass.includes(v)) return "pass";
    if (check.fail.includes(v)) return "fail";
    if (check.warn && check.warn.includes(v)) return "warn";
    return "warn";
  }

  function complianceRate(items, check) {
    let pass = 0, total = 0;
    items.forEach(i => { const c = classify(i, check); if (c) { total++; if (c === "pass") pass++; } });
    return total ? Math.round((pass / total) * 100) : null;
  }

  function overallComplianceScore(items) {
    const rates = CHECKLIST.map(c => complianceRate(items, c)).filter(r => r != null);
    if (!rates.length) return null;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }

  function categoryStats(items) {
    const total = items.length;
    return CHECKLIST.map(c => {
      let blank = 0;
      items.forEach(i => { const v = i[c.key]; if (v == null || v === "") blank++; });
      return {
        label: c.label,
        passRate: complianceRate(items, c),
        blankCount: blank,
        blankPct: total ? Math.round((blank / total) * 100) : 0,
      };
    });
  }

  function lowScoreCategories(items, threshold) {
    if (threshold === undefined) threshold = 80;
    return categoryStats(items).filter(c => c.passRate != null && c.passRate < threshold).sort((a, b) => a.passRate - b.passRate);
  }

  function highBlankCategories(items, threshold) {
    if (threshold === undefined) threshold = 30;
    return categoryStats(items).filter(c => c.blankPct >= threshold).sort((a, b) => b.blankPct - a.blankPct);
  }

  function avgRating(items, key) {
    const vals = items.map(i => i[key]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // ── Per-item flag helpers ─────────────────────────────────────────────────────

  function flagsForItem(item) {
    return CHECKLIST.map(c => ({ c, status: classify(item, c) })).filter(x => x.status === "fail" || x.status === "warn");
  }

  function hasFollowUp(item) {
    return flagsForItem(item).length > 0 || item.correctiveActionsGiven || item.additionalTrainingNeeded;
  }

  // ── Coverage / presence / service-area breakdowns ────────────────────────────

  function coverageBreakdown(items, key, allOptions) {
    const counts = {};
    allOptions.forEach(o => counts[o] = 0);
    items.forEach(i => {
      const raw = i[key];
      if (!raw) return;
      raw.split(",").map(s => s.trim()).filter(l => l && l !== "NONE").forEach(l => {
        counts[l] = (counts[l] || 0) + 1;
      });
    });
    const covered = Object.keys(counts).filter(o => counts[o] > 0).sort((a, b) => counts[b] - counts[a]);
    const neverCovered = allOptions.filter(o => counts[o] === 0);
    return { counts, covered, neverCovered };
  }

  function customerPresence(item) {
    const known = [item.professionalGreeting, item.properExplanation, item.addressedConcerns].filter(v => v != null && v !== "");
    if (!known.length) return null;
    return known.includes("Customer Not Home") ? "Not Home" : "Home";
  }

  function presenceBreakdown(items) {
    let home = 0, notHome = 0, unknown = 0;
    items.forEach(i => {
      const p = customerPresence(i);
      if (p === "Home") home++; else if (p === "Not Home") notHome++; else unknown++;
    });
    return { home, notHome, unknown };
  }

  function serviceCompletionChart(items) {
    return SERVICE_AREAS.map(c => {
      let complete = 0, missed = 0, notPerformed = 0;
      items.forEach(i => {
        const v = i[c.key];
        if (v == null || v === "") return;
        if (c.pass.includes(v)) complete++;
        else if (c.warn.includes(v)) missed++;
        else if (c.fail.includes(v)) notPerformed++;
      });
      return { label: c.label, complete, missed, notPerformed, total: complete + missed + notPerformed };
    });
  }

  // ── Time helpers ──────────────────────────────────────────────────────────────

  function thisMonthCount(items) {
    const mk = monthKey(new Date().toISOString().slice(0, 10));
    return items.filter(i => monthKey(i.date) === mk).length;
  }

  // ── Data flattening ───────────────────────────────────────────────────────────

  function flattenItem(rawItem) {
    const byId = {};
    for (const cv of rawItem.column_values) {
      if (cv.type === "mirror") byId[cv.id] = cv.display_value;
      else if (cv.type === "board_relation") byId[cv.id] = (cv.linked_items || []).map(li => li.name).join(", ") || null;
      else byId[cv.id] = cv.text;
    }
    const out = { id: rawItem.id, itemName: rawItem.name, url: rawItem.url };
    for (const [key, colId] of Object.entries(COLUMN_MAP)) out[key] = byId[colId] ?? null;
    for (const key of ["professionalGreetingRating", "properExplanationRating", "vehicleCleanlinessRating"]) {
      const v = out[key]; out[key] = (v && v !== "") ? Number(v) : null;
    }
    out.date = normalizeDate(out.date);
    out.isComplete = Boolean(out.date && out.manager && out.employee);
    return out;
  }

  function flattenRecord(rawItem, colMap) {
    const byId = {};
    for (const cv of rawItem.column_values) {
      if (cv.type === "mirror") byId[cv.id] = cv.display_value;
      else if (cv.type === "board_relation") byId[cv.id] = (cv.linked_items || []).map(li => li.name).join(", ") || null;
      else if (cv.type === "timeline") byId[cv.id] = cv.from ? { from: cv.from, to: cv.to } : null;
      else byId[cv.id] = cv.text;
    }
    const out = { id: rawItem.id, itemName: rawItem.name };
    for (const [key, colId] of Object.entries(colMap)) out[key] = byId[colId] ?? null;
    out.date = normalizeDate(out.fullDayRange && out.fullDayRange.from ? out.fullDayRange.from : out.partialStart);
    out.endDate = normalizeDate(out.fullDayRange && out.fullDayRange.to ? out.fullDayRange.to : out.partialEnd);
    return out;
  }

  // ── Filter functions ──────────────────────────────────────────────────────────

  // Filters a ride-along items array; filters is the FILTERS object { manager, office, employee, service, dateFrom, dateTo }.
  function filterItems(items, filters) {
    let result = items.filter(i => i.isComplete);
    if (filters.manager) result = result.filter(i => i.manager === filters.manager);
    if (filters.office) result = result.filter(i => i.office === filters.office);
    if (filters.employee) result = result.filter(i => i.employee === filters.employee);
    if (filters.service) result = result.filter(i => i.serviceType === filters.service);
    if (filters.dateFrom) result = result.filter(i => i.date && i.date >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(i => i.date && i.date <= filters.dateTo);
    return result;
  }

  // Filters call-out / time-off records (no isComplete or service dimension).
  function filterRecords(list, filters) {
    let items = list;
    if (filters.manager) items = items.filter(i => i.manager === filters.manager);
    if (filters.office) items = items.filter(i => i.office === filters.office);
    if (filters.employee) items = items.filter(i => i.employee === filters.employee);
    if (filters.dateFrom) items = items.filter(i => i.date && i.date >= filters.dateFrom);
    if (filters.dateTo) items = items.filter(i => i.date && i.date <= filters.dateTo);
    return items;
  }

  // ── AI text helpers ───────────────────────────────────────────────────────────

  function extractAiText(res) {
    return (typeof res === "string") ? res
      : (res && typeof res.text === "string") ? res.text
      : (res && res.content) ? (Array.isArray(res.content) ? res.content.map(c => c.text || "").join(" ") : String(res.content))
      : "";
  }

  function formatSynopsis(text) {
    const headers = ["Strengths Observed", "Areas to Improve", "Corrective Actions Given", "Additional Training Needed", "Trend / Areas of Concern Over Time"];
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    return lines.map(line => {
      const h = headers.find(h => line.toLowerCase().startsWith(h.toLowerCase()));
      if (h) {
        const rest = line.slice(h.length).replace(/^[:\-\s]+/, "");
        return `<h4>${escapeHtml(h)}</h4>` + (rest ? `<p>${escapeHtml(rest)}</p>` : "");
      }
      return `<p>${escapeHtml(line)}</p>`;
    }).join("");
  }

  // ── Misc data helpers ─────────────────────────────────────────────────────────

  function uniqueSorted(items, key) {
    return Array.from(new Set(items.map(i => i[key]).filter(Boolean))).sort();
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  Object.assign(root, {
    COLUMN_MAP, CALLOUT_COLUMN_MAP, TIMEOFF_COLUMN_MAP,
    CHECKLIST, RATINGS, INSECT_OPTIONS, PRODUCT_OPTIONS, EQUIPMENT_OPTIONS,
    normalizeDate, monthKey, escapeHtml,
    classify, complianceRate, overallComplianceScore,
    categoryStats, lowScoreCategories, highBlankCategories,
    avgRating, flagsForItem, hasFollowUp,
    coverageBreakdown, customerPresence, presenceBreakdown, serviceCompletionChart,
    thisMonthCount, flattenItem, flattenRecord,
    filterItems, filterRecords,
    extractAiText, formatSynopsis, uniqueSorted,
  });

})(typeof module !== 'undefined' ? module.exports : (typeof window !== 'undefined' ? window : this));
