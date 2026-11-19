import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { llmsTxt } from '../lib/llms';

export const GET: APIRoute = () => text(llmsTxt());
