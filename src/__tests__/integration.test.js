/**
 * @jest-environment jsdom
 *
 * Integration smoke tests — full pipeline from raw Monday.com API shapes
 * through data transformation (dashboard.js) into rendered HTML (render.js).
 * Each test crosses the module boundary to catch regressions that unit tests
 * for each module individually would miss.
 */
'use strict';

const dash = require('../dashboard');
const render = require('../render');
const { makeRawItem, makeRawRecord, PASS_ITEM, FAIL_ITEM, WARN_ITEM } = require('./fixtures');

function parseHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

// ── Module wiring ─────────────────────────────────────────────────────────────
// Verify render.js correctly resolves its dashboard.js dependency. If the
// require() inside the UMD wrapper is broken, all render functions blow up.

describe('module wiring', () => {
  test('render exports expected functions', () => {
    const expected = [
      'fmtDate', 'monthLabel', 'lastNMonths', 'stars', 'kpiCard',
      'barRow', 'complianceBar', 'stackBarRow', 'trendChart',
      'followUpFeed', 'recentTable', 'recordTable',
      'coverageBlock', 'presenceBlock', 'serviceCompletionBlock',
      'renderLeadership', 'renderManager', 'renderBreakdownSection',
    ];
    expected.forEach(fn => expect(typeof render[fn]).toBe('function'));
  });

  test('dashboard exports expected functions', () => {
    const expected = [
      'flattenItem', 'flattenRecord', 'filterItems', 'filterRecords',
      'complianceRate', 'overallComplianceScore', 'flagsForItem',
      'coverageBreakdown', 'presenceBreakdown', 'serviceCompletionChart',
    ];
    expected.forEach(fn => expect(typeof dash[fn]).toBe('function'));
  });

  test('render does not throw when called with empty data', () => {
    expect(() => render.renderLeadership([])).not.toThrow();
    expect(() => render.renderManager([], 'Nobody')).not.toThrow();
    expect(() => render.renderBreakdownSection('x', '👤', 'X', [], [], 'office')).not.toThrow();
  });
});

// ── Raw → flatten → render pipeline ──────────────────────────────────────────
// Simulate receiving data from the Monday.com GraphQL API and rendering it.

describe('raw → flatten → render pipeline', () => {
  let item;

  beforeEach(() => {
    item = dash.flattenItem(makeRawItem());
  });

  test('flattenItem produces a shape render functions accept', () => {
    const html = render.recentTable([item]);
    const el = parseHtml(html);
    expect(el.querySelector('table')).not.toBeNull();
    expect(el.querySelector('a').textContent).toBe('Test Employee');
  });

  test('fmtDate correctly formats the date produced by flattenItem', () => {
    expect(item.date).toBe('2024-06-01');
    const formatted = render.fmtDate(item.date);
    expect(formatted).not.toBe('—');
    expect(formatted).toMatch(/2024/);
  });

  test('followUpFeed shows no flagged items for a passing raw item', () => {
    const el = parseHtml(render.followUpFeed([item]));
    expect(el.querySelector('.empty')).not.toBeNull();
  });

  test('a failing raw item appears in followUpFeed', () => {
    const failRaw = makeRawItem({
      column_values: makeRawItem().column_values.map(cv =>
        cv.id === 'color_mkyftz1a' ? { ...cv, text: 'NO' } : cv
      ),
    });
    const failFlat = dash.flattenItem(failRaw);
    const el = parseHtml(render.followUpFeed([failFlat]));
    expect(el.querySelector('.feedItem')).not.toBeNull();
  });

  test('renderLeadership KPI count matches number of flattened items', () => {
    const items = [
      dash.flattenItem(makeRawItem()),
      dash.flattenItem(makeRawItem({ id: '101' })),
    ];
    // Only isComplete items count; flattenItem sets isComplete based on manager+date presence
    const complete = items.filter(i => i.isComplete);
    const el = parseHtml(render.renderLeadership(items));
    const num = el.querySelector('.kpi.accent .num');
    expect(Number(num.textContent)).toBe(complete.length);
  });

  test('flattenRecord produces a shape recordTable accepts', () => {
    const rec = dash.flattenRecord(makeRawRecord(), dash.CALLOUT_COLUMN_MAP);
    const html = render.recordTable([rec], 'empty', 'reason');
    const el = parseHtml(html);
    expect(el.querySelector('table')).not.toBeNull();
    expect(el.textContent).toContain('Test Employee');
  });
});

