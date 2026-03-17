export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const headers = { Authorization: `Bearer ${KV_REST_API_TOKEN}` };

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
    if (req.method === 'POST') {
      const { event } = req.body || {};
      if (!event) {
        return res.status(400).json({ error: 'event required' });
      }

      const today = new Date().toISOString().slice(0, 10);

      // Increment total play count
      await redis(['INCR', 'analytics:plays:total']);
      // Increment daily play count
      await redis(['INCR', `analytics:plays:${today}`]);

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const total = await redis(['GET', 'analytics:plays:total']);
      const today = new Date().toISOString().slice(0, 10);
      const daily = await redis(['GET', `analytics:plays:${today}`]);

      return res.status(200).json({
        total: Number(total.result) || 0,
        today: Number(daily.result) || 0,
        date: today,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
