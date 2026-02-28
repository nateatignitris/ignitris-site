export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://useignitris.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    const token = process.env.NOTION_TOKEN;
    const databaseId = 'a6cc514f81fd475a8c846df5a13a432b';

    const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
                'Email': {
                    title: [{ text: { content: email } }]
                },
                'Source': {
                    rich_text: [{ text: { content: 'Homepage' } }]
                }
            }
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Notion waitlist error:', err);
        return res.status(500).json({ error: 'Failed to save' });
    }

    return res.status(200).json({ success: true });
}
