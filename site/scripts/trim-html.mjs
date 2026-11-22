// Astro integration: removes template indentation from the built HTML (SPEC §10.3, site size).
// compressHTML stays off because it drops the space between text and a link on the next line;
// this pass keeps every whitespace run that holds a line break as one line break, so the page
// renders the same. Only text between tags changes: tags and their attribute values, comments
// and the contents of <pre>, <textarea>, <script> and <style> are copied as they are. Table
// rows of hundreds of memberships are mostly indentation, about a third of all HTML bytes.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN =
  /<!--[\s\S]*?-->|<(pre|textarea|script|style)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<[!/]?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/gi;
// Only ASCII whitespace: a no-break space is text.
const BREAK = /[ \t\r]*\n[ \t\r\n]*/g;

export function trimHtml(html) {
  let out = '';
  let last = 0;
  for (const m of html.matchAll(TOKEN)) {
    out += html.slice(last, m.index).replace(BREAK, '\n') + m[0];
    last = m.index + m[0].length;
  }
  return out + html.slice(last).replace(BREAK, '\n');
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

export default function trimHtmlIntegration() {
  return {
    name: 'trim-html',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let before = 0;
        let after = 0;
        for await (const file of htmlFiles(fileURLToPath(dir))) {
          const html = await readFile(file, 'utf8');
          const trimmed = trimHtml(html);
          before += Buffer.byteLength(html);
          after += Buffer.byteLength(trimmed);
          if (trimmed !== html) await writeFile(file, trimmed);
        }
        logger.info(`HTML ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
      },
    },
  };
}
