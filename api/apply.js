export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { firstName, lastName, email, phone, linkedin, portfolio, message, role } = req.body;

    if (!email || !firstName || !lastName) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify({
                parent: { database_id: process.env.NOTION_APPLICATIONS_DB },
                properties: {
                    Name: {
                        title: [{ text: { content: `${firstName} ${lastName}` } }],
                    },
                    Email: {
                        email: email,
                    },
                    Phone: {
                        phone_number: phone || '',
                    },
                    Role: {
                        select: { name: role || 'Unknown' },
                    },
                    LinkedIn: {
                        url: linkedin || null,
                    },
                    Portfolio: {
                        url: portfolio || null,
                    },
                    Response: {
                        rich_text: [{ text: { content: (message || '').slice(0, 2000) } }],
                    },
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Notion error:', err);
            return res.status(500).json({ error: 'Failed to save to Notion' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
