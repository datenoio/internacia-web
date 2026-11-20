// Colour the shared base map and give every coloured region a keyboard-focusable tooltip.
// All labels are inserted with textContent.
//
// Figures with a <script data-map-data> are coloured on load. Explorers call renderMap() again
// with new data; each call clears the previous colouring first.
//
// A figure with data-card-base links its coloured regions to the country cards: a click or Enter
// opens <base><code>/ (in a widget, <base target="_blank"> opens it in a new tab).
//
// A figure with data-view shows that part of the world (a viewBox with the map's aspect ratio, so
// nothing changes size); its [data-map-zoom] button switches to the whole world and back. Dots
// keep their size when zoomed. A figure with data-link-table highlights the table row of the
// region under the pointer, and the region of the row under the pointer.

export type MapEntry = [string, string, string, string]; // css class, value label, joined, name

const svgCache = new Map<string, Promise<string>>();
const fetchSvg = (url: string) => {
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => r.text()));
  return svgCache.get(url)!;
};

interface Wired {
  data: Record<string, MapEntry>;
}
const wired = new WeakMap<HTMLElement, Wired>();

const cssEscape = (s: string) => (window.CSS?.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));

function applyView(figure: HTMLElement) {
  const svg = figure.querySelector<SVGSVGElement>('.map-canvas svg');
  if (!svg) return;
  const world = (svg.dataset.world ??= svg.getAttribute('viewBox') ?? '');
  const view = figure.dataset.view && figure.dataset.zoom !== 'world' ? figure.dataset.view : world;
  svg.setAttribute('viewBox', view);
  const k = Number(world.split(' ')[2]) / Number(view.split(' ')[2]) || 1;
  svg.querySelectorAll<SVGGElement>('.dot').forEach((g) => {
    const base = (g.dataset.t ??= g.getAttribute('transform') ?? '');
    g.setAttribute('transform', k === 1 ? base : `${base} scale(${(1 / k).toFixed(3)})`);
  });
}

async function ensureSvg(figure: HTMLElement): Promise<HTMLElement | null> {
  const canvas = figure.querySelector<HTMLElement>('.map-canvas');
  if (!canvas) return null;
  if (!canvas.querySelector('svg')) {
    const doc = new DOMParser().parseFromString(await fetchSvg(figure.dataset.src!), 'image/svg+xml');
    if (doc.documentElement.nodeName !== 'svg') return null;
    if (!canvas.querySelector('svg')) {
      const svg = document.importNode(doc.documentElement, true);
      svg.setAttribute('focusable', 'false');
      canvas.append(svg);
      applyView(figure);
    }
  }
  return canvas;
}

function wire(figure: HTMLElement, canvas: HTMLElement) {
  if (wired.has(figure)) return wired.get(figure)!;
  const state: Wired = { data: {} };
  wired.set(figure, state);
  const tip = figure.querySelector<HTMLElement>('.map-tip');
  const table = figure.dataset.linkTable ? document.getElementById(figure.dataset.linkTable) : null;
  const rows = (code: string | undefined) =>
    table && code ? table.querySelectorAll<HTMLTableRowElement>(`tr[data-member="${cssEscape(code)}"]`) : [];
  const show = (el: Element, x: number, y: number) => {
    const entry = state.data[(el as SVGElement).dataset.code!];
    rows((el as SVGElement).dataset.code).forEach((r) => r.classList.add('is-hover'));
    if (!entry || !tip) return;
    const [, label, joined, name] = entry;
    const value = document.createElement('strong');
    value.textContent = label;
    const who = document.createElement('span');
    who.textContent = name;
    tip.replaceChildren(value, who);
    if (joined) {
      const since = document.createElement('span');
      since.className = 'muted';
      since.textContent = `joined ${joined}`;
      tip.append(since);
    }
    const box = figure.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(x - box.left + 12, 0), box.width - 200)}px`;
    tip.style.top = `${y - box.top + 12}px`;
    tip.hidden = false;
    el.classList.add('hover');
  };
  const hide = (el: Element) => {
    if (tip) tip.hidden = true;
    el.classList.remove('hover');
    rows((el as SVGElement).dataset.code).forEach((r) => r.classList.remove('is-hover'));
  };
  if (table) {
    const region = (e: Event) => {
      const code = (e.target as Element).closest<HTMLElement>('tr[data-member]')?.dataset.member;
      return code ? canvas.querySelector(`.has[data-code="${cssEscape(code)}"]`) : null;
    };
    const on = (e: Event) => region(e)?.classList.add('hover');
    const off = (e: Event) => region(e)?.classList.remove('hover');
    table.addEventListener('pointerover', on);
    table.addEventListener('pointerout', off);
    table.addEventListener('focusin', on);
    table.addEventListener('focusout', off);
  }
  const cardBase = figure.dataset.cardBase;
  const open = (el: Element, newTab: boolean) => {
    const code = (el as SVGElement).dataset.code;
    if (!cardBase || !code || !el.classList.contains('has')) return;
    const href = `${cardBase}${code.toLowerCase()}/`;
    if (newTab) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    const a = document.createElement('a');
    a.href = href;
    document.body.append(a);
    a.click();
    a.remove();
  };
  canvas.querySelectorAll<SVGElement>('[data-code]').forEach((el) => {
    el.addEventListener('pointermove', (e) => el.classList.contains('has') && show(el, e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => hide(el));
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      show(el, r.left + r.width / 2, r.top + r.height / 2);
    });
    el.addEventListener('blur', () => hide(el));
    if (cardBase) {
      el.addEventListener('click', (e) => open(el, e.metaKey || e.ctrlKey));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') open(el, e.metaKey || e.ctrlKey);
      });
    }
  });
  return state;
}

export async function renderMap(figure: HTMLElement, data: Record<string, MapEntry>): Promise<void> {
  const canvas = await ensureSvg(figure);
  if (!canvas) return;
  const state = wire(figure, canvas);
  state.data = data;
  canvas.querySelectorAll<SVGElement>('[data-code]').forEach((el) => {
    const previous = el.dataset.cls;
    if (previous) el.classList.remove(previous);
    el.classList.remove('has');
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
    delete el.dataset.cls;
    const entry = data[el.dataset.code!];
    if (!entry) return;
    el.classList.add('has', entry[0]);
    el.dataset.cls = entry[0];
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', figure.dataset.cardBase ? 'link' : 'img');
    el.setAttribute('aria-label', `${entry[3]}: ${entry[1]}${entry[2] ? `, joined ${entry[2]}` : ''}`);
  });
}

document.querySelectorAll<HTMLElement>('[data-map]').forEach((figure) => {
  const raw = figure.querySelector('script[data-map-data]')?.textContent;
  if (raw) void renderMap(figure, JSON.parse(raw) as Record<string, MapEntry>);
  const zoom = figure.querySelector<HTMLButtonElement>('[data-map-zoom]');
  zoom?.addEventListener('click', () => {
    const world = figure.dataset.zoom !== 'world';
    if (world) figure.dataset.zoom = 'world';
    else delete figure.dataset.zoom;
    zoom.textContent = (world ? zoom.dataset.in : zoom.dataset.out) ?? '';
    applyView(figure);
  });
});
