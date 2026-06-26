// HTML-generator functions shared between the browser dashboard and the test suite.
// Same UMD wrapper as dashboard.js: requires dashboard exports in Node (CommonJS/Jest),
// reads them from window in the browser (where dashboard.js is already loaded as a <script>).
(function (root) {
  'use strict';

  const _d = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./dashboard')
    : root;

  const {
    escapeHtml, normalizeDate, monthKey,
    complianceRate, overallComplianceScore, avgRating,
    coverageBreakdown, presenceBreakdown, serviceCompletionChart,
    flagsForItem, hasFollowUp,
    thisMonthCount,
    CHECKLIST, RATINGS, INSECT_OPTIONS, PRODUCT_OPTIONS, EQUIPMENT_OPTIONS,
  } = _d;

  // ── Date / time helpers ───────────────────────────────────────────────────────

  function fmtDate(d) {
    const nd = normalizeDate(d);
    if (!nd) return "—";
    const dt = new Date(nd + "T00:00:00");
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function monthLabel(key) {
    if (!key) return "";
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "short" });
  }

  function lastNMonths(n) {
    const out = []; const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }

  // ── Primitive HTML components ─────────────────────────────────────────────────

  function stars(avg) {
    if (avg == null) return '<span class="stars">—</span>';
    const full = Math.round(avg);
    return `<span class="stars">${"★".repeat(full)}${"☆".repeat(5 - full)}</span> <span style="color:var(--muted);font-size:11px;">${avg.toFixed(1)}</span>`;
  }

  function kpiCard(num, label, accent) {
    return `<div class="kpi ${accent ? 'accent' : ''}"><div class="num">${num}</div><div class="label">${label}</div></div>`;
  }

  function barRow(label, value, max, color) {
    const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return `<div class="barRow"><div class="lbl" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
    <div class="barTrack"><div class="barFill" style="width:${pct}%;background:${color}"></div></div>
    <div class="barVal">${value}</div></div>`;
  }

  function complianceBar(label, rate) {
    let color = "var(--green)";
    if (rate == null) color = "var(--muted)";
    else if (rate < 70) color = "var(--fail)";
    else if (rate < 90) color = "var(--amber)";
    return `<div class="barRow"><div class="lbl" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
    <div class="barTrack"><div class="barFill" style="width:${rate == null ? 2 : rate}%;background:${color}"></div></div>
    <div class="barVal">${rate == null ? "n/a" : rate + "%"}</div></div>`;
  }

  function stackBarRow(row) {
    if (!row.total) return `<div class="stackBarRow"><div class="lbl" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</div><div class="sub" style="margin:0;">No data</div></div>`;
    const pc = row.complete / row.total * 100, pm = row.missed / row.total * 100, pn = row.notPerformed / row.total * 100;
    return `<div class="stackBarRow">
    <div class="lbl" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</div>
    <div class="stackBar">
      ${pc ? `<div class="seg pass" style="width:${pc}%" title="Complete: ${row.complete}"></div>` : ""}
      ${pm ? `<div class="seg warn" style="width:${pm}%" title="Missed a few spots: ${row.missed}"></div>` : ""}
      ${pn ? `<div class="seg fail" style="width:${pn}%" title="Not Performed to FL Standards: ${row.notPerformed}"></div>` : ""}
    </div>
    <div class="barVal">${row.total}</div>
  </div>`;
  }

  function trendChart(items) {
    const months = lastNMonths(8);
    const counts = months.map(mk => items.filter(i => monthKey(i.date) === mk).length);
    const max = Math.max(1, ...counts);
    return `<div class="trendChart">${months.map((mk, idx) => `
      <div class="trendBar">
        <div class="tval">${counts[idx] || ""}</div>
        <div class="bar" style="height:${Math.max(4, (counts[idx] / max) * 90)}px;"></div>
        <div class="tlabel">${monthLabel(mk)}</div>
      </div>`).join("")}</div>`;
  }

  // ── Table / feed components ───────────────────────────────────────────────────

  function followUpFeed(items, limit) {
    if (limit === undefined) limit = 15;
    const flagged = items.filter(hasFollowUp).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limit);
    if (!flagged.length) return `<div class="empty">No flagged items 🎉</div>`;
    return flagged.map(i => {
      const flags = flagsForItem(i);
      return `<div class="feedItem">
      <div class="top"><span>${escapeHtml(i.employee)} · ${escapeHtml(i.office || "—")} · ${escapeHtml(i.manager || "—")}</span><span>${fmtDate(i.date)}</span></div>
      <div class="flags">${flags.map(f => `<span class="pill ${f.status === 'fail' ? 'fail' : 'warn'}">${escapeHtml(f.c.label)}</span>`).join("")}</div>
      ${i.correctiveActionsGiven ? `<div class="note"><b>Corrective action:</b> ${escapeHtml(i.correctiveActionsGiven)}</div>` : ""}
      ${i.additionalTrainingNeeded ? `<div class="note"><b>Training needed:</b> ${escapeHtml(i.additionalTrainingNeeded)}</div>` : ""}
      <div style="margin-top:6px;display:flex;align-items:center;gap:10px;">
        <a href="${i.url}" target="_blank">Open in monday →</a>
        <button class="synBtn" onclick="generateItemSynopsis('${i.id}', this)">✨ AI Synopsis</button>
      </div>
      <div class="synBox" id="syn-${i.id}"></div>
    </div>`;
    }).join("");
  }

  function recentTable(items, limit) {
    if (limit === undefined) limit = 20;
    const rows = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limit);
    if (!rows.length) return `<div class="empty">No ride-alongs yet.</div>`;
    return `<div class="scrollx"><table>
    <tr><th>Date</th><th>Employee</th><th>Office</th><th>Service</th><th>Flags</th></tr>
    ${rows.map(i => {
      const flags = flagsForItem(i);
      return `<tr>
        <td>${fmtDate(i.date)}</td>
        <td><a href="${i.url}" target="_blank">${escapeHtml(i.employee)}</a></td>
        <td>${escapeHtml(i.office || "—")}</td>
        <td>${escapeHtml(i.serviceType || "—")}</td>
        <td>${flags.length ? flags.map(f => `<span class="pill ${f.status === 'fail' ? 'fail' : 'warn'}">${escapeHtml(f.c.label)}</span>`).join(" ") : `<span class="pill pass">Clean</span>`}</td>
      </tr>`;
    }).join("")}
  </table></div>`;
  }

  function recordTable(items, emptyMsg, reasonKey) {
    if (!items.length) return `<div class="empty">${emptyMsg}</div>`;
    const rows = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return `<div class="scrollx"><table>
    <tr><th>Date</th><th>Employee</th><th>${reasonKey ? "Reason" : "Type"}</th></tr>
    ${rows.map(i => `<tr>
      <td>${fmtDate(i.date)}</td>
      <td>${escapeHtml(i.employee || "—")}</td>
      <td>${escapeHtml((reasonKey ? i[reasonKey] : i.requestType) || "—")}</td>
    </tr>`).join("")}
  </table></div>`;
  }

  // ── Coverage / presence / service-area section blocks ────────────────────────

  function coverageBlock(title, bd) {
    const max = Math.max(1, ...bd.covered.map(o => bd.counts[o]));
    return `<section><h2>${escapeHtml(title)}</h2>
    <div class="card">
      ${bd.covered.length ? bd.covered.map(o => barRow(o, bd.counts[o], max, "var(--red)")).join("") : `<div class="empty">None recorded yet</div>`}
      ${bd.neverCovered.length ? `<div class="sub" style="margin-top:10px;"><b>Never recorded:</b> ${bd.neverCovered.map(o => `<span class="pill warn">${escapeHtml(o)}</span>`).join(" ")}</div>` : ""}
    </div>
  </section>`;
  }

  function presenceBlock(items) {
    const p = presenceBreakdown(items);
    const max = Math.max(1, p.home, p.notHome);
    return `<section><h2>Customer Home vs. Not Home</h2>
    <div class="card">
      ${barRow("Customer Home", p.home, max, "var(--green)")}
      ${barRow("Customer Not Home", p.notHome, max, "var(--fail)")}
      ${p.unknown ? `<div class="sub" style="margin-top:6px;margin-bottom:0;">${p.unknown} stop${p.unknown === 1 ? "" : "s"} with no presence data recorded</div>` : ""}
    </div>
  </section>`;
  }

  function serviceCompletionBlock(items) {
    const rows = serviceCompletionChart(items);
    return `<section><h2>Service Completion by Area</h2>
    <div class="sub">Excludes visits where a service area was left blank (didn't apply that visit)</div>
    <div class="card">
      <div class="stackLegend"><span><i class="seg pass"></i>Complete</span><span><i class="seg warn"></i>Missed a few spots</span><span><i class="seg fail"></i>Not Performed to FL Standards</span></div>
      ${rows.map(stackBarRow).join("")}
    </div>
  </section>`;
  }

  // ── Main view renderers ───────────────────────────────────────────────────────

  function renderLeadership(all) {
    const complete = all.filter(i => i.isComplete);
    const byManager = {};
    complete.forEach(i => { const m = i.manager || "Unassigned"; (byManager[m] = byManager[m] || []).push(i); });
    const managerNames = Object.keys(byManager).sort((a, b) => byManager[b].length - byManager[a].length);
    const maxByManager = Math.max(1, ...managerNames.map(m => byManager[m].length));

    const byOffice = {};
    complete.forEach(i => { const o = i.office || "Unassigned"; (byOffice[o] = byOffice[o] || []).push(i); });
    const officeNames = Object.keys(byOffice).sort((a, b) => byOffice[b].length - byOffice[a].length);
    const maxByOffice = Math.max(1, ...officeNames.map(o => byOffice[o].length));

    const overall = overallComplianceScore(complete);
    const managerRows = managerNames.map(m => {
      const items = byManager[m];
      const score = overallComplianceScore(items);
      const flagged = items.filter(hasFollowUp).length;
      const last = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      return { m, count: items.length, thisMonth: thisMonthCount(items), score, flagged, last: last ? last.date : null };
    });

    return `
    <div class="grid">
      ${kpiCard(complete.length, "Total Ride-Alongs", true)}
      ${kpiCard(thisMonthCount(complete), "This Month")}
      ${kpiCard(managerNames.length, "Active Managers")}
      ${kpiCard(overall == null ? "—" : overall + "%", "Avg Compliance")}
    </div>
    <section><h2>Ride-Alongs Performed by Manager</h2>
      <div class="sub">Cadence &amp; accountability — who is actually getting in the field</div>
      <div class="card">${managerNames.map(m => barRow(m, byManager[m].length, maxByManager, "var(--red)")).join("")}</div>
    </section>
    <section><h2>Monthly Trend (All Managers)</h2><div class="card">${trendChart(complete)}</div></section>
    <section><h2>Coverage by Office</h2>
      <div class="card">${officeNames.map(o => barRow(o, byOffice[o].length, maxByOffice, "var(--red)")).join("")}</div>
    </section>
    <section><h2>Team Compliance Scorecard</h2>
      <div class="sub">% of applicable ride-alongs scored YES / Complete, across all managers</div>
      <div class="card">${CHECKLIST.map(c => complianceBar(c.label, complianceRate(complete, c))).join("")}</div>
    </section>
    <section><h2>Manager Comparison</h2>
      <div class="card scrollx"><table id="mgrTable">
        <tr><th data-k="m">Manager</th><th data-k="count">Total</th><th data-k="thisMonth">This Mo.</th>
          <th data-k="score">Compliance</th><th data-k="flagged">Flagged</th><th data-k="last">Last Ride-Along</th></tr>
        ${managerRows.map(r => `<tr>
          <td>${escapeHtml(r.m)}</td><td>${r.count}</td><td>${r.thisMonth}</td>
          <td>${r.score == null ? "—" : r.score + "%"}</td>
          <td>${r.flagged ? `<span class="pill warn">${r.flagged}</span>` : "0"}</td>
          <td>${fmtDate(r.last)}</td></tr>`).join("")}
      </table></div>
    </section>
    <section><h2>Needs Follow-Up</h2>
      <div class="sub">Most recent ride-alongs with a failed check, missed spot, or corrective action / training note</div>
      ${followUpFeed(complete)}
    </section>
    <section><h2>All Recent Ride-Alongs</h2>${recentTable(complete)}</section>
  `;
  }

  function renderManager(all, managerName) {
    const mine = all.filter(i => i.isComplete && i.manager === managerName);
    const score = overallComplianceScore(mine);
    const byEmployee = {};
    mine.forEach(i => { (byEmployee[i.employee] = byEmployee[i.employee] || []).push(i); });
    const employeeRows = Object.keys(byEmployee).map(e => {
      const items = byEmployee[e];
      const last = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      return { e, count: items.length, last: last ? last.date : null, office: last ? last.office : "" };
    }).sort((a, b) => (a.last || "").localeCompare(b.last || ""));

    return `
    <div class="aiInsight" id="insight-mgrself">Generating AI insight…</div>
    <div class="grid">
      ${kpiCard(mine.length, "Your Ride-Alongs", true)}
      ${kpiCard(thisMonthCount(mine), "This Month")}
      ${kpiCard(Object.keys(byEmployee).length, "Employees Covered")}
      ${kpiCard(score == null ? "—" : score + "%", "Your Compliance")}
    </div>
    <section><h2>Your Monthly Cadence</h2><div class="card">${trendChart(mine)}</div></section>
    <section><h2>Your Compliance Scorecard</h2>
      <div class="card">${CHECKLIST.map(c => complianceBar(c.label, complianceRate(mine, c))).join("")}</div>
    </section>
    <section><h2>Average Ratings You've Given</h2>
      <div class="card">${RATINGS.map(r => `<div class="barRow"><div class="lbl">${r.label}</div><div>${stars(avgRating(mine, r.key))}</div></div>`).join("")}</div>
    </section>
    <section><h2>Employee Coverage</h2>
      <div class="sub">Sorted oldest ride-along first — who's due for a check-in. Spans every branch you currently or previously covered.</div>
      <div class="card scrollx"><table>
        <tr><th>Employee</th><th>Office</th><th>Ride-Alongs</th><th>Last Visit</th></tr>
        ${employeeRows.map(r => `<tr><td>${escapeHtml(r.e)}</td><td>${escapeHtml(r.office || "—")}</td><td>${r.count}</td><td>${fmtDate(r.last)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No ride-alongs yet</td></tr>`}
      </table></div>
    </section>
    <section><h2>✨ AI Synopsis — All Your Ride-Alongs</h2>
      <div class="sub">Strengths, areas to improve, corrective actions, training needs, and trend over time across your full history</div>
      <div class="synBox aiSynopsis" id="synopsis-mgrself">Generating full synopsis…</div>
    </section>
    <section><h2>Open Follow-Up Items</h2>
      <div class="sub">Your own flagged checks, corrective actions and training notes</div>
      ${followUpFeed(mine)}
    </section>
    <section><h2>Your Recent Ride-Alongs</h2>${recentTable(mine)}</section>
  `;
  }

  function renderBreakdownSection(id, icon, title, items, groupDims, dim, callOuts, timeOff) {
    if (!items.length) return "";
    callOuts = callOuts || [];
    timeOff = timeOff || [];
    const score = overallComplianceScore(items);
    const flaggedCount = items.filter(hasFollowUp).length;

    const groupBlocks = groupDims.map(g => {
      const byVal = {};
      items.forEach(i => { const v = i[g.key] || "Unassigned"; (byVal[v] = byVal[v] || []).push(i); });
      const names = Object.keys(byVal).sort((a, b) => byVal[b].length - byVal[a].length);
      const max = Math.max(1, ...names.map(n => byVal[n].length));
      return `<section><h2>Ride-Alongs by ${escapeHtml(g.label)}</h2>
      <div class="card">${names.map(n => barRow(n, byVal[n].length, max, "var(--red)")).join("")}</div>
    </section>`;
    }).join("");

    const techSections = dim === "employee" ? `
    <div class="focusAreas" id="focus-${id}">Generating focus areas…</div>
    ${coverageBlock("Insects Covered", coverageBreakdown(items, "insectsCovered", INSECT_OPTIONS))}
    ${coverageBlock("Products Covered", coverageBreakdown(items, "productsCovered", PRODUCT_OPTIONS))}
    ${coverageBlock("Equipment Used", coverageBreakdown(items, "equipmentUsed", EQUIPMENT_OPTIONS))}
    ${presenceBlock(items)}
    ${serviceCompletionBlock(items)}
    <section><h2>📋 Call Out Detail</h2>
      <div class="sub">Within the current date range filter</div>
      <div class="card">${recordTable(callOuts, "No call-outs in this range.", "reason")}</div>
    </section>
    <section><h2>🌴 Time Off Requests</h2>
      <div class="sub">Time off is only shown on the technician breakdown, not branch/manager</div>
      <div class="card">${recordTable(timeOff, "No time off requests in this range.")}</div>
    </section>
  ` : "";

    const callOutsKpi = kpiCard(callOuts.length, "Call Outs");

    return `
    <section class="techBreakdown">
      <h2>${icon} ${escapeHtml(title)}</h2>
      <div class="sub">Every ride-along matching the current filters — KPIs, breakdown, and a live AI summary</div>
      <div class="aiInsight" id="insight-${id}">Generating AI insight…</div>
      <div class="grid">
        ${kpiCard(items.length, "Total Ride-Alongs", true)}
        ${kpiCard(thisMonthCount(items), "This Month")}
        ${kpiCard(score == null ? "—" : score + "%", "Compliance Score")}
        ${kpiCard(flaggedCount, "Flagged Items")}
        ${callOutsKpi}
      </div>
      <section><h2>Monthly Cadence</h2><div class="card">${trendChart(items)}</div></section>
      <section><h2>Compliance Breakdown by Category</h2>
        <div class="card">${CHECKLIST.map(c => complianceBar(c.label, complianceRate(items, c))).join("")}</div>
      </section>
      <section><h2>Average Ratings</h2>
        <div class="card">${RATINGS.map(r => `<div class="barRow"><div class="lbl">${r.label}</div><div>${stars(avgRating(items, r.key))}</div></div>`).join("")}</div>
      </section>
      ${groupBlocks}
      ${techSections}
      <section><h2>✨ AI Synopsis — All Ride-Alongs In View</h2>
        <div class="sub">Strengths, areas to improve, corrective actions, training needs, and trend over time — generated from every ride-along currently shown</div>
        <div class="synBox aiSynopsis" id="synopsis-${id}">Generating full synopsis…</div>
      </section>
      <section><h2>Every Flag, Elaborated</h2>
        <div class="sub">Full detail on each flagged check, corrective action, and training note — not just a count</div>
        ${followUpFeed(items, 50)}
      </section>
      <section><h2>Full Ride-Along History</h2>${recentTable(items, 100)}</section>
    </section>
  `;
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  Object.assign(root, {
    fmtDate, monthLabel, lastNMonths, stars, kpiCard,
    barRow, complianceBar, stackBarRow, trendChart,
    followUpFeed, recentTable, recordTable,
    coverageBlock, presenceBlock, serviceCompletionBlock,
    renderLeadership, renderManager, renderBreakdownSection,
  });

})(typeof module !== 'undefined' ? module.exports : (typeof window !== 'undefined' ? window : this));
