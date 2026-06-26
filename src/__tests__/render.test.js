/**
 * @jest-environment jsdom
 */
'use strict';

const render = require('../render');
const {
  fmtDate, monthLabel, lastNMonths, stars, kpiCard,
  barRow, complianceBar, stackBarRow, trendChart,
  followUpFeed, recentTable, recordTable,
  coverageBlock, presenceBlock, serviceCompletionBlock,
  renderLeadership, renderManager, renderBreakdownSection,
} = render;

const { PASS_ITEM, FAIL_ITEM, WARN_ITEM, BLANK_ITEM, NOT_HOME_ITEM } = require('./fixtures');

function parseHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

// ── fmtDate ──────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  test('returns dash for null', () => {
    expect(fmtDate(null)).toBe('—');
  });

  test('returns dash for empty string', () => {
    expect(fmtDate('')).toBe('—');
  });

  test('returns dash for invalid date string', () => {
    expect(fmtDate('not-a-date')).toBe('—');
  });

  test('returns formatted date string for valid ISO date', () => {
    const result = fmtDate('2024-03-15');
    expect(result).not.toBe('—');
    expect(result).toMatch(/2024/);
  });

  test('returns dash for YYYY/MM/DD slash format (not supported by normalizeDate)', () => {
    expect(fmtDate('2024/06/01')).toBe('—');
  });
});

// ── monthLabel ────────────────────────────────────────────────────────────────

describe('monthLabel', () => {
  test('returns empty string for falsy input', () => {
    expect(monthLabel(null)).toBe('');
    expect(monthLabel('')).toBe('');
  });

  test('returns abbreviated month name for valid key', () => {
    const result = monthLabel('2024-03');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns different labels for different months', () => {
    const jan = monthLabel('2024-01');
    const jul = monthLabel('2024-07');
    expect(jan).not.toBe(jul);
  });
});

// ── lastNMonths ───────────────────────────────────────────────────────────────

describe('lastNMonths', () => {
  test('returns array of correct length', () => {
    expect(lastNMonths(6)).toHaveLength(6);
    expect(lastNMonths(1)).toHaveLength(1);
    expect(lastNMonths(12)).toHaveLength(12);
  });

  test('each entry matches YYYY-MM format', () => {
    const months = lastNMonths(4);
    months.forEach(m => expect(m).toMatch(/^\d{4}-\d{2}$/));
  });

  test('months are in ascending chronological order', () => {
    const months = lastNMonths(4);
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
  });

  test('last entry is the current month', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = lastNMonths(3);
    expect(months[months.length - 1]).toBe(expected);
  });
});

// ── stars ─────────────────────────────────────────────────────────────────────

describe('stars', () => {
  test('returns dash placeholder when avg is null', () => {
    const el = parseHtml(stars(null));
    const span = el.querySelector('.stars');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('—');
  });

  test('contains correct number of filled stars for round value', () => {
    const el = parseHtml(stars(3));
    const span = el.querySelector('.stars');
    const text = span.textContent;
    expect((text.match(/★/g) || []).length).toBe(3);
    expect((text.match(/☆/g) || []).length).toBe(2);
  });

  test('rounds to nearest star', () => {
    const el = parseHtml(stars(4.7));
    const span = el.querySelector('.stars');
    expect((span.textContent.match(/★/g) || []).length).toBe(5);
  });

  test('includes numeric average as text', () => {
    const html = stars(4.2);
    expect(html).toContain('4.2');
  });
});

// ── kpiCard ───────────────────────────────────────────────────────────────────

