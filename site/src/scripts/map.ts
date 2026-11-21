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
//
// A figure with data-static colours its regions and shows the tooltip on hover, but its regions
// are not focusable: its .map-canvas is one role="img" with a text summary (the compare explorer's
// small maps, where six maps of focusable regions would bury the keyboard; its table has the facts).

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

// The browser twin of lib/worldmap.ts `viewFor`, from the data-box of each record in the SVG.
function viewOf(svg: SVGSVGElement, codes: string[]): string | null {
  const [, , width, height] = (svg.dataset.world ?? svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const code of codes) {
    const b = svg.querySelector<SVGElement>(`[data-code="${cssEscape(code)}"]`)?.dataset.box?.split(' ').map(Number);
    if (!b || b.length !== 4) continue;
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  if (x0 === Infinity || !width || !height) return null;
  if (x1 - x0 > width * 0.6 || y1 - y0 > height * 0.6) return null;
  let w = Math.max((x1 - x0) * 1.25, width * 0.22);
  let h = Math.max((y1 - y0) * 1.25, height * 0.22);
  const ratio = width / height;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  if (w > width * 0.8) return null;
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), width - w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), height - h);
  return [x, y, w, h].map((v) => v.toFixed(1)).join(' ');
}

function syncZoomButton(figure: HTMLElement) {
  const zoom = figure.querySelector<HTMLButtonElement>('[data-map-zoom]');
  if (!zoom) return;
  zoom.hidden = !figure.dataset.view;
  zoom.textContent = (figure.dataset.zoom === 'world' ? zoom.dataset.in : zoom.dataset.out) ?? '';
}

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

// zoom: the records to fit the view to (an empty list shows the whole world); leave it out to
// keep the current view, as the timeline does from one year to the next.
export async function renderMap(figure: HTMLElement, data: Record<string, MapEntry>, zoom?: string[]): Promise<void> {
  const canvas = await ensureSvg(figure);
  if (!canvas) return;
  if (zoom) {
    const svg = canvas.querySelector<SVGSVGElement>('svg')!;
    const view = viewOf(svg, zoom);
    if (view) figure.dataset.view = view;
    else delete figure.dataset.view;
    delete figure.dataset.zoom;
    applyView(figure);
    syncZoomButton(figure);
  }
  const state = wire(figure, canvas);
  state.data = data;
  const focusable = figure.dataset.static === undefined;
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
    if (!focusable) return;
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
    syncZoomButton(figure);
    applyView(figure);
  });
});
