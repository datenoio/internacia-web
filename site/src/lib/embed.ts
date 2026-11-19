// Embeddable widgets (SPEC §13, M3): small pages under /embed/ for other sites to show in an
// <iframe> or through the <internacia-embed> element (public/embed/widget.js). The facts come from
// the same generated data as the cards; every widget links back to its card.
import type { Block, Country } from './data';
import { absolute, blockPath, countryPath, path } from './urls';
import { onMap } from './worldmap';

export type EmbedKind = 'block' | 'country';

// A block gets a map widget when its membership map has at least one country or territory on it
// (the same rule MembershipMap uses to show the map on the card).
export const blockEmbeddable = (b: Block): boolean => b._roster.some((r) => r.link === 'country' && onMap(r.id));
// A country gets a memberships widget when it has current memberships.
export const countryEmbeddable = (c: Country): boolean => c._memberships.some((m) => m.current);

export const blockEmbedPath = (id: string) => path(`embed/blocks/${id.toLowerCase()}/`);
export const countryEmbedPath = (code: string) => path(`embed/countries/${code.toLowerCase()}/`);
export const widgetScript = () => path('embed/widget.js');

// Default frame height for a plain <iframe>; the web component sizes the frame to its content.
export const FRAME_HEIGHT = 480;

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function embedTitle(kind: EmbedKind, name: string): string {
  return kind === 'block' ? `${name}: membership map` : `${name}: memberships in international organizations`;
}

export function snippets(kind: EmbedKind, id: string, name: string) {
  const src = absolute(kind === 'block' ? blockEmbedPath(id) : countryEmbedPath(id));
  const card = absolute(kind === 'block' ? blockPath(id) : countryPath(id));
  const title = `${embedTitle(kind, name)} (Internacia)`;
  return {
    src,
    iframe: `<iframe src="${src}" title="${attr(title)}" width="100%" height="${FRAME_HEIGHT}" style="border:0" loading="lazy"></iframe>`,
    component: `<script src="${absolute(widgetScript())}" defer></script>
<internacia-embed ${kind}="${attr(id)}"><a href="${card}">${text(name)} on Internacia</a></internacia-embed>`,
  };
}
