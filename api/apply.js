import { put } from '@vercel/blob';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '6mb',
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { firstName, lastName, email, phone, linkedin, portfolio, message, role, resumeBase64, resumeName } = req.body;

    if (!email || !firstName || !lastName || !linkedin) {
        return res.status(400).json({ error: 'Name, email, and LinkedIn are required' });
    }

    try {
        // 1. Upload resume to Vercel Blob if provided
        let resumeUrl = null;
        if (resumeBase64 && resumeName) {
            const buffer = Buffer.from(resumeBase64, 'base64');
            const timestamp = Date.now();
            const safeName = resumeName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `resumes/${timestamp}_${safeName}`;

            const blob = await put(path, buffer, {
                access: 'public',
                contentType: 'application/pdf',
            });
            resumeUrl = blob.url;
        }

        // 2. Build Notion properties
        const properties = {
            Name: {
                title: [{ text: { content: `${firstName} ${lastName}` } }],
            },
            Email: {
                email: email,
            },
            Role: {
                select: { name: role || 'Unknown' },
            },
            LinkedIn: {
                url: linkedin,
            },
        };

        if (message) {
            properties.Response = {
                rich_text: [{ text: { content: message.slice(0, 2000) } }],
            };
        }

        if (phone) {
            properties.Phone = { phone_number: phone };
        }

        if (portfolio) {
            properties.Portfolio = { url: portfolio };
        }

        if (resumeUrl) {
            properties.Resume = { url: resumeUrl };
        }

        // 3. Save to Notion
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify({
                parent: { database_id: process.env.NOTION_APPLICATIONS_DB },
                properties,
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Notion error:', JSON.stringify(err));
            return res.status(500).json({ error: 'Failed to save', detail: err.message });
        }

        return res.status(200).json({ success: true, resumeUrl });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
