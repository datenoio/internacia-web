// Inside an embedded widget: tell the parent page how tall the content is, so the
// <internacia-embed> element (public/embed/widget.js) can size its frame. The message carries only
// the height and the page title.
const root = document.querySelector<HTMLElement>('[data-embed-root]');

if (root && window.parent !== window) {
  let last = 0;
  const post = () => {
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (height === last) return;
    last = height;
    window.parent.postMessage({ source: 'internacia-embed', height, title: document.title }, '*');
  };
  new ResizeObserver(post).observe(root);
  addEventListener('load', post);
}
