// Colour the shared base map and give every coloured region a keyboard-focusable tooltip.
// All labels are inserted with textContent.
//
// Figures with a <script data-map-data> are coloured on load. Explorers call renderMap() again
// with new data; each call clears the previous colouring first.

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
    }
  }
  return canvas;
}

function wire(figure: HTMLElement, canvas: HTMLElement) {
  if (wired.has(figure)) return wired.get(figure)!;
  const state: Wired = { data: {} };
  wired.set(figure, state);
  const tip = figure.querySelector<HTMLElement>('.map-tip');
  const show = (el: Element, x: number, y: number) => {
    const entry = state.data[(el as SVGElement).dataset.code!];
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
  };
  canvas.querySelectorAll<SVGElement>('[data-code]').forEach((el) => {
    el.addEventListener('pointermove', (e) => el.classList.contains('has') && show(el, e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => hide(el));
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      show(el, r.left + r.width / 2, r.top + r.height / 2);
    });
    el.addEventListener('blur', () => hide(el));
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
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${entry[3]}: ${entry[1]}${entry[2] ? `, joined ${entry[2]}` : ''}`);
  });
}

document.querySelectorAll<HTMLElement>('[data-map]').forEach((figure) => {
  const raw = figure.querySelector('script[data-map-data]')?.textContent;
  if (raw) void renderMap(figure, JSON.parse(raw) as Record<string, MapEntry>);
});
