export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, company, budget, message } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const token = process.env.NOTION_TOKEN;
  const dbId  = '7d78e5130e544fa3a96c1a1d063d9605';

  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  const props = {
    Name:    { title:    [{ text: { content: name } }] },
    Email:   { email:   email },
    Company: { rich_text: [{ text: { content: company || '' } }] },
    Status:  { select:  { name: 'New' } },
    Source:  { rich_text: [{ text: { content: 'adsops page' } }] },
  };
  if (message) props.Message = { rich_text: [{ text: { content: message } }] };
  if (budget)  props.Budget  = { select: { name: budget } };

  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Notion error:', err);
      return res.status(500).json({ error: 'Failed to save submission' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