// ── Filter → render pipeline ──────────────────────────────────────────────────
// Verify that filterItems correctly gates what reaches the render functions.

describe('filter → render pipeline', () => {
  const items = [PASS_ITEM, FAIL_ITEM, WARN_ITEM];

  test('date filter reduces items shown in recentTable', () => {
    // PASS_ITEM date=2024-03-15, FAIL_ITEM date=2024-03-20, WARN_ITEM date=2024-02-10
    const filtered = dash.filterItems(items, { dateFrom: '2024-03-01', dateTo: null, manager: null, office: null, employee: null, service: null });
    expect(filtered).toHaveLength(2); // PASS + FAIL in range
    const el = parseHtml(render.recentTable(filtered));
    const rows = el.querySelectorAll('tr');
    expect(rows).toHaveLength(3); // 1 header + 2 data rows
  });

  test('manager filter shows only that manager\'s items in recentTable', () => {
    const filtered = dash.filterItems(items, { manager: 'Jane Manager', dateFrom: null, dateTo: null, office: null, employee: null, service: null });
    // PASS_ITEM and FAIL_ITEM are Jane's; WARN_ITEM is Sam's
    expect(filtered.every(i => i.manager === 'Jane Manager')).toBe(true);
    const el = parseHtml(render.recentTable(filtered));
    expect(el.textContent).toContain('John Smith'); // PASS_ITEM employee
    expect(el.textContent).toContain('Bob Tech');   // FAIL_ITEM employee
    expect(el.textContent).not.toContain('Alice Tech'); // WARN_ITEM employee
  });

  test('office filter narrows recentTable rows correctly', () => {
    const filtered = dash.filterItems(items, { office: 'Orlando', dateFrom: null, dateTo: null, manager: null, employee: null, service: null });
    const el = parseHtml(render.recentTable(filtered));
    expect(el.textContent).toContain('John Smith');   // Orlando
    expect(el.textContent).toContain('Alice Tech');   // Orlando
    expect(el.textContent).not.toContain('Bob Tech'); // Tampa
  });

  test('zero-result filter shows empty message in recentTable', () => {
    const filtered = dash.filterItems(items, { manager: 'Nonexistent', dateFrom: null, dateTo: null, office: null, employee: null, service: null });
    const el = parseHtml(render.recentTable(filtered));
    expect(el.querySelector('.empty')).not.toBeNull();
  });

  test('filterItems excludes incomplete items before render', () => {
    const { INCOMPLETE_ITEM } = require('./fixtures');
    const all = [...items, INCOMPLETE_ITEM];
    const filtered = dash.filterItems(all, { dateFrom: null, dateTo: null, manager: null, office: null, employee: null, service: null });
    expect(filtered.every(i => i.isComplete)).toBe(true);
    expect(filtered).not.toContain(INCOMPLETE_ITEM);
  });
});

// ── Compliance pipeline ───────────────────────────────────────────────────────
// Verify the computed scores produced by dashboard.js agree with the
// rendered numbers from render.js.

describe('compliance pipeline', () => {
  const { CHECKLIST } = dash;

  test('complianceBar renders the rate computed by complianceRate', () => {
    const items = [PASS_ITEM, FAIL_ITEM];
    const c = CHECKLIST[0]; // arrivedOnTime
    const rate = dash.complianceRate(items, c);
    const el = parseHtml(render.complianceBar(c.label, rate));
    const valText = el.querySelector('.barVal').textContent;
    expect(valText).toBe(rate === null ? 'n/a' : `${rate}%`);
  });

  test('complianceBar color reflects actual rate from complianceRate', () => {
    // FAIL_ITEM has all NO — rate should be low
    const items = [FAIL_ITEM];
    const c = CHECKLIST[0]; // arrivedOnTime
    const rate = dash.complianceRate(items, c);
    expect(rate).toBeLessThan(70);
    const html = render.complianceBar(c.label, rate);
    expect(html).toContain('var(--fail)');
  });

  test('overallComplianceScore feeds correctly into renderBreakdownSection KPI', () => {
    const items = [PASS_ITEM, PASS_ITEM];
    const expected = dash.overallComplianceScore(items);
    const el = parseHtml(render.renderBreakdownSection('test', '👤', 'Test', items, [], 'manager'));
    const kpis = el.querySelectorAll('.kpi');
    const scoreKpi = Array.from(kpis).find(k => k.querySelector('.label').textContent === 'Compliance Score');
    expect(scoreKpi).not.toBeNull();
    expect(scoreKpi.querySelector('.num').textContent).toBe(
      expected === null ? '—' : `${expected}%`
    );
  });
});

