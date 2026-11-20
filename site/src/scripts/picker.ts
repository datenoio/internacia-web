// Explorer picker (components/EntityPicker.astro): the header finder's search, limited to one
// kind of entity, as a WAI-ARIA combobox. Choosing a result sets the input to "ID — Name" and
// dispatches `change`; a `change` the browser fires for half-typed text is stopped here, so an
// explorer only ever sees a chosen entity.
import { loadIndex, search, type Hit } from './search';

const chosen = new WeakSet<Event>();

document.querySelectorAll<HTMLElement>('[data-picker]').forEach((root) => {
  const input = root.querySelector<HTMLInputElement>('input')!;
  const list = root.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const kind = root.dataset.kind as 'b' | 'c';
  const url = root.dataset.index!;
  let hits: Hit[] = [];
  let active = -1;

  root.addEventListener('change', (e) => chosen.has(e) || e.stopPropagation(), true);

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const highlight = (i: number) => {
    active = i;
    list.querySelectorAll('li[role="option"]').forEach((li, j) => li.setAttribute('aria-selected', j === i ? 'true' : 'false'));
    if (i >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${i}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const pick = (h: Hit) => {
    input.value = `${h.id} — ${h.label}`;
    close();
    const e = new Event('change', { bubbles: true });
    chosen.add(e);
    input.dispatchEvent(e);
  };
  const render = () => {
    list.replaceChildren();
    hits.forEach((h, i) => {
      const li = document.createElement('li');
      li.id = `${list.id}-${i}`;
      li.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.className = 'finder-label';
      label.textContent = h.label;
      const meta = document.createElement('span');
      meta.className = 'finder-meta';
      const extra = h.matched !== h.label && !h.label.includes(h.matched) ? ` · ${h.matched}${h.lang ? ` (${h.lang})` : ''}` : '';
      meta.textContent = `${h.id}${kind === 'b' && !h.active ? ' · historical' : ''}${extra}`;
      li.append(label, meta);
      li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
      li.addEventListener('click', () => pick(h));
      list.append(li);
    });
    if (!hits.length && input.value.trim()) {
      const li = document.createElement('li');
      li.className = 'finder-empty';
      li.textContent = 'No matches';
      list.append(li);
    }
    list.hidden = !list.childElementCount;
    input.setAttribute('aria-expanded', list.hidden ? 'false' : 'true');
    highlight(hits.length ? 0 : -1);
  };

  let seq = 0;
  input.addEventListener('input', async () => {
    const mine = ++seq;
    const entries = (await loadIndex(url)).filter((e) => e.kind === kind);
    if (mine !== seq) return;
    hits = search(entries, input.value, 10);
    render();
  });
  input.addEventListener('focus', () => {
    void loadIndex(url);
    input.select();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault();
      highlight((active + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault();
      highlight((active - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && hits[active]) pick(hits[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  input.addEventListener('blur', close);
});
