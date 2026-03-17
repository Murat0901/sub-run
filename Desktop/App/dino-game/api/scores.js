export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const headers = { Authorization: `Bearer ${KV_REST_API_TOKEN}` };
  const KEY = 'leaderboard';

  async function redis(cmd) {
    const r = await fetch(`${KV_REST_API_URL}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    return r.json();
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // Top 10 scores (highest first)
      const data = await redis(['ZREVRANGE', KEY, '0', '9', 'WITHSCORES']);
      const results = data.result || [];
      const scores = [];
      for (let i = 0; i < results.length; i += 2) {
        try {
          const entry = JSON.parse(results[i]);
          scores.push({ ...entry, score: Number(results[i + 1]) });
        } catch (_) {
          scores.push({ name: '???', score: Number(results[i + 1]) });
        }
      }
      return res.status(200).json(scores);
    }

    if (req.method === 'POST') {
      const { name, score, build, timeline } = req.body || {};
      if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'name and score required' });
      }

      const cleanName = String(name).slice(0, 16).replace(/[<>"']/g, '');
      const member = JSON.stringify({
        name: cleanName,
        build: String(build || '').slice(0, 30),
        timeline: String(timeline || '').slice(0, 30),
        date: new Date().toISOString().slice(0, 10),
        id: Date.now().toString(36),
      });

      // Add score
      await redis(['ZADD', KEY, score, member]);
      // Cap at 100 entries (remove lowest)
      await redis(['ZREMRANGEBYRANK', KEY, '0', '-101']);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
