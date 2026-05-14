export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://useignitris.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        firstName,
        lastName,
        email,
        phone,
        location,
        role,
        linkedin,
        portfolio,
        coverLetter,
        source
    } = req.body || {};

    if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = process.env.NOTION_TOKEN;
    const databaseId = 'f4ea013d5ac2463fa7e340d3df26fee4';

    const fullName = `${firstName} ${lastName}`.trim();

    const properties = {
        'Name': {
            title: [{ text: { content: fullName } }]
        },
        'Email': {
            email: email
        },
        'Status': {
            select: { name: 'New' }
        }
    };

    if (phone)       properties['Phone']        = { phone_number: phone };
    if (location)    properties['Location']     = { rich_text: [{ text: { content: location } }] };
    if (role)        properties['Role']         = { rich_text: [{ text: { content: role } }] };
    if (linkedin)    properties['LinkedIn']     = { url: linkedin };
    if (portfolio)   properties['Portfolio']    = { url: portfolio };
    if (coverLetter) properties['Cover Letter'] = { rich_text: [{ text: { content: coverLetter.slice(0, 2000) } }] };
    if (source) {
        const sourceMap = {
            'linkedin': 'LinkedIn',
            'referral': 'Referral',
            'website': 'Company Website',
            'job-board': 'Job Board',
            'other': 'Other'
        };
        const mappedSource = sourceMap[source] || 'Other';
        properties['Source'] = { select: { name: mappedSource } };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Notion apply error:', err);
        return res.status(500).json({ error: 'Failed to save application' });
    }

    return res.status(200).json({ success: true });
}
