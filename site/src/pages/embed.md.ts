import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { embedMarkdown } from '../lib/pages';

export const GET: APIRoute = () => markdown(embedMarkdown());
