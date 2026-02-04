export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, company } = req.body;

    if (!email || !company) {
        return res.status(400).json({ error: 'Email and company are required' });
    }

    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: process.env.NOTION_DATABASE_ID },
                properties: {
                    'Email': {
                        title: [{ text: { content: email } }]
                    },
                    'Company': {
                        rich_text: [{ text: { content: company } }]
                    },
                    'Date': {
                        date: { start: new Date().toISOString().split('T')[0] }
                    }
                }
            })
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            const error = await response.json();
            console.error('Notion error:', error);
            return res.status(500).json({ error: 'Failed to save to Notion' });
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
