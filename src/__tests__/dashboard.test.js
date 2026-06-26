'use strict';

const {
  CHECKLIST, INSECT_OPTIONS, PRODUCT_OPTIONS, EQUIPMENT_OPTIONS,
  normalizeDate, monthKey, escapeHtml,
  classify, complianceRate, overallComplianceScore,
  categoryStats, lowScoreCategories, highBlankCategories,
  avgRating, flagsForItem, hasFollowUp,
  coverageBreakdown, customerPresence, presenceBreakdown, serviceCompletionChart,
  flattenItem, flattenRecord, CALLOUT_COLUMN_MAP,
  filterItems, filterRecords,
  extractAiText, formatSynopsis, uniqueSorted,
} = require('../dashboard');

const {
  PASS_ITEM, FAIL_ITEM, WARN_ITEM, BLANK_ITEM, NOT_HOME_ITEM, INCOMPLETE_ITEM,
  makeRawItem, makeRawRecord,
} = require('./fixtures');

// ── normalizeDate ─────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  test('extracts YYYY-MM-DD from an ISO datetime string', () => {
    expect(normalizeDate('2024-03-15T10:30:00Z')).toBe('2024-03-15');
  });

  test('returns a plain date string unchanged', () => {
    expect(normalizeDate('2024-03-15')).toBe('2024-03-15');
  });

  test('returns null for null', () => {
    expect(normalizeDate(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(normalizeDate('')).toBeNull();
  });

  test('returns null for non-date strings', () => {
    expect(normalizeDate('not a date')).toBeNull();
    expect(normalizeDate('15-03-2024')).toBeNull();
  });

  test('returns null for non-string input', () => {
    expect(normalizeDate(20240315)).toBeNull();
    expect(normalizeDate({})).toBeNull();
  });
});

// ── monthKey ──────────────────────────────────────────────────────────────────

describe('monthKey', () => {
  test('returns YYYY-MM from a date string', () => {
    expect(monthKey('2024-03-15')).toBe('2024-03');
  });

  test('returns YYYY-MM from an ISO datetime', () => {
    expect(monthKey('2024-12-01T00:00:00Z')).toBe('2024-12');
  });

  test('returns null for invalid input', () => {
    expect(monthKey(null)).toBeNull();
    expect(monthKey('')).toBeNull();
    expect(monthKey('invalid')).toBeNull();
  });
});

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes all five special HTML characters', () => {
    expect(escapeHtml('<b>Hello & "World" \'s</b>')).toBe('&lt;b&gt;Hello &amp; &quot;World&quot; &#39;s&lt;/b&gt;');
  });

  test('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('returns plain string unchanged', () => {
    expect(escapeHtml('No special chars')).toBe('No special chars');
  });
});

// ── classify ──────────────────────────────────────────────────────────────────

describe('classify', () => {
  const yesNoCheck = CHECKLIST.find(c => c.key === 'arrivedOnTime');    // YES/NO only
  const threeWayCheck = CHECKLIST.find(c => c.key === 'extDeWebbed');   // pass/warn/fail

  test('returns "pass" for a passing value', () => {
    expect(classify({ arrivedOnTime: 'YES' }, yesNoCheck)).toBe('pass');
  });

  test('returns "fail" for a failing value', () => {
    expect(classify({ arrivedOnTime: 'NO' }, yesNoCheck)).toBe('fail');
  });

  test('returns null for null value (blank)', () => {
    expect(classify({ arrivedOnTime: null }, yesNoCheck)).toBeNull();
  });

  test('returns null for empty string (blank)', () => {
    expect(classify({ arrivedOnTime: '' }, yesNoCheck)).toBeNull();
  });

  test('returns "warn" for an explicit warn value', () => {
    expect(classify({ extDeWebbed: 'Missed a few spots' }, threeWayCheck)).toBe('warn');
  });

  test('returns "fail" for a fail value on a 3-way check', () => {
    expect(classify({ extDeWebbed: 'Not Performed to FL Standards' }, threeWayCheck)).toBe('fail');
  });

  test('returns "warn" for an unrecognized value (defensive fallback)', () => {
    expect(classify({ extDeWebbed: 'Something unexpected' }, threeWayCheck)).toBe('warn');
  });
});

// ── complianceRate ────────────────────────────────────────────────────────────