describe('kpiCard', () => {
  test('renders .num and .label', () => {
    const el = parseHtml(kpiCard(42, 'Total Ride-Alongs', true));
    expect(el.querySelector('.num').textContent).toBe('42');
    expect(el.querySelector('.label').textContent).toBe('Total Ride-Alongs');
  });

  test('adds accent class when third arg is true', () => {
    const el = parseHtml(kpiCard(1, 'Label', true));
    expect(el.querySelector('.kpi').classList.contains('accent')).toBe(true);
  });

  test('omits accent class when third arg is false/undefined', () => {
    const el = parseHtml(kpiCard(1, 'Label', false));
    expect(el.querySelector('.kpi').classList.contains('accent')).toBe(false);
  });

  test('accepts string num value', () => {
    const el = parseHtml(kpiCard('—', 'Score'));
    expect(el.querySelector('.num').textContent).toBe('—');
  });
});

// ── barRow ────────────────────────────────────────────────────────────────────

describe('barRow', () => {
  test('renders .lbl, .barFill, and .barVal', () => {
    const el = parseHtml(barRow('Tampa', 5, 10, 'red'));
    expect(el.querySelector('.lbl').textContent).toBe('Tampa');
    expect(el.querySelector('.barFill')).not.toBeNull();
    expect(el.querySelector('.barVal').textContent).toBe('5');
  });

  test('applies the supplied background color to barFill', () => {
    const el = parseHtml(barRow('A', 3, 10, 'var(--red)'));
    const style = el.querySelector('.barFill').getAttribute('style');
    expect(style).toContain('var(--red)');
  });

  test('escapes special characters in label', () => {
    const el = parseHtml(barRow('<script>', 1, 1, 'blue'));
    expect(el.querySelector('.lbl').textContent).toBe('<script>');
    expect(el.querySelector('.lbl').innerHTML).not.toContain('<script>');
  });

  test('uses minimum width of 2% when value is much smaller than max', () => {
    const html = barRow('X', 1, 10000, 'blue');
    expect(html).toMatch(/width:2%/);
  });

  test('uses 0% width when max is 0', () => {
    const html = barRow('X', 0, 0, 'blue');
    expect(html).toMatch(/width:0%/);
  });
});

// ── complianceBar ─────────────────────────────────────────────────────────────

describe('complianceBar', () => {
  test('shows green color for high compliance', () => {
    const html = complianceBar('Arrived On Time', 95);
    expect(html).toContain('var(--green)');
  });

  test('shows amber color for moderate compliance (70–89)', () => {
    const html = complianceBar('Arrived On Time', 80);
    expect(html).toContain('var(--amber)');
  });

  test('shows fail color for low compliance (below 70)', () => {
    const html = complianceBar('Arrived On Time', 60);
    expect(html).toContain('var(--fail)');
  });

  test('shows muted color for null rate', () => {
    const html = complianceBar('Unknown', null);
    expect(html).toContain('var(--muted)');
  });

  test('displays n/a for null rate', () => {
    const el = parseHtml(complianceBar('Label', null));
    expect(el.querySelector('.barVal').textContent).toBe('n/a');
  });

  test('displays percentage for numeric rate', () => {
    const el = parseHtml(complianceBar('Label', 88));
    expect(el.querySelector('.barVal').textContent).toBe('88%');
  });

  test('border case: exactly 90% is green', () => {
    const html = complianceBar('Label', 90);
    expect(html).toContain('var(--green)');
  });

  test('border case: exactly 70% is amber', () => {
    const html = complianceBar('Label', 70);
    expect(html).toContain('var(--amber)');
  });
});

// ── stackBarRow ───────────────────────────────────────────────────────────────

