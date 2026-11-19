import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { aboutMarkdown } from '../lib/pages';

export const GET: APIRoute = () => markdown(aboutMarkdown());