describe('complianceRate', () => {
  const check = CHECKLIST.find(c => c.key === 'arrivedOnTime');

  test('returns 100 when all items pass', () => {
    const items = [PASS_ITEM, PASS_ITEM];
    expect(complianceRate(items, check)).toBe(100);
  });

  test('returns 0 when all items fail', () => {
    const items = [FAIL_ITEM, FAIL_ITEM];
    expect(complianceRate(items, check)).toBe(0);
  });

  test('returns 50 for equal pass/fail split', () => {
    expect(complianceRate([PASS_ITEM, FAIL_ITEM], check)).toBe(50);
  });

  test('excludes blank items from the denominator', () => {
    // BLANK_ITEM has null for arrivedOnTime — should not count as fail
    expect(complianceRate([PASS_ITEM, BLANK_ITEM], check)).toBe(100);
  });

  test('returns null for empty array', () => {
    expect(complianceRate([], check)).toBeNull();
  });

  test('returns null when every item is blank', () => {
    expect(complianceRate([BLANK_ITEM, BLANK_ITEM], check)).toBeNull();
  });

  test('rounds to nearest integer', () => {
    // 2 pass out of 3 = 66.67% → rounds to 67
    expect(complianceRate([PASS_ITEM, PASS_ITEM, FAIL_ITEM], check)).toBe(67);
  });
});

// ── overallComplianceScore ────────────────────────────────────────────────────

