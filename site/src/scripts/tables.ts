// Progressive enhancement for data tables: text search, select filters, checkbox filters, facets,
// a year range and column sorting. Without JavaScript the full table stays visible and readable.
//
// Markup contract:
//   <div data-table-tools="ID">  inputs: [data-filter="text"], select[data-filter="<attr>"],
//                                input[type=checkbox][data-filter="<attr>"][data-value="<v>"],
//                                [data-count] for the visible-row count
//                                The active filters are repeated as removable chips under
//                                the controls, with "Clear all" when there are several.
//     data-facets="EL"           more controls in element EL (a side panel):
//                                input[type=checkbox][data-facet="<attr>"][value="<v>"] (values of
//                                one facet are OR, facets are AND; each has a .facet-count that is
//                                recounted after every change), input[data-range="<attr>"]
//                                [data-bound="min|max"] (a year range on data-<attr>)
//     data-url-state             the filters are kept in the query string, so a filtered list
//                                can be shared and reloaded
//     [data-facets-open]         on narrow screens, opens the panel in dialog[data-facet-sheet]
//   <table id="ID">              rows: tr[data-<attr>="a|b"]; sortable th[data-sort="text|num"]
//
// Load cost matters on the 1,275-row index (SPEC §10.4): nothing walks the rows on load.
// Checkbox filters are a table attribute plus one CSS rule, the count uses a native selector,
// facet counts for the default view are in the HTML, and the per-row pass runs only after the
// reader types or picks a filter (or opens a link with filters in its query string).

let ruleSheet: CSSStyleSheet | null = null;
function addRule(rule: string) {
  if (!ruleSheet) {
    const style = document.createElement('style');
    document.head.append(style);
    ruleSheet = style.sheet;
  }
  ruleSheet?.insertRule(rule, ruleSheet.cssRules.length);
}

