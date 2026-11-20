// Marks the in-page navigation link of the section in view (components/PageToc.astro).
// Without JavaScript the links still jump to their sections.

const toc = document.querySelector<HTMLElement>('[data-toc]');

if (toc && 'IntersectionObserver' in window) {
  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))?.closest('section') ?? null);
  const visible = new Set<Element>();
  let active = -1;

  const update = () => {
    const index = targets.findIndex((t) => t !== null && visible.has(t));
    if (index === active) return;
    active = index;
    links.forEach((a, i) => (i === index ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    // On narrow screens the row scrolls sideways; keep the marked link in it.
    if (index >= 0) {
      const link = links[index];
      const row = link.closest('ul');
      if (row && row.scrollWidth > row.clientWidth) {
        const left = link.offsetLeft; // the row is the offsetParent (position: relative)
        if (left < row.scrollLeft || left + link.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 16;
      }
    }
  };

  // A section counts as in view while it crosses the band under the sticky row.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      update();
    },
    { rootMargin: '-64px 0px -60% 0px' },
  );
  targets.forEach((t) => t && observer.observe(t));
}
