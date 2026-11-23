// Behaviour shared by every page, bundled with the finder (layouts/Base.astro): theme switch,
// header menus, copy buttons and the in-page navigation of long cards.
import './toc.ts';

// Theme switch. The icon follows html[data-theme] (set in <head>) in CSS from the first paint;
// the label says what a click does next.
const button = document.getElementById('theme-toggle');
const modes = ['auto', 'light', 'dark'];
const read = () => {
  try {
    return localStorage.getItem('theme') ?? 'auto';
  } catch {
    return 'auto';
  }
};
const label = (mode: string) => {
  const next = modes[(modes.indexOf(mode) + 1) % modes.length];
  const text = `Theme: ${mode}. Switch to ${next}`;
  button?.setAttribute('aria-label', text);
  if (button) button.title = text;
};
const apply = (mode: string) => {
  const root = document.documentElement;
  try {
    if (mode === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', mode);
  } catch {}
  if (mode === 'auto') delete root.dataset.theme;
  else root.dataset.theme = mode;
  label(mode);
};
button?.addEventListener('click', () => apply(modes[(modes.indexOf(read()) + 1) % modes.length]));
label(read());

// Header menus are <details>: they work without JavaScript; here they also close on Escape, on a
// click outside and when another one opens.
const drops = Array.from(document.querySelectorAll<HTMLDetailsElement>('[data-nav-drop]'));
const closeAll = (except?: HTMLDetailsElement) => drops.forEach((d) => d !== except && d.removeAttribute('open'));
drops.forEach((d) => d.addEventListener('toggle', () => d.open && closeAll(d)));
document.addEventListener('click', (e) => {
  if (!drops.some((d) => d.contains(e.target as Node))) closeAll();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = drops.find((d) => d.open);
  if (!open) return;
  open.removeAttribute('open');
  open.querySelector('summary')?.focus();
});

// Copy buttons for codes and IDs (.js-only: not shown without JavaScript).
document.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    } catch {}
  });
});

// "/" focuses the header finder from anywhere except a text field (the hint is CSS).
const finder = document.getElementById('finder-input') as HTMLInputElement | null;
finder?.setAttribute('aria-keyshortcuts', '/');
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !finder) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  e.preventDefault();
  finder.focus();
});

// Membership status definitions (components/StatusDefs.astro) are listed once under their table;
// here they also become the tooltip of each status cell. A title does not change the layout.
document.querySelectorAll<HTMLElement>('[data-status-defs]').forEach((defs) => {
  const table = document.getElementById(defs.dataset.statusDefs ?? '') as HTMLTableElement | null;
  const col = table?.querySelector<HTMLTableCellElement>('thead [data-status-col]')?.cellIndex ?? -1;
  if (!table || col < 0) return;
  const text = new Map(
    Array.from(defs.querySelectorAll<HTMLElement>('dt[data-key]'), (dt) => [dt.dataset.key ?? '', dt.nextElementSibling?.textContent?.trim() ?? '']),
  );
  table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-status]').forEach((row) => {
    const cell = row.cells[col];
    const title = text.get(row.dataset.status ?? '');
    if (cell && title) cell.title = title;
  });
});