const cssEscape = (s: string) => (window.CSS?.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
const fmt = (n: number) => n.toLocaleString('en');

// The visible name of a filter: the text of its <label>, without the options of a select.
const labelOf = (control: HTMLElement) =>
  Array.from(control.closest('label')?.childNodes ?? [])
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() ||
  control.closest('label')?.querySelector('.cb-label')?.textContent?.trim() ||
  control.dataset.filter ||
  '';
const legendOf = (control: HTMLElement) => control.closest('fieldset')?.querySelector('legend')?.textContent?.trim() ?? '';

function setup(tools: HTMLElement) {
  const id = tools.dataset.tableTools ?? '';
  const table = document.getElementById(id) as HTMLTableElement | null;
  if (!table) return;
  const panel = tools.dataset.facets ? document.getElementById(tools.dataset.facets) : null;
  const roots = panel ? [tools, panel] : [tools];
  const all = <T extends Element>(selector: string) => roots.flatMap((r) => Array.from(r.querySelectorAll<T>(selector)));
  const text = all<HTMLInputElement>('[data-filter="text"]')[0] ?? null;
  const selects = all<HTMLSelectElement>('select[data-filter]');
  const checks = all<HTMLInputElement>('input[type="checkbox"][data-filter]');
  const boxes = all<HTMLInputElement>('input[type="checkbox"][data-facet]');
  const groups = [...new Set(boxes.map((b) => b.dataset.facet!))];
  const ranges = all<HTMLInputElement>('input[data-range]');
  const count = tools.querySelector<HTMLElement>('[data-count]');
  const rowSelector = 'tbody tr:not(.group)';
  const total = table.querySelectorAll(rowSelector).length;

  // Checkbox filters: hide non-matching rows with CSS while the table carries data-only-<attr>.
  for (const box of checks) {
    const attr = box.dataset.filter!;
    const value = cssEscape(box.dataset.value ?? '');
    addRule(`#${cssEscape(id)}[data-only-${attr}] tbody tr:not(.group):not([data-${attr}="${value}"]) { display: none; }`);
  }
  const syncChecks = () => {
    for (const box of checks) table.toggleAttribute(`data-only-${box.dataset.filter}`, box.checked);
  };

  let rows: HTMLTableRowElement[] | null = null;
  let haystack: Map<HTMLTableRowElement, string> | null = null;
  let filtered = false;
  const values = (row: HTMLTableRowElement, attr: string) => (row.dataset[attr] ?? '').split('|');
  const checkedValues = (group: string) => boxes.filter((b) => b.dataset.facet === group && b.checked).map((b) => b.value);
  const bound = (attr: string, which: 'min' | 'max') => {
    const input = ranges.find((r) => r.dataset.range === attr && r.dataset.bound === which);
    const n = Number(input?.value);
    return input?.value && Number.isFinite(n) ? n : null;
  };
  const rangeAttrs = [...new Set(ranges.map((r) => r.dataset.range!))];

  const sheet = document.querySelector<HTMLDialogElement>('[data-facet-sheet]');
  const done = sheet?.querySelector<HTMLElement>('[data-sheet-done]');
  const opener = tools.querySelector<HTMLButtonElement>('[data-facets-open]');

  const updateCount = () => {
    const checked = checks.filter((b) => b.checked);
    let visible: number;
    if (!filtered) {
      const extra = checked.map((b) => `[data-${b.dataset.filter}="${cssEscape(b.dataset.value ?? '')}"]`).join('');
      visible = table.querySelectorAll(`${rowSelector}${extra}`).length;
    } else {
      visible = rows!.filter((r) => !r.hidden && checked.every((b) => r.dataset[b.dataset.filter!] === b.dataset.value)).length;
    }
    if (count) count.textContent = `${fmt(visible)} of ${fmt(total)} shown`;
    if (done) done.textContent = `Show ${fmt(visible)} ${visible === 1 ? 'result' : 'results'}`;
  };

  // Chips for the filters that differ from the page's defaults. The row is created empty and
  // fills only after the reader changes a filter, so it never shifts the first paint.
  // A page may put the (empty) row in its markup to reserve its place for a shared link.
  const chips = tools.querySelector<HTMLElement>('.active-filters') ?? document.createElement('div');
  if (!chips.isConnected) {
    chips.className = 'active-filters';
    chips.hidden = true;
    tools.append(chips);
  }
  const defaults = checks.map((b) => b.defaultChecked);
  const chip = (label: string, clear: () => void, focus: HTMLElement) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.textContent = label;
    button.setAttribute('aria-label', `Remove filter ${label}`);
    button.addEventListener('click', () => {
      clear();
      refresh();
      // A control inside the closed sheet cannot take focus; the chip row stays in reach.
      if (focus.offsetParent) focus.focus();
      else (chips.querySelector('button') ?? opener ?? tools)?.focus();
    });
    return button;
  };
  const clearAll = () => {
    if (text) text.value = '';
    selects.forEach((sel) => (sel.value = ''));
    checks.forEach((box, i) => (box.checked = defaults[i]));
    boxes.forEach((box) => (box.checked = false));
    ranges.forEach((r) => (r.value = ''));
  };
  const renderChips = () => {
    const items: HTMLButtonElement[] = [];
    const q = (text?.value ?? '').trim();
    if (text && q) items.push(chip(`Search: “${q}”`, () => (text.value = ''), text));
    for (const sel of selects) {
      if (sel.value) items.push(chip(`${labelOf(sel)}: ${sel.selectedOptions[0]?.text ?? sel.value}`, () => (sel.value = ''), sel));
    }
    checks.forEach((box, i) => {
      if (box.checked !== defaults[i]) items.push(chip(box.checked ? labelOf(box) : `${labelOf(box)}: off`, () => (box.checked = defaults[i]), box));
    });
    for (const box of boxes) {
      if (box.checked) items.push(chip(`${legendOf(box)}: ${box.dataset.label ?? box.value}`, () => (box.checked = false), box));
    }
    for (const attr of rangeAttrs) {
      const [min, max] = [bound(attr, 'min'), bound(attr, 'max')];
      if (min === null && max === null) continue;
      const first = ranges.find((r) => r.dataset.range === attr)!;
      const span = min !== null && max !== null ? `${min}–${max}` : min !== null ? `from ${min}` : `until ${max}`;
      items.push(chip(`${legendOf(first)}: ${span}`, () => ranges.filter((r) => r.dataset.range === attr).forEach((r) => (r.value = '')), first));
    }
    const filters = items.length;
    if (items.length > 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-clear';
      button.textContent = 'Clear all';
      button.addEventListener('click', () => {
        clearAll();
        refresh();
        (opener?.offsetParent ? opener : text?.offsetParent ? text : tools)?.focus();
      });
      items.push(button);
    }
    chips.replaceChildren(...items);
    chips.hidden = items.length === 0;
    if (opener) opener.textContent = filters ? `Filters · ${filters}` : 'Filters';
  };

  // Facet counts: a value counts the rows that pass every filter except its own facet, so the
  // reader sees what each further choice would show.
  const recount = (counts: Map<string, Map<string, number>>) => {
    for (const box of boxes) {
      const n = counts.get(box.dataset.facet!)?.get(box.value) ?? 0;
      const label = box.closest('label');
      const out = label?.querySelector('.facet-count');
      if (out) out.textContent = fmt(n);
      label?.classList.toggle('is-zero', n === 0 && !box.checked);
    }
  };

  // Query string state (data-url-state): only the keys this table owns are touched.
  const urlState = tools.hasAttribute('data-url-state');
  const keys = () => [
    'q',
    ...selects.map((s) => s.dataset.filter!),
    ...checks.map((b) => b.dataset.filter!),
    ...groups,
    ...rangeAttrs.flatMap((a) => [`${a}-from`, `${a}-to`]),
  ];
  const writeUrl = () => {
    if (!urlState) return;
    const p = new URLSearchParams(location.search);
    for (const k of keys()) p.delete(k);
    const q = (text?.value ?? '').trim();
    if (q) p.set('q', q);
    selects.forEach((s) => s.value && p.set(s.dataset.filter!, s.value));
    checks.forEach((b, i) => b.checked !== defaults[i] && p.set(b.dataset.filter!, b.checked ? '1' : '0'));
    groups.forEach((g) => {
      const v = checkedValues(g);
      if (v.length) p.set(g, v.join(','));
    });
    rangeAttrs.forEach((a) => {
      const [min, max] = [bound(a, 'min'), bound(a, 'max')];
      if (min !== null) p.set(`${a}-from`, String(min));
      if (max !== null) p.set(`${a}-to`, String(max));
    });
    const qs = p.toString();
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  };
  const readUrl = () => {
    if (!urlState) return false;
    const p = new URLSearchParams(location.search);
    if (!keys().some((k) => p.has(k))) return false;
    if (text) text.value = p.get('q') ?? '';
    selects.forEach((s) => (s.value = p.get(s.dataset.filter!) ?? ''));
    checks.forEach((b, i) => {
      const v = p.get(b.dataset.filter!);
      b.checked = v === null ? defaults[i] : v === '1';
    });
    boxes.forEach((b) => (b.checked = (p.get(b.dataset.facet!) ?? '').split(',').includes(b.value)));
    ranges.forEach((r) => (r.value = p.get(`${r.dataset.range}-${r.dataset.bound === 'min' ? 'from' : 'to'}`) ?? ''));
    return true;
  };

  const apply = () => {
    rows ??= Array.from(table.querySelectorAll<HTMLTableRowElement>(rowSelector));
    haystack ??= new Map(rows.map((r) => [r, (r.textContent ?? '').toLocaleLowerCase()]));
    const q = (text?.value ?? '').trim().toLocaleLowerCase();
    const activeSelects = selects.filter((s) => s.value);
    const picked = new Map(groups.map((g) => [g, checkedValues(g)] as const));
    const limits = rangeAttrs.map((a) => [a, bound(a, 'min'), bound(a, 'max')] as const).filter(([, min, max]) => min !== null || max !== null);
    const checked = checks.filter((b) => b.checked);
    filtered = Boolean(q) || activeSelects.length > 0 || [...picked.values()].some((v) => v.length > 0) || limits.length > 0;
    const counts = new Map(groups.map((g) => [g, new Map<string, number>()] as const));
    const add = (g: string, row: HTMLTableRowElement) => {
      const m = counts.get(g)!;
      for (const v of values(row, g)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    };
    for (const row of rows) {
      let base = !q || (haystack.get(row) ?? '').includes(q);
      for (const sel of activeSelects) {
        if (!base) break;
        base = values(row, sel.dataset.filter!).includes(sel.value);
      }
      for (const [attr, min, max] of limits) {
        if (!base) break;
        const y = Number(row.dataset[attr]);
        base = Boolean(row.dataset[attr]) && (min === null || y >= min) && (max === null || y <= max);
      }
      let fails = 0;
      let failing = '';
      for (const [g, wanted] of picked) {
        if (wanted.length && !values(row, g).some((v) => wanted.includes(v))) {
          fails += 1;
          failing = g;
        }
      }
      const show = base && fails === 0;
      if (row.hidden === show) row.hidden = !show;
      // Rows hidden by a checkbox filter (CSS) do not count.
      if (groups.length && base && checked.every((b) => row.dataset[b.dataset.filter!] === b.dataset.value)) {
        if (fails === 0) groups.forEach((g) => add(g, row));
        else if (fails === 1) add(failing, row);
      }
    }
    table.querySelectorAll<HTMLTableSectionElement>('tbody').forEach((body) => {
      if (!body.querySelector('tr.group')) return;
      const anyVisible = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr:not(.group)')).some((r) => !r.hidden);
      if (body.hidden === anyVisible) body.hidden = !anyVisible;
    });
    if (groups.length) recount(counts);
    updateCount();
    renderChips();
    writeUrl();
  };

  const refresh = () => {
    syncChecks();
    apply();
  };

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 120);
  };
  text?.addEventListener('input', schedule);
  ranges.forEach((r) => r.addEventListener('input', schedule));
  selects.forEach((s) => s.addEventListener('change', apply));
  boxes.forEach((b) => b.addEventListener('change', apply));
  checks.forEach((c) =>
    c.addEventListener('change', () => {
      syncChecks();
      if (groups.length || urlState) apply();
      else {
        updateCount();
        renderChips();
      }
    }),
  );

  // Long facets: a filter field and a "Show all" toggle; checked values always stay visible (CSS).
  all<HTMLFieldSetElement>('fieldset[data-facet-group]').forEach((set) => {
    const find = set.querySelector<HTMLInputElement>('[data-facet-filter]');
    find?.addEventListener('input', () => {
      const q = find.value.trim().toLocaleLowerCase();
      set.classList.toggle('is-filtering', Boolean(q));
      set.querySelectorAll<HTMLLabelElement>('label.cb').forEach((l) => l.classList.toggle('match', (l.textContent ?? '').toLocaleLowerCase().includes(q)));
    });
    const more = set.querySelector<HTMLButtonElement>('[data-facet-more]');
    more?.setAttribute('aria-expanded', 'false');
    more?.addEventListener('click', () => {
      const open = set.classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = (open ? more.dataset.less : more.dataset.more) ?? '';
    });
  });

  // Narrow screens: the panel opens as a modal sheet; its controls move in and back out, so the
  // same inputs (and their listeners) serve both layouts.
  const body = panel?.querySelector<HTMLElement>('[data-facets-body]');
  const slot = sheet?.querySelector<HTMLElement>('[data-sheet-slot]');
  if (opener && sheet && body && slot && panel) {
    opener.addEventListener('click', () => {
      slot.append(body);
      sheet.showModal();
    });
    sheet.addEventListener('close', () => {
      panel.append(body);
      opener.focus();
    });
    sheet.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
    window.matchMedia('(min-width: 75rem)').addEventListener('change', (e) => e.matches && sheet.open && sheet.close());
  }

  // Sorting applies to single-body tables and to chunked tables (rows are redistributed over the
  // chunks); grouped tables keep their grouping.
  const chunk = Number(table.dataset.chunk ?? 0);
  const tbody = table.tBodies.length === 1 || chunk ? table.tBodies[0] : null;
  table.querySelectorAll<HTMLTableCellElement>('thead th[data-sort]').forEach((th) => {
    if (!tbody) return;
    const index = th.cellIndex;
    const numeric = th.dataset.sort === 'num';
    // Same text as the header; the sort arrow is CSS on th[data-sort], present from first paint.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sort';
    button.textContent = (th.textContent ?? '').trim();
    th.textContent = '';
    th.append(button);
    button.addEventListener('click', () => {
      const ascending = th.getAttribute('aria-sort') !== 'ascending';
      table.querySelectorAll('thead th[aria-sort]').forEach((other) => other.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
      const list = Array.from(table.querySelectorAll<HTMLTableRowElement>(rowSelector));
      const key = (row: HTMLTableRowElement) => {
        const cell = row.cells[index];
        const raw = cell?.dataset.value ?? cell?.textContent ?? '';
        return numeric ? Number(raw.replace(/[^0-9.-]/g, '')) || 0 : raw.trim().toLocaleLowerCase();
      };
      const keyed = list.map((r) => [key(r), r] as const);
      keyed.sort(([a], [b]) => {
        const order = a < b ? -1 : a > b ? 1 : 0;
        return ascending ? order : -order;
      });
      const sorted = keyed.map(([, r]) => r);
      if (chunk) {
        Array.from(table.tBodies).forEach((tb, i) => tb.append(...sorted.slice(i * chunk, (i + 1) * chunk)));
      } else {
        tbody.append(...sorted);
      }
    });
  });

  if (readUrl()) refresh();
  else {
    syncChecks();
    updateCount();
  }
  document.documentElement.classList.remove('list-pending');
}

document.querySelectorAll<HTMLElement>('[data-table-tools]').forEach(setup);
