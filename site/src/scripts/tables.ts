// Progressive enhancement for data tables: text search, select filters, checkbox filters and
// column sorting. Without JavaScript the full table stays visible and readable.
//
// Markup contract:
//   <div data-table-tools="ID">  inputs: [data-filter="text"], select[data-filter="<attr>"],
//                                input[type=checkbox][data-filter="<attr>"][data-value="<v>"],
//                                [data-count] for the visible-row count
//   <table id="ID">              rows: tr[data-<attr>="a|b"]; sortable th[data-sort="text|num"]
//
// Load cost matters on the 1,275-row index (SPEC §10.4): nothing walks the rows on load.
// Checkbox filters are a table attribute plus one CSS rule, the count uses a native selector,
// and the per-row pass runs only after the reader types or picks a filter.

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

function setup(tools: HTMLElement) {
  const id = tools.dataset.tableTools ?? '';
  const table = document.getElementById(id) as HTMLTableElement | null;
  if (!table) return;
  const text = tools.querySelector<HTMLInputElement>('[data-filter="text"]');
  const selects = Array.from(tools.querySelectorAll<HTMLSelectElement>('select[data-filter]'));
  const checks = Array.from(tools.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-filter]'));
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

  const updateCount = () => {
    if (!count) return;
    const checked = checks.filter((b) => b.checked);
    let visible: number;
    if (!filtered) {
      const extra = checked.map((b) => `[data-${b.dataset.filter}="${cssEscape(b.dataset.value ?? '')}"]`).join('');
      visible = table.querySelectorAll(`${rowSelector}${extra}`).length;
    } else {
      visible = rows!.filter((r) => !r.hidden && checked.every((b) => r.dataset[b.dataset.filter!] === b.dataset.value)).length;
    }
    count.textContent = `${visible.toLocaleString('en')} of ${total.toLocaleString('en')} shown`;
  };

  const apply = () => {
    rows ??= Array.from(table.querySelectorAll<HTMLTableRowElement>(rowSelector));
    haystack ??= new Map(rows.map((r) => [r, (r.textContent ?? '').toLocaleLowerCase()]));
    const q = (text?.value ?? '').trim().toLocaleLowerCase();
    const active = selects.filter((s) => s.value);
    filtered = Boolean(q) || active.length > 0;
    for (const row of rows) {
      let show = !q || (haystack.get(row) ?? '').includes(q);
      for (const sel of active) {
        if (!show) break;
        show = (row.dataset[sel.dataset.filter!] ?? '').split('|').includes(sel.value);
      }
      if (row.hidden === show) row.hidden = !show;
    }
    table.querySelectorAll<HTMLTableSectionElement>('tbody').forEach((body) => {
      if (!body.querySelector('tr.group')) return;
      const anyVisible = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr:not(.group)')).some((r) => !r.hidden);
      if (body.hidden === anyVisible) body.hidden = !anyVisible;
    });
    updateCount();
  };

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 120);
  };
  text?.addEventListener('input', schedule);
  selects.forEach((s) => s.addEventListener('change', apply));
  checks.forEach((c) =>
    c.addEventListener('change', () => {
      syncChecks();
      updateCount();
    }),
  );

  // Sorting applies to single-body tables only; grouped tables keep their grouping.
  const body = table.tBodies.length === 1 ? table.tBodies[0] : null;
  table.querySelectorAll<HTMLTableCellElement>('thead th[data-sort]').forEach((th) => {
    if (!body) return;
    const index = th.cellIndex;
    const numeric = th.dataset.sort === 'num';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sort';
    button.textContent = th.textContent ?? '';
    th.textContent = '';
    th.append(button);
    button.addEventListener('click', () => {
      const ascending = th.getAttribute('aria-sort') !== 'ascending';
      table.querySelectorAll('thead th[aria-sort]').forEach((other) => other.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
      const all = Array.from(body.rows);
      const key = (row: HTMLTableRowElement) => {
        const cell = row.cells[index];
        const raw = cell?.dataset.value ?? cell?.textContent ?? '';
        return numeric ? Number(raw.replace(/[^0-9.-]/g, '')) || 0 : raw.trim().toLocaleLowerCase();
      };
      const keyed = all.map((r) => [key(r), r] as const);
      keyed.sort(([a], [b]) => {
        const order = a < b ? -1 : a > b ? 1 : 0;
        return ascending ? order : -order;
      });
      body.append(...keyed.map(([, r]) => r));
    });
  });

  syncChecks();
  tools.hidden = false;
  updateCount();
}

document.querySelectorAll<HTMLElement>('[data-table-tools]').forEach(setup);
