// <internacia-embed block="EU"></internacia-embed>
// <internacia-embed country="FR" theme="dark"></internacia-embed>
//
// Shows an Internacia widget in an iframe and sizes the frame to its content. The widgets live next
// to this script (embed/blocks/{id}/ and embed/countries/{code}/), so the script works on any
// domain the site is served from. Content inside the element (a link to the card) is shown until
// the script runs. No cookies, no storage, no requests to other hosts.
(() => {
  if (!window.customElements || customElements.get('internacia-embed')) return;
  const script = document.currentScript;
  const base = new URL('./', script && script.src ? script.src : location.href);
  const ID = /^[A-Za-z0-9_+-]{1,64}$/;

  class InternaciaEmbed extends HTMLElement {
    static get observedAttributes() {
      return ['block', 'country', 'theme'];
    }

    constructor() {
      super();
      this.onMessage = (event) => {
        const frame = this.frame;
        if (!frame || event.source !== frame.contentWindow || event.origin !== base.origin) return;
        const data = event.data;
        if (!data || data.source !== 'internacia-embed') return;
        const height = Number(data.height);
        if (Number.isFinite(height)) frame.style.height = `${Math.min(Math.max(Math.ceil(height), 80), 4000)}px`;
        if (typeof data.title === 'string' && data.title) frame.title = data.title.slice(0, 200);
      };
    }

    connectedCallback() {
      addEventListener('message', this.onMessage);
      this.render();
    }

    disconnectedCallback() {
      removeEventListener('message', this.onMessage);
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const block = this.getAttribute('block');
      const country = this.getAttribute('country');
      const id = block || country;
      if (!id || !ID.test(id)) return;
      const src = new URL(`${block ? 'blocks' : 'countries'}/${id.toLowerCase()}/`, base);
      const theme = this.getAttribute('theme');
      if (theme === 'light' || theme === 'dark') src.searchParams.set('theme', theme);
      if (!this.frame) {
        const root = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = ':host{display:block}iframe{display:block;width:100%;height:480px;border:0}';
        this.frame = document.createElement('iframe');
        this.frame.loading = 'lazy';
        root.append(style, this.frame);
      }
      this.frame.title = `Internacia: ${id}`;
      if (this.frame.src !== src.href) this.frame.src = src.href;
    }
  }

  customElements.define('internacia-embed', InternaciaEmbed);
})();
