import { fetchMeltwaterDashboard } from '../_lib/meltwater.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const generatedAt = new Date();
    const data = await fetchMeltwaterDashboard({
      apiKey: process.env.MELTWATER_API_KEY,
      searchId: Number(process.env.MELTWATER_SEARCH_ID || 29175637),
      now: generatedAt,
    });

    response.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.status(200).json({
      ...data,
      meta: {
        ...data.meta,
        cached: true,
        refreshMode: 'weekly',
        nextRefreshAt: new Date(generatedAt.getTime() + WEEK_MS).toISOString(),
      },
    });
  } catch (error) {
    console.error(`[meltwater] dashboard refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(502).json({ error: 'Live Meltwater data is temporarily unavailable.' });
  }
}