describe('overallComplianceScore', () => {
  test('returns 100 for a perfect item', () => {
    expect(overallComplianceScore([PASS_ITEM])).toBe(100);
  });

  test('returns 0 for an all-fail item', () => {
    expect(overallComplianceScore([FAIL_ITEM])).toBe(0);
  });

  test('returns null for an all-blank item', () => {
    expect(overallComplianceScore([BLANK_ITEM])).toBeNull();
  });

  test('returns null for empty array', () => {
    expect(overallComplianceScore([])).toBeNull();
  });

  test('averages across all checklist categories', () => {
    const score = overallComplianceScore([PASS_ITEM, FAIL_ITEM]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('excludes blank categories from the average (blanks do not lower score)', () => {
    // WARN_ITEM has blanks on intBasement and garage — those categories should be excluded,
    // not counted as failures
    const scoreWithBlanks = overallComplianceScore([WARN_ITEM]);
    const scoreAllPass = overallComplianceScore([PASS_ITEM]);
    // warn item should score less than all-pass, but blanks shouldn't make it 0
    expect(scoreWithBlanks).not.toBeNull();
    expect(scoreWithBlanks).toBeLessThan(scoreAllPass);
    expect(scoreWithBlanks).toBeGreaterThan(0);
  });
});

// ── categoryStats ─────────────────────────────────────────────────────────────

describe('categoryStats', () => {
  test('returns one entry per checklist item', () => {
    const stats = categoryStats([PASS_ITEM]);
    expect(stats).toHaveLength(CHECKLIST.length);
  });

  test('each entry has label, passRate, blankCount, blankPct', () => {
    const [first] = categoryStats([PASS_ITEM]);
    expect(first).toHaveProperty('label');
    expect(first).toHaveProperty('passRate');
    expect(first).toHaveProperty('blankCount');
    expect(first).toHaveProperty('blankPct');
  });

  test('blankPct is 100 when all items are blank for a category', () => {
    const stats = categoryStats([BLANK_ITEM]);
    expect(stats.every(s => s.blankPct === 100)).toBe(true);
  });

  test('blankPct is 0 when no items are blank for a category', () => {
    const arrivedStat = categoryStats([PASS_ITEM, FAIL_ITEM]).find(s => s.label === 'Arrived On-Time');
    expect(arrivedStat.blankPct).toBe(0);
  });

  test('passRate is null when every item is blank', () => {
    const stats = categoryStats([BLANK_ITEM]);
    expect(stats.every(s => s.passRate === null)).toBe(true);
  });
});

// ── lowScoreCategories / highBlankCategories ──────────────────────────────────

describe('lowScoreCategories', () => {
  test('returns only categories below threshold', () => {
    const low = lowScoreCategories([FAIL_ITEM], 80);
    expect(low.every(c => c.passRate < 80)).toBe(true);
  });

  test('sorted ascending by passRate', () => {
    const low = lowScoreCategories([PASS_ITEM, FAIL_ITEM], 100);
    for (let i = 1; i < low.length; i++) {
      expect(low[i].passRate).toBeGreaterThanOrEqual(low[i - 1].passRate);
    }
  });

  test('returns empty array for an all-pass set at default threshold', () => {
    expect(lowScoreCategories([PASS_ITEM])).toHaveLength(0);
  });
});

describe('highBlankCategories', () => {
  test('returns categories at or above threshold', () => {
    const high = highBlankCategories([BLANK_ITEM], 30);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every(c => c.blankPct >= 30)).toBe(true);
  });

  test('sorted descending by blankPct', () => {
    const high = highBlankCategories([BLANK_ITEM], 0);
    for (let i = 1; i < high.length; i++) {
      expect(high[i].blankPct).toBeLessThanOrEqual(high[i - 1].blankPct);
    }
  });
});

// ── avgRating ─────────────────────────────────────────────────────────────────

describe('avgRating', () => {
  test('returns average of numeric values', () => {
    const items = [
      { professionalGreetingRating: 4 },
      { professionalGreetingRating: 2 },
    ];
    expect(avgRating(items, 'professionalGreetingRating')).toBe(3);
  });

  test('returns null when all values are null', () => {
    expect(avgRating([BLANK_ITEM], 'professionalGreetingRating')).toBeNull();
  });

  test('returns null for empty array', () => {
    expect(avgRating([], 'professionalGreetingRating')).toBeNull();
  });

  test('ignores null values in the average', () => {
    const items = [
      { vehicleCleanlinessRating: 5 },
      { vehicleCleanlinessRating: null },
    ];
    expect(avgRating(items, 'vehicleCleanlinessRating')).toBe(5);
  });
});

// ── flagsForItem / hasFollowUp ────────────────────────────────────────────────

describe('flagsForItem', () => {
  test('returns empty array for a clean item', () => {
    expect(flagsForItem(PASS_ITEM)).toHaveLength(0);
  });

  test('returns fail/warn entries for a failing item', () => {
    const flags = flagsForItem(FAIL_ITEM);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every(f => f.status === 'fail' || f.status === 'warn')).toBe(true);
  });

  test('returns warn entries for a warn item', () => {
    const flags = flagsForItem(WARN_ITEM);
    expect(flags.some(f => f.status === 'warn')).toBe(true);
    expect(flags.every(f => f.status !== 'pass')).toBe(true);
  });

  test('does not include blank checks as flags', () => {
    const flags = flagsForItem(BLANK_ITEM);
    expect(flags).toHaveLength(0);
  });
});

describe('hasFollowUp', () => {
  test('returns falsy for a clean item with no notes', () => {
    expect(hasFollowUp(PASS_ITEM)).toBeFalsy();
  });

  test('returns truthy when there are flags', () => {
    expect(hasFollowUp(FAIL_ITEM)).toBeTruthy();
  });

  test('returns truthy when correctiveActionsGiven is set even if all checks pass', () => {
    const item = { ...PASS_ITEM, correctiveActionsGiven: 'Some corrective action' };
    expect(hasFollowUp(item)).toBeTruthy();
  });

  test('returns truthy when additionalTrainingNeeded is set', () => {
    const item = { ...PASS_ITEM, additionalTrainingNeeded: 'Review PPE procedures' };
    expect(hasFollowUp(item)).toBeTruthy();
  });
});

// ── coverageBreakdown ─────────────────────────────────────────────────────────

describe('coverageBreakdown', () => {
  const options = ['Ant', 'Spiders', 'Cockroaches', 'Mice'];

  test('counts covered options correctly', () => {
    const items = [{ insectsCovered: 'Ant,Spiders' }, { insectsCovered: 'Ant' }];
    const bd = coverageBreakdown(items, 'insectsCovered', options);
    expect(bd.counts['Ant']).toBe(2);
    expect(bd.counts['Spiders']).toBe(1);
  });

  test('neverCovered lists options with zero hits', () => {
    const items = [{ insectsCovered: 'Ant' }];
    const bd = coverageBreakdown(items, 'insectsCovered', options);
    expect(bd.neverCovered).toContain('Cockroaches');
    expect(bd.neverCovered).toContain('Mice');
    expect(bd.neverCovered).not.toContain('Ant');
  });

  test('strips the NONE sentinel value', () => {
    const items = [{ insectsCovered: 'NONE' }];
    const bd = coverageBreakdown(items, 'insectsCovered', options);
    expect(bd.covered).toHaveLength(0);
    expect(bd.neverCovered).toEqual(options);
  });

  test('handles null values (no crash, no counts)', () => {
    const items = [{ insectsCovered: null }, { insectsCovered: 'Ant' }];
    const bd = coverageBreakdown(items, 'insectsCovered', options);
    expect(bd.counts['Ant']).toBe(1);
  });

  test('trims whitespace around comma-separated values', () => {
    const items = [{ insectsCovered: 'Ant , Spiders' }];
    const bd = coverageBreakdown(items, 'insectsCovered', options);
    expect(bd.counts['Ant']).toBe(1);
    expect(bd.counts['Spiders']).toBe(1);
  });

  test('covered is sorted descending by count', () => {
    const items = [
      { insectsCovered: 'Ant,Ant,Spiders' }, // duplicates in one item still count once per item
      { insectsCovered: 'Ant' },
    ];
    // Re-test with two separate items where Ant should have 2 and Spiders 1
    const items2 = [
      { insectsCovered: 'Ant,Spiders' },
      { insectsCovered: 'Ant' },
    ];
    const bd = coverageBreakdown(items2, 'insectsCovered', options);
    expect(bd.covered[0]).toBe('Ant');
  });

  test('returns empty covered for items with no insect data', () => {
    const bd = coverageBreakdown([BLANK_ITEM], 'insectsCovered', options);
    expect(bd.covered).toHaveLength(0);
    expect(bd.neverCovered).toEqual(options);
  });

  test('works with the full INSECT_OPTIONS list', () => {
    const bd = coverageBreakdown([PASS_ITEM], 'insectsCovered', INSECT_OPTIONS);
    expect(bd.covered).toContain('Ant');
    expect(bd.covered).toContain('Spiders');
    expect(bd.covered).toContain('Cockroaches');
    expect(bd.neverCovered).not.toContain('Ant');
  });
});

// ── customerPresence / presenceBreakdown ──────────────────────────────────────

describe('customerPresence', () => {
  test('returns "Home" when no sentinel present', () => {
    expect(customerPresence(PASS_ITEM)).toBe('Home');
  });

  test('returns "Not Home" when any of the three columns is the sentinel', () => {
    expect(customerPresence(NOT_HOME_ITEM)).toBe('Not Home');
  });

  test('returns null when all three columns are blank', () => {
    expect(customerPresence(BLANK_ITEM)).toBeNull();
  });

  test('returns "Not Home" with only one sentinel column set', () => {
    const item = { ...BLANK_ITEM, professionalGreeting: 'Customer Not Home' };
    expect(customerPresence(item)).toBe('Not Home');
  });

  test('returns "Home" when some columns are set but none are the sentinel', () => {
    const item = { ...BLANK_ITEM, professionalGreeting: 'YES', properExplanation: null, addressedConcerns: null };
    expect(customerPresence(item)).toBe('Home');
  });
});

describe('presenceBreakdown', () => {
  test('correctly tallies home/notHome/unknown', () => {
    const items = [PASS_ITEM, NOT_HOME_ITEM, BLANK_ITEM];
    const bd = presenceBreakdown(items);
    expect(bd.home).toBe(1);
    expect(bd.notHome).toBe(1);
    expect(bd.unknown).toBe(1);
  });

  test('returns all zeros for empty array', () => {
    expect(presenceBreakdown([])).toEqual({ home: 0, notHome: 0, unknown: 0 });
  });
});

// ── serviceCompletionChart ────────────────────────────────────────────────────

describe('serviceCompletionChart', () => {
  const SERVICE_CHECK_KEYS = ['extDeWebbed', 'extGranular', 'extPerimeterSpray', 'extDust',
    'intLivingAreas', 'intBasement', 'garage', 'uniform'];

  test('returns one entry per service-area checklist item', () => {
    const rows = serviceCompletionChart([PASS_ITEM]);
    const warnChecks = require('../dashboard').CHECKLIST.filter(c => c.warn);
    expect(rows).toHaveLength(warnChecks.length);
  });

  test('counts complete/missed/notPerformed correctly', () => {
    const rows = serviceCompletionChart([PASS_ITEM]);
    const extDeWebbed = rows.find(r => r.label === 'Exterior De-Webbed');
    expect(extDeWebbed.complete).toBe(1);
    expect(extDeWebbed.missed).toBe(0);
    expect(extDeWebbed.notPerformed).toBe(0);
    expect(extDeWebbed.total).toBe(1);
  });

  test('counts fail values as notPerformed', () => {
    const rows = serviceCompletionChart([FAIL_ITEM]);
    const extDeWebbed = rows.find(r => r.label === 'Exterior De-Webbed');
    expect(extDeWebbed.notPerformed).toBe(1);
    expect(extDeWebbed.complete).toBe(0);
  });

  test('counts warn values as missed', () => {
    const rows = serviceCompletionChart([WARN_ITEM]);
    const extDeWebbed = rows.find(r => r.label === 'Exterior De-Webbed');
    expect(extDeWebbed.missed).toBe(1);
  });

  test('excludes blank values from totals', () => {
    const rows = serviceCompletionChart([BLANK_ITEM]);
    expect(rows.every(r => r.total === 0)).toBe(true);
  });
});

// ── flattenItem ───────────────────────────────────────────────────────────────

describe('flattenItem', () => {
  test('extracts employee name from board_relation linked_items', () => {
    const item = flattenItem(makeRawItem());
    expect(item.employee).toBe('Test Employee');
  });

  test('extracts manager from mirror display_value', () => {
    const item = flattenItem(makeRawItem());
    expect(item.manager).toBe('Test Manager');
  });

  test('normalizes date to YYYY-MM-DD', () => {
    const item = flattenItem(makeRawItem());
    expect(item.date).toBe('2024-06-01');
  });

  test('converts rating text to Number', () => {
    const item = flattenItem(makeRawItem());
    expect(item.professionalGreetingRating).toBe(4);
    expect(typeof item.professionalGreetingRating).toBe('number');
  });

  test('converts empty rating to null', () => {
    const rawItem = makeRawItem({
      column_values: makeRawItem().column_values.map(cv =>
        cv.id === 'rating_mkyfvenm' ? { ...cv, text: '' } : cv
      ),
    });
    const item = flattenItem(rawItem);
    expect(item.professionalGreetingRating).toBeNull();
  });

  test('marks isComplete true when date, manager, and employee are present', () => {
    const item = flattenItem(makeRawItem());
    expect(item.isComplete).toBe(true);
  });

  test('marks isComplete false when employee is missing', () => {
    const rawItem = makeRawItem({
      column_values: makeRawItem().column_values.map(cv =>
        cv.id === 'board_relation_mkyfavcb' ? { ...cv, linked_items: [] } : cv
      ),
    });
    const item = flattenItem(rawItem);
    expect(item.isComplete).toBe(false);
  });

  test('preserves id and url from rawItem', () => {
    const raw = makeRawItem({ id: '999', url: 'https://monday.com/test' });
    const item = flattenItem(raw);
    expect(item.id).toBe('999');
    expect(item.url).toBe('https://monday.com/test');
  });
});

// ── flattenRecord ─────────────────────────────────────────────────────────────

describe('flattenRecord', () => {
  test('extracts employee name from board_relation', () => {
    const record = flattenRecord(makeRawRecord(), CALLOUT_COLUMN_MAP);
    expect(record.employee).toBe('Test Employee');
  });

  test('uses fullDayRange.from as date when present', () => {
    const record = flattenRecord(makeRawRecord(), CALLOUT_COLUMN_MAP);
    expect(record.date).toBe('2024-04-01');
  });

  test('falls back to partialStart when fullDayRange is absent', () => {
    const rawRecord = makeRawRecord({
      column_values: makeRawRecord().column_values.map(cv =>
        cv.id === 'timerange_mkx65krk'
          ? { ...cv, type: 'timeline', from: null, to: null }
          : cv.id === 'date_mkx6nxyk'
            ? { ...cv, text: '2024-05-10' }
            : cv
      ),
    });
    const record = flattenRecord(rawRecord, CALLOUT_COLUMN_MAP);
    expect(record.date).toBe('2024-05-10');
  });

  test('sets date to null when both fullDayRange and partialStart are absent', () => {
    const rawRecord = makeRawRecord({
      column_values: makeRawRecord().column_values.map(cv =>
        cv.id === 'timerange_mkx65krk'
          ? { ...cv, type: 'timeline', from: null, to: null }
          : cv
      ),
    });
    const record = flattenRecord(rawRecord, CALLOUT_COLUMN_MAP);
    expect(record.date).toBeNull();
  });
});

// ── filterItems ───────────────────────────────────────────────────────────────

describe('filterItems', () => {
  const items = [PASS_ITEM, FAIL_ITEM, WARN_ITEM, BLANK_ITEM, INCOMPLETE_ITEM];
  const emptyFilters = { manager: '', office: '', employee: '', service: '', dateFrom: '', dateTo: '' };

  test('excludes incomplete items regardless of filters', () => {
    const result = filterItems(items, emptyFilters);
    expect(result.every(i => i.isComplete)).toBe(true);
    expect(result.find(i => i.id === INCOMPLETE_ITEM.id)).toBeUndefined();
  });

  test('returns all complete items when filters are empty', () => {
    const result = filterItems(items, emptyFilters);
    // PASS, FAIL, WARN, BLANK are all isComplete; INCOMPLETE is not
    expect(result).toHaveLength(4);
  });

  test('filters by manager', () => {
    const result = filterItems(items, { ...emptyFilters, manager: 'Jane Manager' });
    expect(result.every(i => i.manager === 'Jane Manager')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('filters by office', () => {
    const result = filterItems(items, { ...emptyFilters, office: 'Orlando' });
    expect(result.every(i => i.office === 'Orlando')).toBe(true);
  });

  test('filters by employee', () => {
    const result = filterItems(items, { ...emptyFilters, employee: 'John Smith' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(PASS_ITEM.id);
  });

  test('filters by serviceType', () => {
    const result = filterItems(items, { ...emptyFilters, service: 'Quarterly' });
    expect(result.every(i => i.serviceType === 'Quarterly')).toBe(true);
  });

  test('filters by dateFrom (inclusive)', () => {
    const result = filterItems(items, { ...emptyFilters, dateFrom: '2024-03-01' });
    expect(result.every(i => i.date >= '2024-03-01')).toBe(true);
    // BLANK_ITEM has date 2024-01-05 which is before the cutoff — must be excluded
    expect(result.find(i => i.id === BLANK_ITEM.id)).toBeUndefined();
  });

  test('filters by dateTo (inclusive)', () => {
    const result = filterItems(items, { ...emptyFilters, dateTo: '2024-02-28' });
    expect(result.every(i => i.date <= '2024-02-28')).toBe(true);
  });

  test('combines multiple filters (AND logic)', () => {
    const result = filterItems(items, { ...emptyFilters, manager: 'Jane Manager', office: 'Orlando' });
    expect(result.every(i => i.manager === 'Jane Manager' && i.office === 'Orlando')).toBe(true);
  });

  test('returns empty array when no items match', () => {
    const result = filterItems(items, { ...emptyFilters, employee: 'Nobody' });
    expect(result).toHaveLength(0);
  });
});

// ── filterRecords ─────────────────────────────────────────────────────────────

describe('filterRecords', () => {
  const records = [
    { id: 'r1', employee: 'John Smith', manager: 'Jane Manager', office: 'Orlando', date: '2024-03-10' },
    { id: 'r2', employee: 'Bob Tech', manager: 'Jane Manager', office: 'Tampa', date: '2024-04-05' },
    { id: 'r3', employee: 'Alice Tech', manager: 'Sam Manager', office: 'Orlando', date: '2024-01-20' },
  ];
  const emptyFilters = { manager: '', office: '', employee: '', dateFrom: '', dateTo: '' };

  test('returns all records when filters are empty', () => {
    expect(filterRecords(records, emptyFilters)).toHaveLength(3);
  });

  test('filters by employee', () => {
    const result = filterRecords(records, { ...emptyFilters, employee: 'John Smith' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  test('filters by date range', () => {
    const result = filterRecords(records, { ...emptyFilters, dateFrom: '2024-03-01', dateTo: '2024-04-30' });
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r2']);
  });

  test('excludes records with null date when dateFrom is set', () => {
    const withNull = [...records, { id: 'r4', employee: 'X', manager: '', office: '', date: null }];
    const result = filterRecords(withNull, { ...emptyFilters, dateFrom: '2024-01-01' });
    expect(result.find(r => r.id === 'r4')).toBeUndefined();
  });
});

// ── extractAiText ─────────────────────────────────────────────────────────────

describe('extractAiText', () => {
  test('returns a plain string as-is', () => {
    expect(extractAiText('hello')).toBe('hello');
  });

  test('extracts text from { text } shape', () => {
    expect(extractAiText({ text: 'hello' })).toBe('hello');
  });

  test('joins content array text fields', () => {
    expect(extractAiText({ content: [{ text: 'hello' }, { text: 'world' }] })).toBe('hello world');
  });

  test('converts non-array content to string', () => {
    expect(extractAiText({ content: 'raw string' })).toBe('raw string');
  });

  test('returns empty string for null/undefined', () => {
    expect(extractAiText(null)).toBe('');
    expect(extractAiText(undefined)).toBe('');
  });

  test('returns empty string for missing text in object', () => {
    expect(extractAiText({ other: 'field' })).toBe('');
  });

  test('handles content array entries with no text field', () => {
    expect(extractAiText({ content: [{ type: 'image' }, { text: 'hi' }] })).toBe(' hi');
  });
});

// ── formatSynopsis ────────────────────────────────────────────────────────────

describe('formatSynopsis', () => {
  test('converts a recognized header line to <h4>', () => {
    const result = formatSynopsis('Strengths Observed: Great work\nAreas to Improve: More focus needed');
    expect(result).toContain('<h4>Strengths Observed</h4>');
    expect(result).toContain('<h4>Areas to Improve</h4>');
  });

  test('wraps the inline text after the header in <p>', () => {
    const result = formatSynopsis('Strengths Observed: Great work');
    expect(result).toContain('<p>Great work</p>');
  });

  test('wraps non-header lines in <p>', () => {
    const result = formatSynopsis('This is a plain sentence.');
    expect(result).toBe('<p>This is a plain sentence.</p>');
  });

  test('escapes HTML in content', () => {
    const result = formatSynopsis('Strengths Observed: <b>bold & "quoted"</b>');
    expect(result).toContain('&lt;b&gt;bold &amp; &quot;quoted&quot;&lt;/b&gt;');
  });

  test('handles all five section headers', () => {
    const text = [
      'Strengths Observed: S',
      'Areas to Improve: A',
      'Corrective Actions Given: C',
      'Additional Training Needed: T',
      'Trend / Areas of Concern Over Time: TR',
    ].join('\n');
    const result = formatSynopsis(text);
    expect(result).toContain('<h4>Strengths Observed</h4>');
    expect(result).toContain('<h4>Areas to Improve</h4>');
    expect(result).toContain('<h4>Corrective Actions Given</h4>');
    expect(result).toContain('<h4>Additional Training Needed</h4>');
    expect(result).toContain('<h4>Trend / Areas of Concern Over Time</h4>');
  });

  test('is case-insensitive for header matching', () => {
    const result = formatSynopsis('STRENGTHS OBSERVED: Good stuff');
    expect(result).toContain('<h4>Strengths Observed</h4>');
  });

  test('strips leading colon/dash/space after header', () => {
    const result = formatSynopsis('Strengths Observed - Great work');
    expect(result).toContain('<p>Great work</p>');
  });

  test('returns empty string for empty input', () => {
    expect(formatSynopsis('')).toBe('');
  });
});

// ── uniqueSorted ──────────────────────────────────────────────────────────────

describe('uniqueSorted', () => {
  test('returns sorted unique values', () => {
    const items = [
      { office: 'Tampa' },
      { office: 'Orlando' },
      { office: 'Tampa' },
      { office: 'Miami' },
    ];
    expect(uniqueSorted(items, 'office')).toEqual(['Miami', 'Orlando', 'Tampa']);
  });

  test('filters out null/undefined values', () => {
    const items = [{ office: 'Tampa' }, { office: null }, { office: undefined }];
    expect(uniqueSorted(items, 'office')).toEqual(['Tampa']);
  });

  test('returns empty array for empty input', () => {
    expect(uniqueSorted([], 'office')).toEqual([]);
  });

  test('returns empty array when all values are null', () => {
    expect(uniqueSorted([{ office: null }], 'office')).toEqual([]);
  });
});
