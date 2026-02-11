function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

async function notionRequest(path, body) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(body),
    });
    return res.json();
}

async function findByReferralCode(code) {
    const data = await notionRequest('/databases/' + process.env.NOTION_DATABASE_ID + '/query', {
        filter: {
            property: 'Referral Code',
            rich_text: { equals: code },
        },
    });
    return data.results && data.results.length > 0 ? data.results[0] : null;
}

async function incrementReferrals(pageId, currentCount) {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
            properties: {
                Referrals: { number: (currentCount || 0) + 1 },
            },
        }),
    });
    return res.json();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, company, ref } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        // 1. Generate unique referral code for new signup
        const referralCode = generateCode();

        // 2. Build Notion properties
        const properties = {
            Email: {
                title: [{ text: { content: email } }],
            },
            Company: {
                rich_text: [{ text: { content: company || '' } }],
            },
            'Referral Code': {
                rich_text: [{ text: { content: referralCode } }],
            },
            Referrals: {
                number: 0,
            },
        };

        // 3. If referred by someone, record it
        if (ref) {
            properties['Referred By'] = {
                rich_text: [{ text: { content: ref } }],
            };
        }

        // 4. Save new signup to Notion
        const createResult = await notionRequest('/pages', {
            parent: { database_id: process.env.NOTION_DATABASE_ID },
            properties,
        });

        if (createResult.object === 'error') {
            console.error('Notion create error:', JSON.stringify(createResult));
            return res.status(500).json({ error: 'Failed to save', detail: createResult.message });
        }

        // 5. If referred, find the referrer and increment their count
        if (ref) {
            try {
                const referrer = await findByReferralCode(ref);
                if (referrer) {
                    const currentCount = referrer.properties.Referrals?.number || 0;
                    await incrementReferrals(referrer.id, currentCount);
                }
            } catch (e) {
                // Don't fail the signup if referral credit fails
                console.error('Referral credit error:', e);
            }
        }

        return res.status(200).json({ success: true, referralCode });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
