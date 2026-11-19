import type { APIRoute } from 'astro';
import { json } from '../../../../lib/api';
import { topicDoc } from '../../../../lib/browse';
import { topicByKey, topics } from '../../../../lib/data';

export const getStaticPaths = () => topics().map((t) => ({ params: { key: t.key } }));
export const GET: APIRoute = ({ params }) => json(topicDoc(topicByKey().get(params.key!)!));
