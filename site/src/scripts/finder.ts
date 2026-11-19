// Header entity finder: a combobox with a listbox of results (WAI-ARIA combobox pattern).
import { loadIndex, search, type Hit } from './search';

const root = document.querySelector<HTMLElement>('[data-finder]');
if (root) {
  const input = root.querySelector<HTMLInputElement>('input')!;
  const list = root.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const url = root.dataset.index!;
  let hits: Hit[] = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };

  const highlight = (i: number) => {
    active = i;
    list.querySelectorAll('li').forEach((li, j) => li.setAttribute('aria-selected', j === i ? 'true' : 'false'));
    if (i >= 0) input.setAttribute('aria-activedescendant', `finder-opt-${i}`);
  };

  const render = () => {
    list.replaceChildren();
    if (!hits.length) {
      const li = document.createElement('li');
      li.className = 'finder-empty';
      li.textContent = input.value.trim() ? 'No matches' : '';
      if (li.textContent) list.append(li);
    }
    hits.forEach((h, i) => {
      const li = document.createElement('li');
      li.id = `finder-opt-${i}`;
      li.setAttribute('role', 'option');
      const a = document.createElement('a');
      a.href = h.path;
      a.tabIndex = -1;
      const label = document.createElement('span');
      label.className = 'finder-label';
      label.textContent = h.label;
      const meta = document.createElement('span');
      meta.className = 'finder-meta';
      const kind = h.kind === 'c' ? 'Country' : h.active ? 'Organization' : 'Organization, historical';
      meta.textContent = h.matched !== h.label && !h.label.includes(h.matched) ? `${kind} · ${h.matched}${h.lang ? ` (${h.lang})` : ''}` : `${kind} · ${h.id}`;
      a.append(label, meta);
      li.append(a);
      list.append(li);
    });
    list.hidden = !list.childElementCount;
    input.setAttribute('aria-expanded', list.hidden ? 'false' : 'true');
    highlight(hits.length ? 0 : -1);
  };

  let seq = 0;
  input.addEventListener('input', async () => {
    const mine = ++seq;
    const entries = await loadIndex(url);
    if (mine !== seq) return;
    hits = search(entries, input.value);
    render();
  });
  input.addEventListener('focus', () => void loadIndex(url), { once: true });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault();
      highlight((active + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault();
      highlight((active - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter' && active >= 0 && hits[active]) {
      e.preventDefault();
      window.location.href = hits[active].path;
    } else if (e.key === 'Escape') {
      close();
    }
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) close();
  });
  root.hidden = false;
}