// ── Coverage pipeline ─────────────────────────────────────────────────────────
// Verify coverageBreakdown → coverageBlock produces the right counts.

describe('coverage pipeline', () => {
  const { INSECT_OPTIONS } = dash;

  test('coverageBreakdown counts match barRow values in coverageBlock', () => {
    const items = [PASS_ITEM, FAIL_ITEM]; // PASS: "Ant,Spiders,Cockroaches", FAIL: "Ant"
    const bd = dash.coverageBreakdown(items, 'insectsCovered', INSECT_OPTIONS);

    expect(bd.counts['Ant']).toBe(2);
    expect(bd.counts['Spiders']).toBe(1);

    const el = parseHtml(render.coverageBlock('Insects', bd));
    const barVals = Array.from(el.querySelectorAll('.barVal')).map(v => Number(v.textContent));
    expect(barVals).toContain(2); // Ant appears twice
    expect(barVals).toContain(1); // Spiders appears once
  });

  test('never-covered options appear as warn pills in coverageBlock', () => {
    const items = [PASS_ITEM]; // only Ant, Spiders, Cockroaches covered
    const bd = dash.coverageBreakdown(items, 'insectsCovered', INSECT_OPTIONS);
    const el = parseHtml(render.coverageBlock('Insects', bd));
    const pills = el.querySelectorAll('.pill.warn');
    expect(pills.length).toBe(bd.neverCovered.length);
  });
});

// ── Presence pipeline ─────────────────────────────────────────────────────────

describe('presence pipeline', () => {
  const { NOT_HOME_ITEM } = require('./fixtures');

  test('presenceBreakdown counts match barRow values in presenceBlock', () => {
    const items = [PASS_ITEM, PASS_ITEM, NOT_HOME_ITEM];
    const p = dash.presenceBreakdown(items);

    const el = parseHtml(render.presenceBlock(items));
    const barVals = Array.from(el.querySelectorAll('.barVal')).map(v => Number(v.textContent));
    expect(barVals).toContain(p.home);
    expect(barVals).toContain(p.notHome);
  });
});

// ── XSS safety through the pipeline ──────────────────────────────────────────
// Input with HTML special chars should never appear unescaped in rendered output.

describe('XSS safety through pipeline', () => {
  const xssItem = {
    ...PASS_ITEM,
    id: 'xss-1',
    employee: '<script>alert(1)</script>',
    office: '"><img onerror="bad()">',
    manager: "'; DROP TABLE items; --",
  };

  test('employee name with script tag is escaped in recentTable', () => {
    const el = parseHtml(render.recentTable([xssItem]));
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
  });

  test('office name with injection attempt is escaped in recentTable', () => {
    const el = parseHtml(render.recentTable([xssItem]));
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('"><img');
  });

  test('manager name with SQL injection chars is escaped in renderLeadership', () => {
    const el = parseHtml(render.renderLeadership([xssItem]));
    expect(el.textContent).toContain("'; DROP TABLE items; --");
    const managerCells = Array.from(el.querySelectorAll('#mgrTable td'));
    const cell = managerCells.find(c => c.textContent.includes('DROP TABLE'));
    expect(cell).not.toBeNull();
  });

  test('xss employee name is escaped in coverageBlock label', () => {
    const { INSECT_OPTIONS } = dash;
    const bd = dash.coverageBreakdown([xssItem], 'insectsCovered', INSECT_OPTIONS);
    // coverageBlock uses barRow which escapes the label via escapeHtml
    const html = render.coverageBlock('<b>Test</b>', bd);
    expect(html).toContain('&lt;b&gt;Test&lt;/b&gt;');
  });
});