describe('stackBarRow', () => {
  test('renders "No data" when total is 0', () => {
    const el = parseHtml(stackBarRow({ label: 'Garage', total: 0, complete: 0, missed: 0, notPerformed: 0 }));
    expect(el.textContent).toContain('No data');
  });

  test('renders label', () => {
    const el = parseHtml(stackBarRow({ label: 'Exterior', total: 10, complete: 8, missed: 1, notPerformed: 1 }));
    expect(el.querySelector('.lbl').textContent).toBe('Exterior');
  });

  test('renders total in barVal', () => {
    const el = parseHtml(stackBarRow({ label: 'Ext', total: 12, complete: 10, missed: 1, notPerformed: 1 }));
    expect(el.querySelector('.barVal').textContent).toBe('12');
  });

  test('renders pass segment for complete visits', () => {
    const el = parseHtml(stackBarRow({ label: 'X', total: 4, complete: 4, missed: 0, notPerformed: 0 }));
    expect(el.querySelector('.seg.pass')).not.toBeNull();
  });

  test('renders warn segment for missed visits', () => {
    const el = parseHtml(stackBarRow({ label: 'X', total: 4, complete: 2, missed: 2, notPerformed: 0 }));
    expect(el.querySelector('.seg.warn')).not.toBeNull();
  });

  test('renders fail segment for not-performed visits', () => {
    const el = parseHtml(stackBarRow({ label: 'X', total: 4, complete: 0, missed: 0, notPerformed: 4 }));
    expect(el.querySelector('.seg.fail')).not.toBeNull();
  });

  test('omits segments with 0 count', () => {
    const el = parseHtml(stackBarRow({ label: 'X', total: 5, complete: 5, missed: 0, notPerformed: 0 }));
    expect(el.querySelector('.seg.warn')).toBeNull();
    expect(el.querySelector('.seg.fail')).toBeNull();
  });
});

// ── trendChart ────────────────────────────────────────────────────────────────

describe('trendChart', () => {
  test('renders 8 trend bars', () => {
    const el = parseHtml(trendChart([]));
    expect(el.querySelectorAll('.trendBar')).toHaveLength(8);
  });

  test('renders .trendChart wrapper', () => {
    const el = parseHtml(trendChart([]));
    expect(el.querySelector('.trendChart')).not.toBeNull();
  });

  test('counts items in each bar by date', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    const items = [
      { ...PASS_ITEM, date: thisMonth },
      { ...PASS_ITEM, date: thisMonth },
    ];
    const el = parseHtml(trendChart(items));
    const bars = el.querySelectorAll('.trendBar');
    const lastBar = bars[bars.length - 1];
    expect(lastBar.querySelector('.tval').textContent).toBe('2');
  });
});

// ── followUpFeed ──────────────────────────────────────────────────────────────

describe('followUpFeed', () => {
  test('shows empty message when no items have flags', () => {
    const el = parseHtml(followUpFeed([PASS_ITEM]));
    expect(el.querySelector('.empty')).not.toBeNull();
    expect(el.textContent).toContain('No flagged items');
  });

  test('renders a feedItem for flagged items', () => {
    const el = parseHtml(followUpFeed([FAIL_ITEM]));
    expect(el.querySelector('.feedItem')).not.toBeNull();
  });

  test('shows corrective action note when present', () => {
    const el = parseHtml(followUpFeed([FAIL_ITEM]));
    expect(el.textContent).toContain('Corrective action:');
    expect(el.textContent).toContain('Verbal warning issued');
  });

  test('shows training note when present', () => {
    const el = parseHtml(followUpFeed([FAIL_ITEM]));
    expect(el.textContent).toContain('Training needed:');
  });

  test('shows fail pill for failed checks', () => {
    const el = parseHtml(followUpFeed([FAIL_ITEM]));
    expect(el.querySelector('.pill.fail')).not.toBeNull();
  });

  test('shows warn pill for warn-level issues (WARN_ITEM)', () => {
    const el = parseHtml(followUpFeed([WARN_ITEM]));
    expect(el.querySelector('.pill.warn')).not.toBeNull();
  });

  test('respects limit parameter', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...FAIL_ITEM, id: String(i), date: `2024-03-${String(i + 1).padStart(2, '0')}` }));
    const el = parseHtml(followUpFeed(many, 5));
    expect(el.querySelectorAll('.feedItem')).toHaveLength(5);
  });

  test('employee name appears in feed item header', () => {
    const el = parseHtml(followUpFeed([FAIL_ITEM]));
    expect(el.querySelector('.feedItem .top').textContent).toContain('Bob Tech');
  });
});

