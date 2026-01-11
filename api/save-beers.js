export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST is supported.' });
  }

  try {
    const { beers } = req.body;

    if (!Array.isArray(beers) || beers.length === 0) {
      return res.status(400).json({ error: 'No beers provided' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
      return res.status(500).json({ error: 'Server misconfigured: missing Supabase service role key' });
    }

    // Insert into Supabase REST API
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/beers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(beers)
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('Supabase insert failed', resp.status, text);
      return res.status(resp.status).json({ error: `Supabase insert failed: ${text}` });
    }

    const inserted = JSON.parse(text);
    res.status(200).json({ inserted });
  } catch (err) {
    console.error('Error saving beers:', err);
    res.status(500).json({ error: 'Failed to save beers' });
  }
}
