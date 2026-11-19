import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { dataMarkdown, recipes } from '../lib/pages';

export const GET: APIRoute = () =>
  markdown(`${dataMarkdown()}\n## Recipes\n\n${recipes().map((r) => `### ${r.title}\n\n\`\`\`\n${r.code}\n\`\`\`\n`).join('\n')}`);