// ── recentTable ───────────────────────────────────────────────────────────────

describe('recentTable', () => {
  test('shows empty message when no items', () => {
    const el = parseHtml(recentTable([]));
    expect(el.querySelector('.empty')).not.toBeNull();
  });

  test('renders table with correct headers', () => {
    const el = parseHtml(recentTable([PASS_ITEM]));
    const headers = el.querySelectorAll('th');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Date');
    expect(headerTexts).toContain('Employee');
    expect(headerTexts).toContain('Flags');
  });

  test('shows clean pill for items with no flags', () => {
    const el = parseHtml(recentTable([PASS_ITEM]));
    expect(el.querySelector('.pill.pass')).not.toBeNull();
    expect(el.textContent).toContain('Clean');
  });

  test('shows fail pill for items with failures', () => {
    const el = parseHtml(recentTable([FAIL_ITEM]));
    expect(el.querySelector('.pill.fail')).not.toBeNull();
  });

  test('renders employee name as link', () => {
    const el = parseHtml(recentTable([PASS_ITEM]));
    const link = el.querySelector('a');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('John Smith');
    expect(link.getAttribute('href')).toBe('https://monday.com/boards/1/items/1');
  });

  test('respects limit parameter', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...PASS_ITEM, id: String(i), date: `2024-03-${String(i + 1).padStart(2, '0')}` }));
    const el = parseHtml(recentTable(many, 5));
    // 5 data rows + 1 header row
    expect(el.querySelectorAll('tr')).toHaveLength(6);
  });
});

// ── recordTable ───────────────────────────────────────────────────────────────

describe('recordTable', () => {
  const callOut = { date: '2024-03-10', employee: 'John Smith', requestType: null, reason: 'Sick' };

  test('shows empty message when no items', () => {
    const el = parseHtml(recordTable([], 'No records found.'));
    expect(el.textContent).toContain('No records found.');
  });

  test('renders rows for each item', () => {
    const el = parseHtml(recordTable([callOut, callOut], 'empty', 'reason'));
    // 2 data rows + 1 header row
    expect(el.querySelectorAll('tr')).toHaveLength(3);
  });

  test('shows Reason column header when reasonKey provided', () => {
    const el = parseHtml(recordTable([callOut], 'empty', 'reason'));
    const headers = Array.from(el.querySelectorAll('th')).map(h => h.textContent);
    expect(headers).toContain('Reason');
  });

  test('shows Type column header when no reasonKey provided', () => {
    const el = parseHtml(recordTable([{ ...callOut, requestType: 'PTO' }], 'empty'));
    const headers = Array.from(el.querySelectorAll('th')).map(h => h.textContent);
    expect(headers).toContain('Type');
  });

  test('displays reason field value when reasonKey specified', () => {
    const el = parseHtml(recordTable([callOut], 'empty', 'reason'));
    expect(el.textContent).toContain('Sick');
  });
});

// ── coverageBlock ─────────────────────────────────────────────────────────────

describe('coverageBlock', () => {
  const bd = {
    covered: ['Ant', 'Spiders'],
    counts: { Ant: 5, Spiders: 3 },
    neverCovered: ['Ticks', 'Mice'],
  };

  test('renders a section with the given title', () => {
    const el = parseHtml(coverageBlock('Insects Covered', bd));
    expect(el.querySelector('section')).not.toBeNull();
    expect(el.querySelector('h2').textContent).toBe('Insects Covered');
  });

  test('renders a bar row for each covered item', () => {
    const el = parseHtml(coverageBlock('Insects', bd));
    const barRows = el.querySelectorAll('.barRow');
    expect(barRows.length).toBe(2);
  });

  test('shows never-covered items as warn pills', () => {
    const el = parseHtml(coverageBlock('Insects', bd));
    expect(el.textContent).toContain('Never recorded:');
    const pills = el.querySelectorAll('.pill.warn');
    expect(pills.length).toBe(2);
    expect(el.textContent).toContain('Ticks');
  });

  test('hides never-covered section when all are covered', () => {
    const full = { covered: ['Ant'], counts: { Ant: 1 }, neverCovered: [] };
    const el = parseHtml(coverageBlock('Insects', full));
    expect(el.textContent).not.toContain('Never recorded:');
  });

  test('shows empty message when nothing covered', () => {
    const empty = { covered: [], counts: {}, neverCovered: ['Ant'] };
    const el = parseHtml(coverageBlock('Insects', empty));
    expect(el.querySelector('.empty')).not.toBeNull();
  });
});

