// Colour the shared base map for each [data-map] figure, and give every coloured region a
// keyboard-focusable tooltip. All labels are inserted with textContent.

const svgCache = new Map<string, Promise<string>>();
const fetchSvg = (url: string) => {
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => r.text()));
  return svgCache.get(url)!;
};

type Entry = [string, string, string, string]; // group, status label, joined, name

async function setup(figure: HTMLElement) {
  const canvas = figure.querySelector<HTMLElement>('.map-canvas');
  const tip = figure.querySelector<HTMLElement>('.map-tip');
  const raw = figure.querySelector('script[data-map-data]')?.textContent;
  if (!canvas || !tip || !raw) return;
  const data = JSON.parse(raw) as Record<string, Entry>;

  const doc = new DOMParser().parseFromString(await fetchSvg(figure.dataset.src!), 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName !== 'svg') return;
  svg.setAttribute('focusable', 'false');
  canvas.append(document.importNode(svg, true));

  const show = (el: Element, entry: Entry, x: number, y: number) => {
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
    tip.hidden = true;
    el.classList.remove('hover');
  };

  canvas.querySelectorAll<SVGElement>('[data-code]').forEach((el) => {
    const entry = data[el.dataset.code!];
    if (!entry) return;
    el.classList.add('has', entry[0]);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${entry[3]}: ${entry[1]}${entry[2] ? `, joined ${entry[2]}` : ''}`);
    el.addEventListener('pointermove', (e) => show(el, entry, e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => hide(el));
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      show(el, entry, r.left + r.width / 2, r.top + r.height / 2);
    });
    el.addEventListener('blur', () => hide(el));
  });
}

document.querySelectorAll<HTMLElement>('[data-map]').forEach((f) => void setup(f));
