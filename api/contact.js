export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, title, email, company, size, message } = req.body || {};

    if (!name || !email || !company || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const BLOCKED_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || BLOCKED_DOMAINS.includes(domain)) {
        return res.status(400).json({ error: 'Work email required' });
    }

    const token = process.env.NOTION_TOKEN;
    const dbId  = process.env.NOTION_CONTACTS_DB_ID;

    if (!token || !dbId) {
        console.error('Missing NOTION_TOKEN or NOTION_CONTACTS_DB_ID');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const body = {
        parent: { database_id: dbId },
        properties: {
            Name: {
                title: [{ text: { content: name } }]
            },
            Email: {
                email: email
            },
            Company: {
                rich_text: [{ text: { content: company } }]
            },
            Title: {
                rich_text: [{ text: { content: title || '' } }]
            },
            Size: {
                rich_text: [{ text: { content: size || '' } }]
            },
            Message: {
                rich_text: [{ text: { content: message } }]
            },
            Status: {
                select: { name: 'New' }
            }
        }
    };

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(body)
    });

    if (!notionRes.ok) {
        const err = await notionRes.text();
        console.error('Notion error:', err);
        return res.status(500).json({ error: 'Failed to save' });
    }

    return res.status(200).json({ success: true });
}
