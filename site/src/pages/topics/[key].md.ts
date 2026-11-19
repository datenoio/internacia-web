import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { topicMarkdown } from '../../lib/browse';
import { topicByKey, topics } from '../../lib/data';

export const getStaticPaths = () => topics().map((t) => ({ params: { key: t.key } }));
export const GET: APIRoute = ({ params }) => markdown(topicMarkdown(topicByKey().get(params.key!)!));