// ── presenceBlock ─────────────────────────────────────────────────────────────

describe('presenceBlock', () => {
  test('renders Customer Home vs. Not Home section', () => {
    const el = parseHtml(presenceBlock([PASS_ITEM, PASS_ITEM]));
    expect(el.querySelector('h2').textContent).toContain('Customer Home');
  });

  test('renders two bar rows for home and not-home', () => {
    const el = parseHtml(presenceBlock([PASS_ITEM]));
    const bars = el.querySelectorAll('.barRow');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  test('shows unknown count message when presence data is missing', () => {
    const el = parseHtml(presenceBlock([BLANK_ITEM]));
    expect(el.textContent).toContain('no presence data');
  });

  test('does not show unknown message when all items have presence data', () => {
    const el = parseHtml(presenceBlock([PASS_ITEM, NOT_HOME_ITEM]));
    expect(el.textContent).not.toContain('no presence data');
  });
});

// ── serviceCompletionBlock ────────────────────────────────────────────────────

describe('serviceCompletionBlock', () => {
  test('renders section with correct heading', () => {
    const el = parseHtml(serviceCompletionBlock([PASS_ITEM]));
    expect(el.querySelector('h2').textContent).toContain('Service Completion');
  });

  test('renders a stack legend', () => {
    const el = parseHtml(serviceCompletionBlock([PASS_ITEM]));
    expect(el.querySelector('.stackLegend')).not.toBeNull();
  });

  test('renders stack bar rows for service areas', () => {
    const el = parseHtml(serviceCompletionBlock([PASS_ITEM, FAIL_ITEM]));
    expect(el.querySelectorAll('.stackBarRow').length).toBeGreaterThan(0);
  });
});

// ── renderLeadership ──────────────────────────────────────────────────────────

describe('renderLeadership', () => {
  const items = [PASS_ITEM, FAIL_ITEM, WARN_ITEM];

  test('renders four KPI cards in the grid', () => {
    const el = parseHtml(renderLeadership(items));
    expect(el.querySelectorAll('.kpi')).toHaveLength(4);
  });

  test('first KPI card shows total ride-along count', () => {
    const el = parseHtml(renderLeadership(items));
    const first = el.querySelector('.kpi.accent .num');
    expect(first.textContent).toBe('3');
  });

  test('renders manager comparison table', () => {
    const el = parseHtml(renderLeadership(items));
    expect(el.querySelector('#mgrTable')).not.toBeNull();
  });

  test('renders a needs follow-up section', () => {
    const el = parseHtml(renderLeadership(items));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Needs Follow-Up'))).toBe(true);
  });

  test('excludes incomplete items', () => {
    const { INCOMPLETE_ITEM } = require('./fixtures');
    const el = parseHtml(renderLeadership([PASS_ITEM, INCOMPLETE_ITEM]));
    // Only PASS_ITEM is complete; KPI should show 1
    const num = el.querySelector('.kpi.accent .num');
    expect(num.textContent).toBe('1');
  });
});

// ── renderManager ─────────────────────────────────────────────────────────────

describe('renderManager', () => {
  const all = [PASS_ITEM, FAIL_ITEM, WARN_ITEM, BLANK_ITEM];

  test('filters to only the specified manager\'s items', () => {
    const el = parseHtml(renderManager(all, 'Jane Manager'));
    // Jane has PASS_ITEM and FAIL_ITEM (2 items)
    const num = el.querySelector('.kpi.accent .num');
    expect(num.textContent).toBe('2');
  });

  test('renders four KPI cards', () => {
    const el = parseHtml(renderManager(all, 'Jane Manager'));
    expect(el.querySelectorAll('.kpi')).toHaveLength(4);
  });

  test('renders employee coverage table', () => {
    const el = parseHtml(renderManager(all, 'Jane Manager'));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Employee Coverage'))).toBe(true);
  });

  test('renders compliance scorecard section', () => {
    const el = parseHtml(renderManager(all, 'Jane Manager'));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Compliance Scorecard'))).toBe(true);
  });

  test('returns empty grid for unknown manager', () => {
    const el = parseHtml(renderManager(all, 'Nobody'));
    const num = el.querySelector('.kpi.accent .num');
    expect(num.textContent).toBe('0');
  });
});

// ── renderBreakdownSection ────────────────────────────────────────────────────

describe('renderBreakdownSection', () => {
  const items = [PASS_ITEM, FAIL_ITEM, WARN_ITEM];

  test('returns empty string when items array is empty', () => {
    const result = renderBreakdownSection('emp-1', '👤', 'John Smith', [], [], 'office');
    expect(result).toBe('');
  });

  test('renders .techBreakdown wrapper', () => {
    const el = parseHtml(renderBreakdownSection('emp-1', '👤', 'John Smith', items, [{ key: 'office', label: 'Office' }], 'manager'));
    expect(el.querySelector('.techBreakdown')).not.toBeNull();
  });

  test('renders the title with icon', () => {
    const el = parseHtml(renderBreakdownSection('emp-1', '👤', 'John Smith', items, [], 'manager'));
    expect(el.querySelector('.techBreakdown h2').textContent).toContain('John Smith');
  });

  test('renders five KPI cards', () => {
    const el = parseHtml(renderBreakdownSection('emp-1', '👤', 'John Smith', items, [], 'manager'));
    expect(el.querySelectorAll('.kpi').length).toBe(5);
  });

  test('includes coverageBlock, presenceBlock, serviceCompletionBlock when dim is employee', () => {
    const el = parseHtml(renderBreakdownSection('emp-1', '👤', 'John Smith', items, [], 'employee'));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Insects Covered'))).toBe(true);
    expect(headings.some(h => h.includes('Customer Home'))).toBe(true);
    expect(headings.some(h => h.includes('Service Completion'))).toBe(true);
  });

  test('omits coverage/presence blocks when dim is not employee', () => {
    const el = parseHtml(renderBreakdownSection('mgr-1', '🏠', 'Test Manager', items, [], 'manager'));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Insects Covered'))).toBe(false);
    expect(headings.some(h => h.includes('Customer Home'))).toBe(false);
  });

  test('renders group breakdown bars for provided groupDims', () => {
    const el = parseHtml(renderBreakdownSection(
      'off-1', '🏢', 'Orlando', items,
      [{ key: 'employee', label: 'Employee' }],
      'office'
    ));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Ride-Alongs by Employee'))).toBe(true);
  });

  test('uses unique ai-related id attributes', () => {
    const html = renderBreakdownSection('my-id', '👤', 'Name', items, [], 'manager');
    expect(html).toContain('id="insight-my-id"');
    expect(html).toContain('id="synopsis-my-id"');
  });

  test('includes call-out and time-off sections for employee dim', () => {
    const callOut = { date: '2024-03-10', employee: 'John Smith', reason: 'Sick' };
    const el = parseHtml(renderBreakdownSection('emp-1', '👤', 'John Smith', items, [], 'employee', [callOut], []));
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent);
    expect(headings.some(h => h.includes('Call Out Detail'))).toBe(true);
    expect(headings.some(h => h.includes('Time Off Requests'))).toBe(true);
  });
});
