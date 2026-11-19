// Progressive enhancement for data tables: text search, select filters, a checkbox filter and
// column sorting. Without JavaScript the full table stays visible and readable.
//
// Markup contract:
//   <div data-table-tools="ID">  inputs: [data-filter="text"], select[data-filter="<attr>"],
//                                input[type=checkbox][data-filter="<attr>"][data-value="<v>"],
//                                [data-count] for the visible-row count
//   <table id="ID">              rows: tr[data-<attr>="a|b"]; sortable th[data-sort="text|num"]

function setup(tools: HTMLElement) {
  const table = document.getElementById(tools.dataset.tableTools ?? '');
  if (!table) return;
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr:not(.group)'));
  const groups = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr.group'));
  const text = tools.querySelector<HTMLInputElement>('[data-filter="text"]');
  const selects = Array.from(tools.querySelectorAll<HTMLSelectElement>('select[data-filter]'));
  const checks = Array.from(tools.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-filter]'));
  const count = tools.querySelector<HTMLElement>('[data-count]');
  const haystack = new Map(rows.map((r) => [r, (r.textContent ?? '').toLocaleLowerCase()]));

  const apply = () => {
    const q = (text?.value ?? '').trim().toLocaleLowerCase();
    let visible = 0;
    for (const row of rows) {
      let show = !q || (haystack.get(row) ?? '').includes(q);
      for (const sel of selects) {
        if (!show || !sel.value) continue;
        const values = (row.dataset[sel.dataset.filter!] ?? '').split('|');
        show = values.includes(sel.value);
      }
      for (const box of checks) {
        if (!show || !box.checked) continue;
        show = (row.dataset[box.dataset.filter!] ?? '') === box.dataset.value;
      }
      row.hidden = !show;
      if (show) visible += 1;
    }
    for (const group of groups) {
      const body = group.closest('tbody');
      if (body) body.hidden = !Array.from(body.querySelectorAll<HTMLTableRowElement>('tr:not(.group)')).some((r) => !r.hidden);
    }
    if (count) count.textContent = `${visible.toLocaleString('en')} of ${rows.length.toLocaleString('en')} shown`;
  };

  text?.addEventListener('input', apply);
  selects.forEach((s) => s.addEventListener('change', apply));
  checks.forEach((c) => c.addEventListener('change', apply));

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
      const key = (row: HTMLTableRowElement) => {
        const cell = row.cells[index];
        const raw = cell?.dataset.value ?? cell?.textContent ?? '';
        return numeric ? Number(raw.replace(/[^0-9.-]/g, '')) || 0 : raw.trim().toLocaleLowerCase();
      };
      const sorted = [...rows].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const order = ka < kb ? -1 : ka > kb ? 1 : 0;
        return ascending ? order : -order;
      });
      body.append(...sorted);
    });
  });

  tools.hidden = false;
  apply();
}

document.querySelectorAll<HTMLElement>('[data-table-tools]').forEach(setup);
