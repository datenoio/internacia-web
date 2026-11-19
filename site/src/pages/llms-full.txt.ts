import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { llmsFullTxt } from '../lib/llms';
import { aboutMarkdown, dataMarkdown } from '../lib/pages';

export const GET: APIRoute = () => text(llmsFullTxt(aboutMarkdown(), dataMarkdown()));
